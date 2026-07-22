"""Plan entitlements — the authoritative "what you get for a plan" map.

Billing (``routes/billing.py``) decides *what a customer pays for*; this module
decides *what that unlocks*. Every server-side limit check (brand count, scan
platforms/regions, managed takedown, …) resolves through here so there is a
single source of truth the frontend can mirror but never override.

Effective limits = plan base + purchased add-on quantities. For example a
``growth`` plan (5 brands) with two ``addon_brand`` units resolves to 7 brands.

``None`` for a numeric limit means *unlimited* (serialized as ``null`` for the
frontend, which renders it as "Unlimited").
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from typing import Literal

from tracemark_api.services.database import get_supabase

# Sentinel: a numeric limit of None means "no cap".
UNLIMITED = None

DetectionDepth = Literal["tier0", "tier1", "tier2"]

# Subscription statuses that count as "the customer is entitled right now".
# Mirrors billing.py's _ACTIVE_STATUSES (kept here to avoid a circular import).
_ACTIVE_STATUSES = ("active", "trialing", "past_due")


@dataclass(frozen=True)
class Entitlement:
    """Resolved capabilities for a plan (after add-ons are applied)."""

    plan: str
    #: Max monitored brands. None = unlimited.
    brands: int | None
    #: Max platforms allowed per scan. None = all/unlimited.
    platforms: int | None
    #: Max target regions per scan. None = unlimited.
    regions: int | None
    #: WHOIS / typosquat domain monitoring.
    domain_tracking: bool
    #: Can bill the one-off $500 managed-takedown fee.
    managed_takedown: bool
    #: Programmatic API access (Agency / Enterprise).
    api_access: bool
    #: Branded/scheduled PDF reporting.
    advanced_reports: bool
    #: Real-time (vs weekly/daily) monitoring cadence.
    real_time_scans: bool

    def brand_limit_reached(self, current_count: int) -> bool:
        """True when adding one more brand would exceed the plan."""
        return self.brands is not None and current_count >= self.brands

    def exceeds_platforms(self, requested: int) -> bool:
        return self.platforms is not None and requested > self.platforms

    def exceeds_regions(self, requested: int) -> bool:
        return self.regions is not None and requested > self.regions

    def to_dict(self) -> dict:
        return asdict(self)


# ── Base plan entitlements ────────────────────────────────────────────────────
# Numbers mirror the marketing copy in src/lib/billing.ts. Region allowances are
# a product decision (regions are otherwise sold via addon_region).
PLAN_ENTITLEMENTS: dict[str, Entitlement] = {
    "free": Entitlement(
        plan="free",
        brands=1,
        platforms=1,
        regions=1,
        domain_tracking=False,
        managed_takedown=False,
        api_access=False,
        advanced_reports=False,
        real_time_scans=False,
    ),
    # Self-Serve base: unlocks the platform. Actual brand/platform/domain limits
    # come from the TM / marketplace / domain add-ons the customer purchased.
    "self_serve": Entitlement(
        plan="self_serve",
        brands=0,           # set by addon_self_serve_tm_{n}
        platforms=1,        # Amazon included; marketplace add-on expands this
        regions=UNLIMITED,
        domain_tracking=False,  # enabled by addon_self_serve_domain
        managed_takedown=False,
        api_access=False,
        advanced_reports=True,  # branded PDF reports included
        real_time_scans=False,  # daily monitoring
    ),
    "starter": Entitlement(
        plan="starter",
        brands=1,
        platforms=3,
        regions=1,
        domain_tracking=False,
        managed_takedown=False,
        api_access=False,
        advanced_reports=False,
        real_time_scans=False,
    ),
    "growth": Entitlement(
        plan="growth",
        brands=5,
        platforms=12,
        regions=3,
        domain_tracking=False,
        managed_takedown=False,
        api_access=False,
        advanced_reports=False,
        real_time_scans=False,
    ),
    "pro": Entitlement(
        plan="pro",
        brands=20,
        platforms=12,
        regions=10,
        domain_tracking=True,
        managed_takedown=True,
        api_access=False,
        advanced_reports=False,
        real_time_scans=True,
    ),
    "agency": Entitlement(
        plan="agency",
        brands=UNLIMITED,
        platforms=12,
        regions=UNLIMITED,
        domain_tracking=True,
        managed_takedown=True,
        api_access=True,
        advanced_reports=True,
        real_time_scans=True,
    ),
    "enterprise": Entitlement(
        plan="enterprise",
        brands=UNLIMITED,
        platforms=12,
        regions=UNLIMITED,
        domain_tracking=True,
        managed_takedown=True,
        api_access=True,
        advanced_reports=True,
        real_time_scans=True,
    ),
}

# Add-on key -> which capability it augments.
_ADDON_BRAND = "addon_brand"
_ADDON_REGION = "addon_region"
_ADDON_DOMAINS = "addon_domains"
_ADDON_REPORTS = "addon_reports"

# Self-serve add-on keys.
_SELF_SERVE_TM_KEYS = {f"addon_self_serve_tm_{n}": n for n in range(1, 6)}
_ADDON_SS_MARKETPLACE = "addon_self_serve_marketplace"
_ADDON_SS_DOMAIN = "addon_self_serve_domain"


def base_entitlement(plan: str | None) -> Entitlement:
    """Base entitlement for a plan key, defaulting to the free tier."""
    return PLAN_ENTITLEMENTS.get(plan or "free", PLAN_ENTITLEMENTS["free"])


def compute_entitlements(
    plan: str | None,
    addons: list[dict] | None = None,
) -> Entitlement:
    """Resolve effective entitlements = plan base + purchased add-ons.

    ``addons`` is a list of rows like ``{"addon_key": "addon_brand",
    "quantity": 2}`` (the shape stored in ``subscription_addons``).
    """
    ent = base_entitlement(plan)

    # Collapse addon rows to key -> total quantity (defensive against dupes).
    quantities: dict[str, int] = {}
    for row in addons or []:
        key = row.get("addon_key")
        if not key:
            continue
        quantities[key] = quantities.get(key, 0) + int(row.get("quantity") or 0)

    changes: dict = {}

    # ── Self-Serve add-ons ────────────────────────────────────────────────────
    # TM tier (mutually exclusive): one key maps to an absolute brand count.
    for tm_key, tm_count in _SELF_SERVE_TM_KEYS.items():
        if quantities.get(tm_key):
            changes["brands"] = tm_count
            break

    # Marketplace: 1 (Amazon, always in base) + number of extra platforms purchased.
    if quantities.get(_ADDON_SS_MARKETPLACE):
        changes["platforms"] = 1 + quantities[_ADDON_SS_MARKETPLACE]

    # Domain protection toggle.
    if quantities.get(_ADDON_SS_DOMAIN):
        changes["domain_tracking"] = True

    # ── Legacy add-ons ────────────────────────────────────────────────────────
    # Extra brands stack onto the base cap (unless already unlimited or already
    # set by a self_serve TM add-on above).
    if "brands" not in changes and ent.brands is not None and quantities.get(_ADDON_BRAND):
        changes["brands"] = ent.brands + quantities[_ADDON_BRAND]

    # Extra regions stack onto the base cap (unless already unlimited).
    if ent.regions is not None and quantities.get(_ADDON_REGION):
        changes["regions"] = ent.regions + quantities[_ADDON_REGION]

    # Feature-unlock add-ons flip the corresponding flag on.
    if quantities.get(_ADDON_DOMAINS):
        changes["domain_tracking"] = True
    if quantities.get(_ADDON_REPORTS):
        changes["advanced_reports"] = True

    return replace(ent, **changes) if changes else ent


# ── DB resolution ─────────────────────────────────────────────────────────────
# These read the authoritative plan (from `subscriptions`) + purchased add-ons
# (from `subscription_addons`) for an org. Kept here — not in billing.py — so
# both dependencies.py and billing.py can import them without a circular import.

def resolve_org_id(user_id: str) -> str:
    """Billing anchor for a user: their organization, or their own id as a
    single-member fallback when no organization is configured."""
    sb = get_supabase()
    res = (
        sb.table("profiles")
        .select("organization_id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    org_id = res.data.get("organization_id") if res and res.data else None
    return org_id or user_id


def _active_plan_for_org(org_id: str) -> str:
    """The org's current plan key. Prefers an active/trialing/past_due
    subscription row; falls back to profiles.plan, then 'free'."""
    sb = get_supabase()
    subs = (
        sb.table("subscriptions")
        .select("plan, status, created_at")
        .eq("organization_id", org_id)
        .order("created_at", desc=True)
        .execute()
    )
    rows = subs.data or []
    for row in rows:
        if row.get("status") in _ACTIVE_STATUSES and row.get("plan"):
            return row["plan"]

    # No active subscription — fall back to the mirrored profiles.plan.
    prof = (
        sb.table("profiles")
        .select("plan")
        .eq("id", org_id)
        .maybe_single()
        .execute()
    )
    plan = prof.data.get("plan") if prof and prof.data else None
    return plan or "free"


def _addons_for_org(org_id: str) -> list[dict]:
    sb = get_supabase()
    res = (
        sb.table("subscription_addons")
        .select("addon_key, quantity")
        .eq("organization_id", org_id)
        .execute()
    )
    return res.data or []


def resolve_entitlements_for_org(org_id: str) -> tuple[str, Entitlement]:
    """Return (plan, effective Entitlement) for an org."""
    plan = _active_plan_for_org(org_id)
    return plan, compute_entitlements(plan, _addons_for_org(org_id))


def resolve_entitlements_for_user(user_id: str) -> tuple[str, str, Entitlement]:
    """Return (org_id, plan, effective Entitlement) for a user, based on their org's
    active subscription. Users with is_admin=True automatically resolve to enterprise."""
    sb = get_supabase()
    res = (
        sb.table("profiles")
        .select("organization_id, is_admin")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    profile_data = res.data if (res and res.data) else {}
    org_id = profile_data.get("organization_id") or user_id

    if profile_data.get("is_admin"):
        ent = compute_entitlements("enterprise", [])
        return org_id, "enterprise", ent

    plan, ent = resolve_entitlements_for_org(org_id)
    return org_id, plan, ent


def resolve_detection_depth(ent: Entitlement) -> DetectionDepth:
    """Return the maximum detection tier the caller's plan allows.

    Currently returns the full funnel ('tier2') for all plans. When
    plan-gating is enabled, this becomes the single switch point:
      free/starter -> 'tier0'
      growth       -> 'tier1'
      pro+         -> 'tier2'
    No funnel rework is needed — callers already branch on this value.
    """
    return "tier2"


# ── Downgrade/upgrade reconciliation ─────────────────────────────────────────
_SLOT_STATUSES = ("active", "on_hold")


def reconcile_brand_locks(org_id: str) -> dict:
    """Bring an org's brands in line with its current brand entitlement.

    Called after any plan/add-on change (checkout update + webhook). Policy:
    - Downgrade / fewer add-ons → lock the *oldest* excess brands (newest stay
      active), so the user keeps their most recent work and chooses what to drop.
    - Upgrade / more add-ons → unlock previously locked brands (newest first) up
      to the freed capacity.

    Returns a small summary ``{"locked": [...ids], "unlocked": [...ids]}``.
    Never raises on the happy path; the brands table may not exist pre-migration,
    in which case it degrades to a no-op.
    """
    plan, ent = resolve_entitlements_for_org(org_id)
    sb = get_supabase()

    try:
        res = (
            sb.table("brands")
            .select("id, status, created_at")
            .eq("organization_id", org_id)
            .order("created_at", desc=False)  # oldest first
            .execute()
        )
    except Exception as ex:  # table missing pre-migration, etc.
        print(f"[entitlements] reconcile skipped for {org_id}: {ex}")
        return {"locked": [], "unlocked": []}

    brands = res.data or []
    limit = ent.brands  # None = unlimited

    occupying = [b for b in brands if b.get("status") in _SLOT_STATUSES]
    locked = [b for b in brands if b.get("status") == "locked"]

    locked_ids: list[str] = []
    unlocked_ids: list[str] = []

    if limit is None:
        # Unlimited plan — restore everything that was frozen.
        unlocked_ids = [b["id"] for b in locked]
    elif len(occupying) > limit:
        # Over the cap — lock the oldest excess (list is oldest-first).
        excess = len(occupying) - limit
        locked_ids = [b["id"] for b in occupying[:excess]]
    elif locked and len(occupying) < limit:
        # Room freed up — unlock most-recently-created locked brands first.
        slots = limit - len(occupying)
        newest_locked = sorted(locked, key=lambda b: b.get("created_at") or "", reverse=True)
        unlocked_ids = [b["id"] for b in newest_locked[:slots]]

    if locked_ids:
        sb.table("brands").update({"status": "locked"}).in_("id", locked_ids).execute()
    if unlocked_ids:
        sb.table("brands").update({"status": "active"}).in_("id", unlocked_ids).execute()

    return {"locked": locked_ids, "unlocked": unlocked_ids}
