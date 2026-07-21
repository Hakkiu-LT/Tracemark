"""Customer management across ALL organizations (service-role, bypasses RLS).

List/detail migrate the old main-API /admin/users logic; edit/delete are new
full-control actions. Plan changes and subscription actions live in billing_admin.py.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from tracemark_admin_api.clients import customer_sb
from tracemark_admin_api.dependencies import (
    StaffPrincipal,
    require_permission,
    require_super_admin,
)
from tracemark_admin_api.services.audit import write_audit_log
from tracemark_admin_api.services.impersonation import generate_impersonation_link

router = APIRouter(prefix="/customers", tags=["customers"])


class CustomerRow(BaseModel):
    id: str
    email: str
    full_name: str | None
    organization_id: str | None
    plan: str
    is_admin: bool
    persona: str | None = None


class CustomerDetail(CustomerRow):
    brands: list[dict]
    subscription: dict | None
    invoices: list[dict]


class UpdateCustomerRequest(BaseModel):
    full_name: str | None = None
    persona: str | None = None  # "brand_owner" | "law_firm"
    email: str | None = None
    password: str | None = None  # optional: set a new login password for the customer


def _email_map(sb) -> dict[str, str]:
    users = sb.auth.admin.list_users()
    return {u.id: (u.email or "") for u in users}


def _persona_by_org(sb) -> dict[str, str | None]:
    rows = sb.table("org_settings").select("organization_id, persona").execute().data or []
    return {r["organization_id"]: r.get("persona") for r in rows}


@router.get("", response_model=list[CustomerRow])
def list_customers(staff: StaffPrincipal = Depends(require_permission("customers.view"))):
    """Every registered customer with email, plan, org and workspace persona."""
    sb = customer_sb()
    emails = _email_map(sb)
    personas = _persona_by_org(sb)
    profiles = (
        sb.table("profiles")
        .select("id, full_name, organization_id, plan, is_admin")
        .execute()
        .data
        or []
    )
    out: list[CustomerRow] = []
    for p in profiles:
        org_id = p.get("organization_id")
        out.append(
            CustomerRow(
                id=p["id"],
                email=emails.get(p["id"], "unknown@example.com"),
                full_name=p.get("full_name"),
                organization_id=org_id,
                plan=p.get("plan", "free"),
                is_admin=bool(p.get("is_admin", False)),
                persona=personas.get(org_id) if org_id else None,
            )
        )
    return out


@router.get("/{user_id}", response_model=CustomerDetail)
def get_customer(
    user_id: str,
    staff: StaffPrincipal = Depends(require_permission("customers.view")),
):
    sb = customer_sb()
    prof = sb.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    if not prof or not prof.data:
        raise HTTPException(status_code=404, detail="Customer not found")
    p = prof.data
    org_id = p.get("organization_id")

    emails = _email_map(sb)
    personas = _persona_by_org(sb)

    # Billing is anchored on organization_id, falling back to the user's own id for
    # single-member accounts (mirrors the main API's _billing_org_id behavior).
    billing_anchor = org_id or user_id

    brands = (
        sb.table("brands").select("*").eq("organization_id", org_id).execute().data
        if org_id
        else []
    ) or []
    sub_res = (
        sb.table("subscriptions")
        .select("*")
        .eq("organization_id", billing_anchor)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    subscription = sub_res.data[0] if sub_res.data else None
    invoices = (
        sb.table("invoices")
        .select("*")
        .eq("organization_id", billing_anchor)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )

    return CustomerDetail(
        id=p["id"],
        email=emails.get(p["id"], "unknown@example.com"),
        full_name=p.get("full_name"),
        organization_id=org_id,
        plan=p.get("plan", "free"),
        is_admin=bool(p.get("is_admin", False)),
        persona=personas.get(org_id) if org_id else None,
        brands=brands,
        subscription=subscription,
        invoices=invoices,
    )


@router.patch("/{user_id}", response_model=CustomerRow)
def update_customer(
    user_id: str,
    payload: UpdateCustomerRequest,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    """Edit customer profile fields and/or workspace persona.

    Persona lives on org_settings (migrates the old /admin/users/{id}/workspace).
    """
    sb = customer_sb()
    prof = (
        sb.table("profiles")
        .select("full_name, organization_id, plan, is_admin")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not prof or not prof.data:
        raise HTTPException(status_code=404, detail="Customer not found")
    before = prof.data
    org_id = before.get("organization_id")

    if payload.full_name is not None:
        sb.table("profiles").update({"full_name": payload.full_name}).eq("id", user_id).execute()

    if payload.persona is not None:
        if payload.persona not in ("brand_owner", "law_firm"):
            raise HTTPException(status_code=400, detail="persona must be brand_owner or law_firm")
        if not org_id:
            raise HTTPException(status_code=400, detail="Customer has no organization assigned")
        sb.table("org_settings").update(
            {"persona": payload.persona, "updated_at": datetime.now(timezone.utc).isoformat()}
        ).eq("organization_id", org_id).execute()

    # Email / password live in auth.users — update via the admin auth API.
    auth_attrs: dict = {}
    if payload.email is not None:
        auth_attrs["email"] = payload.email
        auth_attrs["email_confirm"] = True  # mark verified; no confirmation email
    if payload.password is not None:
        if len(payload.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        auth_attrs["password"] = payload.password
    if auth_attrs:
        try:
            sb.auth.admin.update_user_by_id(user_id, auth_attrs)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=f"Could not update auth account: {exc}")

    # Audit — never store the raw password.
    changes = payload.model_dump(exclude_none=True)
    if "password" in changes:
        changes["password"] = "***changed***"
    write_audit_log(
        staff,
        "customers.edit",
        target_type="customer",
        target_id=user_id,
        target_org_id=org_id,
        metadata={"before": before, "changes": changes},
    )

    # Return the refreshed row.
    return _row_after_update(sb, user_id)


def _row_after_update(sb, user_id: str) -> CustomerRow:
    p = sb.table("profiles").select("*").eq("id", user_id).maybe_single().execute().data
    emails = _email_map(sb)
    personas = _persona_by_org(sb)
    org_id = p.get("organization_id")
    return CustomerRow(
        id=p["id"],
        email=emails.get(p["id"], "unknown@example.com"),
        full_name=p.get("full_name"),
        organization_id=org_id,
        plan=p.get("plan", "free"),
        is_admin=bool(p.get("is_admin", False)),
        persona=personas.get(org_id) if org_id else None,
    )


@router.delete("/{user_id}")
def delete_customer(
    user_id: str,
    staff: StaffPrincipal = Depends(require_super_admin),
):
    """Delete a customer auth user (super-admin only). Related rows cascade via FKs
    on auth.users; org-scoped data is left for a separate cleanup if the org persists."""
    sb = customer_sb()
    prof = sb.table("profiles").select("organization_id").eq("id", user_id).maybe_single().execute()
    org_id = prof.data.get("organization_id") if prof and prof.data else None
    try:
        sb.auth.admin.delete_user(user_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not delete customer: {exc}")

    write_audit_log(
        staff, "customers.delete", target_type="customer", target_id=user_id, target_org_id=org_id
    )
    return {"success": True}


@router.post("/{user_id}/impersonate")
def impersonate_customer(
    user_id: str,
    staff: StaffPrincipal = Depends(require_super_admin),
):
    """Generate a short-lived magic link to log in as the customer (super-admin only)."""
    # require_super_admin already enforces super-admin; belt-and-braces on the permission.
    if not staff.has("customers.impersonate"):
        raise HTTPException(status_code=403, detail="Missing permission: customers.impersonate")

    result = generate_impersonation_link(user_id)
    write_audit_log(
        staff,
        "customers.impersonate",
        target_type="customer",
        target_id=user_id,
        metadata={"email": result.get("email")},
    )
    return result
