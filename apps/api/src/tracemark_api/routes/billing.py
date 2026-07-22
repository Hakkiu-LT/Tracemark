"""Stripe billing endpoints.

Flow (Stripe Elements / embedded card form):
  1. Frontend calls POST /billing/create-subscription with the chosen plan,
     interval, and add-ons.
  2. We create/reuse a Stripe Customer and open a Subscription in
     `default_incomplete` state, returning the PaymentIntent client_secret.
  3. The frontend confirms the payment with Stripe Elements.
  4. Stripe fires webhooks (invoice.paid, customer.subscription.updated) which we
     handle in POST /billing/webhook to sync our DB — the single source of truth
     for subscription state.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from tracemark_api.dependencies import get_current_user, get_current_profile, CurrentProfile
from tracemark_api.services.database import get_supabase
from tracemark_api.services.entitlements import reconcile_brand_locks
from tracemark_api.services.billing_config import (
    SELF_SERVE_PLANS,
    SUBSCRIPTION_ADDONS,
    get_addon_price_id,
    get_plan_price_id,
    normalize_addon_quantity,
    price_id_to_addon,
    price_id_to_plan,
)

router = APIRouter(prefix="/billing", tags=["billing"])

_VALID_INTERVALS = ("month", "year")
_ACTIVE_STATUSES = ["active", "trialing", "past_due"]


def _stripe():
    """Return the stripe module with the API key configured (lazy, so imports
    don't fail when the key is absent, e.g. in unrelated tests)."""
    key = os.environ.get("STRIPE_SECRET_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Billing is not configured")
    stripe.api_key = key
    return stripe


def _do_stripe(fn, *args, **kwargs):
    """Call a Stripe SDK method, translating Stripe errors into HTTP errors.

    Unhandled exceptions become 500s that bypass CORS middleware, so the browser
    sees an opaque "CORS" error instead of the real cause. Converting to
    HTTPException keeps CORS headers and gives the user an actionable message.
    """
    try:
        return fn(*args, **kwargs)
    except stripe.CardError as exc:  # card declined etc.
        raise HTTPException(status_code=402, detail=getattr(exc, "user_message", None) or str(exc))
    except stripe.StripeError as exc:
        raise HTTPException(status_code=502, detail=getattr(exc, "user_message", None) or str(exc))


# ── Request models ───────────────────────────────────────────────────────────
class AddonInput(BaseModel):
    key: str
    quantity: int = 1


class CreateSubscriptionRequest(BaseModel):
    plan: str
    interval: str = "month"
    addons: list[AddonInput] = []


class UpdateSubscriptionRequest(BaseModel):
    plan: str | None = None
    interval: str | None = None
    addons: list[AddonInput] | None = None


class CancelRequest(BaseModel):
    cancel: bool = True  # True = cancel at period end, False = resume


class ManagedTakedownRequest(BaseModel):
    takedown_id: str | None = None  # for idempotency / audit


# ── Helpers ──────────────────────────────────────────────────────────────────
_billing_v2: bool | None = None


def _billing_v2_ready() -> bool:
    """Feature-detect the 20260707000002 hardening migration (user_id columns +
    stripe_events table). Lets this code run safely before the migration is
    applied — it just skips the extra columns / dedupe until then."""
    global _billing_v2
    if _billing_v2 is None:
        try:
            get_supabase().table("stripe_events").select("id").limit(1).execute()
            _billing_v2 = True
        except Exception:
            _billing_v2 = False
    return _billing_v2


def _anchor_user_id(org_id: str) -> str | None:
    """If the billing anchor is actually a user (single-member fallback, i.e.
    org_id matches a profiles.id), return it so RLS can grant that user access.
    Returns None for real organizations (org membership grants access instead)."""
    sb = get_supabase()
    res = sb.table("profiles").select("id").eq("id", org_id).maybe_single().execute()
    return org_id if (res and res.data) else None


def _with_owner(payload: dict, org_id: str) -> dict:
    """Attach user_id ownership to a write payload when the schema supports it."""
    if _billing_v2_ready():
        payload = {**payload, "user_id": _anchor_user_id(org_id)}
    return payload


def _billing_org_id(user_id: str) -> str:
    """Resolve the billing anchor: the user's organization, or the user's own id
    as a single-member fallback when no organization is configured."""
    sb = get_supabase()
    res = (
        sb.table("profiles")
        .select("organization_id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    # maybe_single() can return None (not just data=None) when no row matches.
    org_id = res.data.get("organization_id") if res and res.data else None
    return org_id or user_id


def _current_subscription_row(org_id: str) -> dict | None:
    """Return the org's most relevant subscription row.

    Prefer an active/trialing/past_due row; otherwise fall back to the most
    recent row. Avoids maybe_single() (which errors when >1 row matches) and
    avoids leftover 'incomplete' rows from abandoned checkouts shadowing the
    real subscription.
    """
    sb = get_supabase()
    res = (
        sb.table("subscriptions")
        .select("*")
        .eq("organization_id", org_id)
        .order("created_at", desc=True)
        .execute()
    )
    rows = res.data or []
    for row in rows:
        if row.get("status") in _ACTIVE_STATUSES:
            return row
    return rows[0] if rows else None


def _get_or_create_customer(org_id: str, email: str) -> str:
    """Return the Stripe customer id for the org, creating one if needed."""
    sb = get_supabase()
    row = (
        sb.table("org_settings")
        .select("stripe_customer_id, notification_email")
        .eq("organization_id", org_id)
        .maybe_single()
        .execute()
    )
    # maybe_single() can return None (not just data=None) when no row matches.
    existing = row.data if row else None
    if existing and existing.get("stripe_customer_id"):
        return existing["stripe_customer_id"]

    customer = _do_stripe(
        _stripe().Customer.create, email=email or None, metadata={"organization_id": org_id}
    )
    # Upsert so two concurrent checkouts can't both INSERT and hit the PK.
    sb.table("org_settings").upsert(
        {
            "organization_id": org_id,
            "notification_email": (existing or {}).get("notification_email") or email or "",
            "stripe_customer_id": customer.id,
        },
        on_conflict="organization_id",
    ).execute()
    return customer.id


def _ts_to_iso(ts: int | None) -> str | None:
    if not ts:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def _as_dict(obj) -> dict:
    """Stripe v15 objects are not dicts and have no .get(); normalize to a plain
    (recursively-converted) dict so downstream code can use .get()/[]."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    to_dict = getattr(obj, "to_dict", None)
    return to_dict() if callable(to_dict) else obj


def _period_end(sub) -> int | None:
    """current_period_end moved onto items in newer Stripe API versions; look in
    both places so we stay compatible."""
    sub = _as_dict(sub)
    end = sub.get("current_period_end")
    if end:
        return end
    items = (sub.get("items") or {}).get("data") or []
    for item in items:
        if item.get("current_period_end"):
            return item["current_period_end"]
    return None


def _plan_from_subscription(sub) -> tuple[str | None, str | None]:
    """Inspect subscription items and return (plan, interval)."""
    sub = _as_dict(sub)
    items = (sub.get("items") or {}).get("data") or []
    for item in items:
        price_id = (item.get("price") or {}).get("id")
        if not price_id:
            continue
        match = price_id_to_plan(price_id)
        if match:
            return match
    return None, None


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/create-subscription")
def create_subscription(
    body: CreateSubscriptionRequest, current_user=Depends(get_current_user)
):
    if body.plan not in SELF_SERVE_PLANS:
        raise HTTPException(status_code=400, detail=f"Plan '{body.plan}' is not self-serve")
    if body.interval not in _VALID_INTERVALS:
        raise HTTPException(status_code=400, detail="interval must be 'month' or 'year'")

    sb = get_supabase()
    org_id = _billing_org_id(current_user.id)

    # Block accidental duplicate subscriptions — use update-subscription instead.
    existing = _current_subscription_row(org_id)
    if existing and existing.get("status") in _ACTIVE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail="An active subscription already exists; use update-subscription.",
        )

    try:
        items = [{"price": get_plan_price_id(body.plan, body.interval)}]
        for addon in body.addons:
            if addon.key not in SUBSCRIPTION_ADDONS:
                raise HTTPException(status_code=400, detail=f"Unknown add-on '{addon.key}'")
            items.append(
                {
                    "price": get_addon_price_id(addon.key),
                    "quantity": normalize_addon_quantity(addon.key, addon.quantity),
                }
            )
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    customer_id = _get_or_create_customer(org_id, current_user.email)

    subscription = _do_stripe(
        _stripe().Subscription.create,
        customer=customer_id,
        items=items,
        payment_behavior="default_incomplete",
        payment_settings={"save_default_payment_method": "on_subscription"},
        expand=["latest_invoice.confirmation_secret"],
        metadata={"organization_id": org_id, "plan": body.plan},
    )
    sub = _as_dict(subscription)

    # Clear leftover non-active rows for this org so get_subscription can't return
    # an abandoned 'incomplete'/'canceled' row instead of this one.
    sb.table("subscriptions").delete().eq("organization_id", org_id).not_.in_(
        "status", _ACTIVE_STATUSES
    ).execute()

    # Persist a provisional row; the webhook will confirm the final state.
    sb.table("subscriptions").upsert(
        _with_owner(
            {
                "organization_id": org_id,
                "stripe_customer_id": customer_id,
                "stripe_subscription_id": sub.get("id"),
                "plan": body.plan,
                "status": sub.get("status"),
                "interval": body.interval,
                "current_period_end": _ts_to_iso(_period_end(sub)),
            },
            org_id,
        ),
        on_conflict="stripe_subscription_id",
    ).execute()

    # Newer Stripe API (Basil): the client_secret lives on the invoice's
    # confirmation_secret, not the removed invoice.payment_intent field.
    invoice = sub.get("latest_invoice") or {}
    confirmation = invoice.get("confirmation_secret") or {}
    client_secret = confirmation.get("client_secret")
    if not client_secret:
        raise HTTPException(status_code=500, detail="Stripe did not return a client secret")

    return {
        "subscription_id": sub.get("id"),
        "client_secret": client_secret,
    }


@router.post("/update-subscription")
def update_subscription(
    body: UpdateSubscriptionRequest, current_user=Depends(get_current_user)
):
    org_id = _billing_org_id(current_user.id)
    row = _current_subscription_row(org_id)
    if not row or row.get("status") not in _ACTIVE_STATUSES or not row.get("stripe_subscription_id"):
        raise HTTPException(status_code=404, detail="No active subscription to update")

    stripe_sub_id = row["stripe_subscription_id"]
    sub = _as_dict(_do_stripe(_stripe().Subscription.retrieve, stripe_sub_id, expand=["items"]))

    # Index current items by price id.
    current_items = {
        item["price"]["id"]: item for item in (sub.get("items") or {}).get("data") or []
    }

    plan = body.plan or row["plan"]
    interval = body.interval or row["interval"]
    if plan not in SELF_SERVE_PLANS:
        raise HTTPException(status_code=400, detail=f"Plan '{plan}' is not self-serve")
    if interval not in _VALID_INTERVALS:
        raise HTTPException(status_code=400, detail="interval must be 'month' or 'year'")

    try:
        desired_plan_price = get_plan_price_id(plan, interval)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    modifications: list[dict] = []

    # Plan item: swap the existing plan item's price, or add the new one and
    # delete the old plan item.
    old_plan_item = next(
        (item for pid, item in current_items.items() if price_id_to_plan(pid) is not None),
        None,
    )
    if old_plan_item and old_plan_item["price"]["id"] == desired_plan_price:
        pass  # plan/interval unchanged
    elif old_plan_item:
        modifications.append({"id": old_plan_item["id"], "price": desired_plan_price})
    else:
        modifications.append({"price": desired_plan_price})

    # Add-on items: reconcile desired quantities against current items.
    if body.addons is not None:
        desired = {}
        for addon in body.addons:
            if addon.key not in SUBSCRIPTION_ADDONS:
                raise HTTPException(status_code=400, detail=f"Unknown add-on '{addon.key}'")
            try:
                desired[get_addon_price_id(addon.key)] = normalize_addon_quantity(
                    addon.key, addon.quantity
                )
            except ValueError as exc:
                raise HTTPException(status_code=500, detail=str(exc))

        for pid, item in current_items.items():
            if price_id_to_addon(pid) is None:
                continue
            if pid in desired:
                modifications.append({"id": item["id"], "quantity": desired.pop(pid)})
            else:
                modifications.append({"id": item["id"], "deleted": True})
        for pid, qty in desired.items():
            modifications.append({"price": pid, "quantity": qty})

    # Stripe rejects items=[]; only pass items when there's something to change.
    modify_kwargs = {
        "proration_behavior": "create_prorations",
        "cancel_at_period_end": False,  # choosing a new plan resumes a scheduled cancel
        "expand": ["items"],
    }
    if modifications:
        modify_kwargs["items"] = modifications
    updated = _do_stripe(_stripe().Subscription.modify, stripe_sub_id, **modify_kwargs)

    _sync_subscription_to_db(updated, org_id)
    return {"status": _as_dict(updated).get("status"), "plan": plan, "interval": interval}


@router.post("/cancel-subscription")
def cancel_subscription(body: CancelRequest, current_user=Depends(get_current_user)):
    sb = get_supabase()
    org_id = _billing_org_id(current_user.id)
    row = _current_subscription_row(org_id)
    if not row or row.get("status") not in _ACTIVE_STATUSES or not row.get("stripe_subscription_id"):
        raise HTTPException(status_code=404, detail="No active subscription")

    stripe_sub_id = row["stripe_subscription_id"]
    _do_stripe(_stripe().Subscription.modify, stripe_sub_id, cancel_at_period_end=body.cancel)
    sb.table("subscriptions").update(
        {"cancel_at_period_end": body.cancel, "updated_at": _ts_to_iso(int_now())}
    ).eq("organization_id", org_id).eq("stripe_subscription_id", stripe_sub_id).execute()
    return {"cancel_at_period_end": body.cancel}


@router.get("/subscription")
def get_subscription(current_user=Depends(get_current_user)):
    sb = get_supabase()
    org_id = _billing_org_id(current_user.id)
    sub = _current_subscription_row(org_id)
    if not sub:
        return {"plan": "free", "status": "none", "addons": []}

    addons = (
        sb.table("subscription_addons")
        .select("addon_key, quantity")
        .eq("organization_id", org_id)
        .execute()
    )
    return {
        "plan": sub["plan"],
        "status": sub["status"],
        "interval": sub["interval"],
        "current_period_end": sub["current_period_end"],
        "cancel_at_period_end": sub["cancel_at_period_end"],
        "addons": addons.data or [],
    }


# ── Guest checkout (pay first, create account after) ─────────────────────────

class GuestSubscribeRequest(BaseModel):
    email: str
    plan: str
    interval: str = "month"
    addons: list[AddonInput] = []


class ActivateRequest(BaseModel):
    stripe_subscription_id: str


def _get_or_create_stripe_customer_for_email(email: str) -> str:
    """Find or create a Stripe customer purely by email, no Supabase lookup."""
    s = _stripe()
    result = _do_stripe(s.Customer.search, query=f"email:'{email}'", limit=1)
    customers = (result.get("data") or []) if isinstance(result, dict) else (getattr(result, "data", None) or [])
    for c in customers:
        meta = (c.get("metadata") or {}) if isinstance(c, dict) else (getattr(c, "metadata", None) or {})
        # Only reuse guest customers — skip ones already linked to a Supabase org.
        if not meta.get("organization_id"):
            return c["id"] if isinstance(c, dict) else c.id
    customer = _do_stripe(s.Customer.create, email=email, metadata={"guest": "true"})
    return customer["id"] if isinstance(customer, dict) else customer.id


@router.post("/guest-subscribe")
def guest_subscribe(body: GuestSubscribeRequest):
    """Create a Stripe subscription without authentication.

    Returns a client_secret so the frontend can confirm payment via Stripe Elements.
    After the user pays, they create their Supabase account and call /billing/activate
    to bind the subscription to their profile.
    """
    email = (body.email or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="Invalid email address")
    if body.plan not in SELF_SERVE_PLANS:
        raise HTTPException(status_code=400, detail=f"Plan '{body.plan}' is not self-serve")
    if body.interval not in _VALID_INTERVALS:
        raise HTTPException(status_code=400, detail="interval must be 'month' or 'year'")

    s = _stripe()
    try:
        items = [{"price": get_plan_price_id(body.plan, body.interval)}]
        for addon in body.addons:
            if addon.key not in SUBSCRIPTION_ADDONS:
                raise HTTPException(status_code=400, detail=f"Unknown add-on '{addon.key}'")
            items.append({
                "price": get_addon_price_id(addon.key),
                "quantity": normalize_addon_quantity(addon.key, addon.quantity),
            })
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    customer_id = _get_or_create_stripe_customer_for_email(email)

    subscription = _do_stripe(
        s.Subscription.create,
        customer=customer_id,
        items=items,
        payment_behavior="default_incomplete",
        payment_settings={"save_default_payment_method": "on_subscription"},
        expand=["latest_invoice.confirmation_secret"],
        metadata={"guest_email": email, "plan": body.plan, "guest": "true"},
    )
    sub = _as_dict(subscription)

    invoice = sub.get("latest_invoice") or {}
    confirmation = invoice.get("confirmation_secret") or {}
    client_secret = confirmation.get("client_secret")
    if not client_secret:
        raise HTTPException(status_code=500, detail="Stripe did not return a client secret")

    return {"subscription_id": sub.get("id"), "client_secret": client_secret}


@router.post("/activate")
def activate_subscription(body: ActivateRequest, current_user=Depends(get_current_user)):
    """Link a guest Stripe subscription to the newly-authenticated user.

    Called from /billing/success after the user creates their Supabase account.
    The subscription's guest_email metadata must match the authenticated user's email.
    """
    s = _stripe()
    sb = get_supabase()

    # Expand items so _sync_subscription_to_db can write subscription_addons rows.
    sub = _as_dict(_do_stripe(s.Subscription.retrieve, body.stripe_subscription_id, expand=["items"]))
    metadata = sub.get("metadata") or {}
    guest_email = (metadata.get("guest_email") or "").lower()

    if guest_email != (current_user.email or "").lower():
        raise HTTPException(
            status_code=403,
            detail="Subscription email does not match your account email",
        )

    org_id = _billing_org_id(current_user.id)
    customer_id = sub.get("customer")
    if isinstance(customer_id, dict):
        customer_id = customer_id.get("id")

    # Link Stripe customer to this org so future webhooks can resolve the org.
    _do_stripe(
        s.Customer.modify,
        customer_id,
        metadata={"organization_id": org_id},
    )
    sb.table("org_settings").upsert(
        {
            "organization_id": org_id,
            "stripe_customer_id": customer_id,
            "notification_email": current_user.email or "",
        },
        on_conflict="organization_id",
    ).execute()

    # Full sync: writes subscriptions + subscription_addons + reconciles brand locks.
    # This is what activates the purchased TM/marketplace/domain add-ons so the
    # customer's brand and scan limits reflect exactly what they paid for.
    _sync_subscription_to_db(sub, org_id)

    return {"status": "activated"}


@router.get("/invoices")
def get_invoices(current_user=Depends(get_current_user)):
    sb = get_supabase()
    org_id = _billing_org_id(current_user.id)
    res = (
        sb.table("invoices")
        .select("*")
        .eq("organization_id", org_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return res.data or []


@router.post("/create-portal-session")
def create_portal_session(current_user=Depends(get_current_user)):
    sb = get_supabase()
    org_id = _billing_org_id(current_user.id)
    row = (
        sb.table("org_settings")
        .select("stripe_customer_id")
        .eq("organization_id", org_id)
        .maybe_single()
        .execute()
    )
    customer_id = row.data.get("stripe_customer_id") if row and row.data else None
    if not customer_id:
        raise HTTPException(status_code=404, detail="No Stripe customer for this account")

    session = _do_stripe(
        _stripe().billing_portal.Session.create,
        customer=customer_id,
        return_url=os.environ.get(
            "BILLING_RETURN_URL", "http://localhost:8080/settings/billing"
        ),
    )
    return {"url": session.url}


@router.post("/charge-managed-takedown")
def charge_managed_takedown(
    body: ManagedTakedownRequest, profile: CurrentProfile = Depends(get_current_profile)
):
    """Phase F usage add-on: bill a one-off $500 fee for a successful managed
    takedown. Creates a pending invoice item that rolls onto the customer's next
    invoice — not part of the recurring subscription."""
    # Managed takedown is a Pro/Agency/Enterprise capability — enforce it here,
    # not just in the UI, so the charge can't be triggered from a lower tier.
    if not profile.entitlements.managed_takedown:
        raise HTTPException(
            status_code=403,
            detail=(
                "Managed takedown is available on Pro and above. "
                "Upgrade your plan to have our team handle takedowns for you."
            ),
        )

    sb = get_supabase()
    org_id = profile.organization_id
    row = (
        sb.table("org_settings")
        .select("stripe_customer_id")
        .eq("organization_id", org_id)
        .maybe_single()
        .execute()
    )
    customer_id = row.data.get("stripe_customer_id") if row and row.data else None
    if not customer_id:
        raise HTTPException(status_code=404, detail="No Stripe customer for this account")

    try:
        price_id = get_addon_price_id("addon_managed_takedown")
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Idempotency: a given takedown must only ever be billed once, even if the
    # caller retries. Falls back to no key when takedown_id is absent.
    extra = {}
    if body.takedown_id:
        extra["idempotency_key"] = f"managed_takedown:{org_id}:{body.takedown_id}"

    # Newer Stripe API (Basil): InvoiceItem takes `pricing={"price": ...}`, the
    # flat `price=` parameter was removed.
    item = _do_stripe(
        _stripe().InvoiceItem.create,
        customer=customer_id,
        pricing={"price": price_id},
        metadata={"takedown_id": body.takedown_id or "", "organization_id": org_id},
        **extra,
    )
    return {"invoice_item_id": item.id}


# ── Webhook ──────────────────────────────────────────────────────────────────
@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Verify and process Stripe events. No auth dependency — Stripe authenticates
    via the signature header, and we need the raw request body to verify it."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event["type"]

    # Idempotency: Stripe delivers events at least once and retries. Record each
    # event id and skip if already seen. Degrades gracefully (keeps processing)
    # if the stripe_events table isn't present yet.
    event_id = event["id"]
    if event_id and _billing_v2_ready():
        sb = get_supabase()
        try:
            seen = (
                sb.table("stripe_events").select("id").eq("id", event_id).maybe_single().execute()
            )
            if seen and seen.data:
                return {"received": True, "duplicate": True}
            sb.table("stripe_events").insert({"id": event_id, "type": event_type}).execute()
        except Exception as ex:  # unique-violation race or transient error
            print(f"[billing webhook] dedup check failed (continuing): {ex}")

    obj = _as_dict(event["data"]["object"])

    if event_type in (
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        org_id = (obj.get("metadata") or {}).get("organization_id") or _org_from_customer(
            obj.get("customer")
        )
        if org_id:
            _sync_subscription_to_db(obj, org_id)
        else:
            print(f"[billing webhook] {event_type}: could not resolve org for customer "
                  f"{obj.get('customer')}")
    elif event_type in ("invoice.paid", "invoice.payment_failed"):
        org_id = _org_from_customer(obj.get("customer"))
        if org_id:
            _upsert_invoice(obj, org_id)

    return {"received": True}


# ── DB sync helpers ──────────────────────────────────────────────────────────
def int_now() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp())


def _org_from_customer(customer_id: str | None) -> str | None:
    if not customer_id:
        return None
    sb = get_supabase()
    row = (
        sb.table("org_settings")
        .select("organization_id")
        .eq("stripe_customer_id", customer_id)
        .maybe_single()
        .execute()
    )
    return row.data.get("organization_id") if row and row.data else None


def _sync_subscription_to_db(sub, org_id: str) -> None:
    """Upsert the subscription row + add-ons and mirror the plan onto profiles."""
    sb = get_supabase()
    sub = _as_dict(sub)
    plan, interval = _plan_from_subscription(sub)
    status = sub.get("status")
    canceled = event_status_is_canceled(status)

    sb.table("subscriptions").upsert(
        _with_owner(
            {
                "organization_id": org_id,
                "stripe_customer_id": sub.get("customer"),
                "stripe_subscription_id": sub.get("id"),
                "plan": plan or "free",
                "status": status,
                "interval": interval or "month",
                "current_period_end": _ts_to_iso(_period_end(sub)),
                "cancel_at_period_end": bool(sub.get("cancel_at_period_end")),
                "updated_at": _ts_to_iso(int_now()),
            },
            org_id,
        ),
        on_conflict="stripe_subscription_id",
    ).execute()

    # Reconcile add-on rows for THIS subscription only (not the whole org).
    sub_row = (
        sb.table("subscriptions")
        .select("id")
        .eq("stripe_subscription_id", sub.get("id"))
        .maybe_single()
        .execute()
    )
    sub_pk = sub_row.data["id"] if sub_row and sub_row.data else None
    if sub_pk:
        sb.table("subscription_addons").delete().eq("subscription_id", sub_pk).execute()
        for item in (sub.get("items") or {}).get("data") or []:
            price_id = (item.get("price") or {}).get("id")
            addon_key = price_id_to_addon(price_id) if price_id else None
            if not addon_key:
                continue
            sb.table("subscription_addons").insert(
                _with_owner(
                    {
                        "organization_id": org_id,
                        "subscription_id": sub_pk,
                        "addon_key": addon_key,
                        "stripe_item_id": item.get("id"),
                        "quantity": item.get("quantity") or 1,
                    },
                    org_id,
                )
            ).execute()

    # Mirror the plan onto profiles for quick UI checks. Only downgrade to free
    # on a definitively-canceled status; if the plan can't be resolved from the
    # event (e.g. items not expanded), leave the existing plan untouched.
    if canceled:
        effective_plan = "free"
    elif plan:
        effective_plan = plan
    else:
        effective_plan = None
    if effective_plan is not None:
        sb.table("profiles").update({"plan": effective_plan}).eq(
            "organization_id", org_id
        ).execute()
        # Fallback anchor: org_id may equal the user's own id.
        sb.table("profiles").update({"plan": effective_plan}).eq("id", org_id).execute()

    # Now that the plan + add-ons are persisted, bring the org's brands in line
    # with the new brand entitlement: lock excess on downgrade, unlock on upgrade.
    # Runs for both the checkout-update path and inbound webhooks. Never let a
    # reconcile failure break subscription syncing.
    try:
        reconcile_brand_locks(org_id)
    except Exception as ex:
        print(f"[billing] brand reconcile failed for {org_id}: {ex}")


def event_status_is_canceled(status: str | None) -> bool:
    return status in ("canceled", "unpaid", "incomplete_expired")


def _upsert_invoice(invoice, org_id: str) -> None:
    sb = get_supabase()
    invoice = _as_dict(invoice)
    sb.table("invoices").upsert(
        _with_owner(
            {
                "organization_id": org_id,
                "stripe_invoice_id": invoice.get("id"),
                "amount_due": invoice.get("amount_due") or 0,
                "currency": invoice.get("currency") or "usd",
                "status": invoice.get("status") or "draft",
                "hosted_invoice_url": invoice.get("hosted_invoice_url"),
                "invoice_pdf": invoice.get("invoice_pdf"),
            },
            org_id,
        ),
        on_conflict="stripe_invoice_id",
    ).execute()
