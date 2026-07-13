"""Monitored brands ("marks") CRUD, with plan-limit enforcement.

Brands are the unit that plan tiers cap ("1 brand", "5 brands", "20 brands").
Persisting them here — instead of only in the browser's Zustand store — gives
the server an authoritative count so ``POST /brands`` can refuse to create more
than the caller's entitlement allows (base plan + ``addon_brand`` quantity).

Slot accounting: ``active`` and ``on_hold`` brands consume a slot; ``locked``
brands (the excess frozen by a downgrade) do not — see services/entitlements.py
and the reconcile step in routes/billing.py.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from tracemark_api.dependencies import CurrentProfile, get_current_profile
from tracemark_api.services.database import get_supabase

router = APIRouter(prefix="/brands", tags=["brands"])

# Statuses that occupy a plan slot (locked = excess, doesn't count).
_SLOT_STATUSES = ("active", "on_hold")


class BrandCreate(BaseModel):
    brand_name: str
    website: str | None = None
    registration_number: str | None = None
    platforms: list[str] = []
    target_regions: list[str] = []
    logo_color: str | None = None
    client_id: str | None = None


class BrandUpdate(BaseModel):
    brand_name: str | None = None
    website: str | None = None
    registration_number: str | None = None
    platforms: list[str] | None = None
    target_regions: list[str] | None = None
    logo_color: str | None = None
    status: str | None = None


def _count_active_brands(org_id: str) -> int:
    """How many brands currently occupy a plan slot for this org."""
    sb = get_supabase()
    res = (
        sb.table("brands")
        .select("id", count="exact")
        .eq("organization_id", org_id)
        .in_("status", list(_SLOT_STATUSES))
        .execute()
    )
    if getattr(res, "count", None) is not None:
        return res.count
    return len(res.data or [])


def _brand_or_404(org_id: str, brand_id: str) -> dict:
    sb = get_supabase()
    res = (
        sb.table("brands")
        .select("*")
        .eq("id", brand_id)
        .eq("organization_id", org_id)
        .maybe_single()
        .execute()
    )
    row = res.data if res else None
    if not row:
        raise HTTPException(status_code=404, detail="Brand not found")
    return row


@router.get("")
def list_brands(profile: CurrentProfile = Depends(get_current_profile)):
    """All brands for the caller's org, plus current usage vs. the plan limit."""
    sb = get_supabase()
    res = (
        sb.table("brands")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", desc=True)
        .execute()
    )
    brands = res.data or []
    limit = profile.entitlements.brands
    used = sum(1 for b in brands if b.get("status") in _SLOT_STATUSES)
    return {
        "brands": brands,
        "usage": {"used": used, "limit": limit},
    }


@router.post("")
def create_brand(
    body: BrandCreate, profile: CurrentProfile = Depends(get_current_profile)
):
    ent = profile.entitlements
    used = _count_active_brands(profile.organization_id)
    if ent.brand_limit_reached(used):
        raise HTTPException(
            status_code=402,
            detail=(
                f"Your {profile.plan} plan includes {ent.brands} "
                f"brand{'s' if (ent.brands or 0) != 1 else ''}. "
                "Add the 'Extra brands' add-on or upgrade your plan to monitor more."
            ),
        )

    sb = get_supabase()
    payload = {
        "organization_id": profile.organization_id,
        "user_id": profile.id,
        "client_id": body.client_id,
        "brand_name": body.brand_name,
        "website": body.website,
        "registration_number": body.registration_number,
        "platforms": body.platforms,
        "target_regions": body.target_regions,
        "logo_color": body.logo_color,
        "status": "active",
    }
    res = sb.table("brands").insert(payload).execute()
    created = (res.data or [None])[0]
    return created


@router.patch("/{brand_id}")
def update_brand(
    brand_id: str,
    body: BrandUpdate,
    profile: CurrentProfile = Depends(get_current_profile),
):
    existing = _brand_or_404(profile.organization_id, brand_id)

    updates: dict = {}
    for field in (
        "brand_name",
        "website",
        "registration_number",
        "platforms",
        "target_regions",
        "logo_color",
    ):
        val = getattr(body, field)
        if val is not None:
            updates[field] = val

    if body.status is not None:
        if body.status not in ("active", "locked", "on_hold"):
            raise HTTPException(
                status_code=400, detail=f"Invalid status '{body.status}'"
            )
        # Re-activating a locked brand must respect the current plan limit.
        if body.status == "active" and existing.get("status") == "locked":
            ent = profile.entitlements
            if ent.brand_limit_reached(_count_active_brands(profile.organization_id)):
                raise HTTPException(
                    status_code=402,
                    detail=(
                        f"Your {profile.plan} plan is at its brand limit "
                        f"({ent.brands}). Upgrade or remove a brand to unlock this one."
                    ),
                )
        updates["status"] = body.status

    if not updates:
        return existing

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    sb = get_supabase()
    res = (
        sb.table("brands")
        .update(updates)
        .eq("id", brand_id)
        .eq("organization_id", profile.organization_id)
        .execute()
    )
    return (res.data or [existing])[0]


@router.delete("/{brand_id}")
def delete_brand(brand_id: str, profile: CurrentProfile = Depends(get_current_profile)):
    _brand_or_404(profile.organization_id, brand_id)
    sb = get_supabase()
    sb.table("brands").delete().eq("id", brand_id).eq(
        "organization_id", profile.organization_id
    ).execute()
    return {"deleted": True, "id": brand_id}
