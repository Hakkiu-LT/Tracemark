"""Customer management across ALL organizations (service-role, bypasses RLS).

List/detail migrate the old main-API /admin/users logic; create/edit/delete are
new full-control actions.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
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


HAKKIU_ORG_ID = "00000000-0000-0000-0000-000000000000"


class CustomerRow(BaseModel):
    id: str
    email: str
    full_name: str | None
    organization_id: str | None
    home_organization_id: str | None = None
    org_role: str | None = None
    persona: str | None = None


class CustomerDetail(CustomerRow):
    brands: list[dict]


class CreateCustomerRequest(BaseModel):
    email: str
    password: str
    full_name: str | None = None
    organization_id: str | None = None  # optional: attach to an existing org
    org_role: str = "member"


class UpdateCustomerRequest(BaseModel):
    full_name: str | None = None
    persona: str | None = None  # "brand_owner" | "law_firm"
    email: str | None = None
    password: str | None = None  # optional: set a new login password for the customer
    organization_id: str | None = None
    org_role: str | None = None


def _email_map(sb) -> dict[str, str]:
    users = sb.auth.admin.list_users(page=1, per_page=1000)
    return {u.id: (u.email or "") for u in users}


def _persona_by_org(sb) -> dict[str, str | None]:
    rows = sb.table("org_settings").select("organization_id, persona").execute().data or []
    return {r["organization_id"]: r.get("persona") for r in rows}


def _org_role_map(sb) -> dict[tuple[str, str], str]:
    """Map of (org_id, user_id) -> role from organization_members."""
    rows = sb.table("organization_members").select("organization_id, user_id, role").execute().data or []
    return {(r["organization_id"], r["user_id"]): r.get("role", "member") for r in rows}


@router.get("", response_model=list[CustomerRow])
def list_customers(staff: StaffPrincipal = Depends(require_permission("customers.view"))):
    """Every registered customer with email, org and workspace persona."""
    sb = customer_sb()
    emails = _email_map(sb)
    personas = _persona_by_org(sb)
    role_map = _org_role_map(sb)
    profiles = (
        sb.table("profiles")
        .select("id, full_name, organization_id, home_organization_id")
        .limit(1000)
        .execute()
        .data
        or []
    )
    out: list[CustomerRow] = []
    for p in profiles:
        org_id = p.get("organization_id")
        if org_id == HAKKIU_ORG_ID:
            continue  # Skip Hakkiu staff
        user_id = p["id"]
        out.append(
            CustomerRow(
                id=user_id,
                email=emails.get(user_id, "unknown@example.com"),
                full_name=p.get("full_name"),
                organization_id=org_id,
                home_organization_id=p.get("home_organization_id"),
                org_role=role_map.get((org_id, user_id)) if org_id else None,
                persona=personas.get(org_id) if org_id else None,
            )
        )
    return out


@router.post("", response_model=CustomerRow)
def create_customer(
    request: Request,
    payload: CreateCustomerRequest,
    staff: StaffPrincipal = Depends(require_permission("customers.create")),
):
    """Create a customer dashboard login (auth user) in the customer Supabase project.

    A DB trigger auto-creates the matching profiles row. If organization_id is given,
    the profile is anchored to that org via assign_user_to_group RPC.
    """
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    sb = customer_sb()

    # 1. Optionally validate the target org up front.
    if payload.organization_id:
        if payload.organization_id == HAKKIU_ORG_ID:
            raise HTTPException(status_code=400, detail="Cannot assign customer to internal Hakkiu organization")
        org = (
            sb.table("organizations").select("id").eq("id", payload.organization_id)
            .maybe_single().execute()
        )
        if not org or not org.data:
            raise HTTPException(status_code=404, detail="Organization not found")

    # 2. Create the auth user (email confirmed, no confirmation email).
    try:
        created = sb.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
            }
        )
        new_id = created.user.id
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not create auth user: {exc}")

    # 3. Populate name on the trigger-created profile, and attach to org if specified.
    if payload.full_name is not None:
        sb.table("profiles").update({"full_name": payload.full_name}).eq("id", new_id).execute()

    if payload.organization_id:
        try:
            sb.rpc("assign_user_to_group", {
                "p_user_id": new_id,
                "p_org_id": payload.organization_id,
                "p_role": payload.org_role or "member",
            }).execute()
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not assign to group: {exc}")

    write_audit_log(
        staff,
        "customer.create",
        target_type="customer",
        target_id=new_id,
        target_org_id=payload.organization_id,
        metadata={"email": payload.email, "organization_id": payload.organization_id, "role": payload.org_role},
        ip=request.client.host if request.client else None,
    )
    return _row_after_update(sb, new_id)


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
    role_map = _org_role_map(sb)

    brands = (
        sb.table("brands").select("*").eq("organization_id", org_id).execute().data
        if org_id
        else []
    ) or []

    return CustomerDetail(
        id=p["id"],
        email=emails.get(p["id"], "unknown@example.com"),
        full_name=p.get("full_name"),
        organization_id=org_id,
        home_organization_id=p.get("home_organization_id"),
        org_role=role_map.get((org_id, user_id)) if org_id else None,
        persona=personas.get(org_id) if org_id else None,
        brands=brands,
    )


@router.patch("/{user_id}", response_model=CustomerRow)
def update_customer(
    user_id: str,
    request: Request,
    payload: UpdateCustomerRequest,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    """Edit customer profile fields, organization assignment, or workspace persona."""
    sb = customer_sb()
    prof = (
        sb.table("profiles")
        .select("full_name, organization_id, home_organization_id")
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

    if payload.organization_id is not None:
        if payload.organization_id == HAKKIU_ORG_ID:
            raise HTTPException(status_code=400, detail="Cannot assign customer to internal Hakkiu organization")
        target_role = payload.org_role or "member"
        try:
            sb.rpc("assign_user_to_group", {
                "p_user_id": user_id,
                "p_org_id": payload.organization_id,
                "p_role": target_role,
            }).execute()
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not assign to group: {exc}")
        org_id = payload.organization_id
    elif payload.org_role is not None and org_id:
        if payload.org_role not in ("owner", "member"):
            raise HTTPException(status_code=400, detail=f"Invalid role: {payload.org_role}")
        sb.table("organization_members").update({"role": payload.org_role}).eq("organization_id", org_id).eq("user_id", user_id).execute()

    if payload.persona is not None:
        if payload.persona not in ("brand_owner", "law_firm"):
            raise HTTPException(status_code=400, detail="persona must be brand_owner or law_firm")
        if not org_id:
            raise HTTPException(status_code=400, detail="Customer has no organization assigned")
        sb.table("org_settings").update(
            {"persona": payload.persona, "updated_at": datetime.now(timezone.utc).isoformat()}
        ).eq("organization_id", org_id).execute()

    # Email / password live in auth.users — update via the admin auth API only if changed.
    auth_attrs: dict = {}
    if payload.email is not None:
        emails_map = _email_map(sb)
        current_email = emails_map.get(user_id, "")
        if payload.email.strip().lower() != current_email.strip().lower():
            auth_attrs["email"] = payload.email.strip()
            auth_attrs["email_confirm"] = True  # mark verified; no confirmation email
    if payload.password is not None and payload.password.strip():
        if len(payload.password.strip()) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        auth_attrs["password"] = payload.password.strip()
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
        ip=request.client.host if request.client else None,
    )

    # Return the refreshed row.
    return _row_after_update(sb, user_id)


def _row_after_update(sb, user_id: str) -> CustomerRow:
    p = sb.table("profiles").select("*").eq("id", user_id).maybe_single().execute().data
    emails = _email_map(sb)
    personas = _persona_by_org(sb)
    role_map = _org_role_map(sb)
    org_id = p.get("organization_id")
    return CustomerRow(
        id=p["id"],
        email=emails.get(p["id"], "unknown@example.com"),
        full_name=p.get("full_name"),
        organization_id=org_id,
        home_organization_id=p.get("home_organization_id"),
        org_role=role_map.get((org_id, user_id)) if org_id else None,
        persona=personas.get(org_id) if org_id else None,
    )


@router.delete("/{user_id}")
def delete_customer(
    user_id: str,
    request: Request,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    """Delete a customer auth user and clean up their profile & memberships."""
    sb = customer_sb()
    prof = sb.table("profiles").select("organization_id, home_organization_id").eq("id", user_id).maybe_single().execute()
    org_id = prof.data.get("organization_id") if prof and prof.data else None
    home_org_id = prof.data.get("home_organization_id") if prof and prof.data else None

    # Fail-closed: record the deletion BEFORE it happens
    write_audit_log(
        staff, "customers.delete", target_type="customer", target_id=user_id, target_org_id=org_id,
        ip=request.client.host if request.client else None, critical=True,
    )

    try:
        # 1. Unlink cases user_id
        try:
            sb.table("cases").update({"user_id": None}).eq("user_id", user_id).execute()
        except Exception:
            pass

        # 2. Remove organization_members and profile
        try:
            sb.table("organization_members").delete().eq("user_id", user_id).execute()
        except Exception:
            pass

        try:
            sb.table("profiles").delete().eq("id", user_id).execute()
        except Exception:
            pass

        # 3. Clean up personal org if empty
        if home_org_id and home_org_id != HAKKIU_ORG_ID:
            try:
                m_res = sb.table("organization_members").select("user_id").eq("organization_id", home_org_id).execute()
                b_res = sb.table("brands").select("id").eq("organization_id", home_org_id).execute()
                if not (m_res.data or []) and not (b_res.data or []):
                    sb.table("org_settings").delete().eq("organization_id", home_org_id).execute()
                    sb.table("organizations").delete().eq("id", home_org_id).execute()
            except Exception:
                pass

        # 4. Delete auth user
        sb.auth.admin.delete_user(user_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not delete customer: {exc}")
    return {"success": True}


@router.post("/{user_id}/impersonate")
def impersonate_customer(
    user_id: str,
    request: Request,
    staff: StaffPrincipal = Depends(require_super_admin),
):
    """Generate a short-lived magic link to log in as the customer (super-admin only)."""
    # require_super_admin already enforces super-admin; belt-and-braces on the permission.
    if not staff.has("customers.impersonate"):
        raise HTTPException(status_code=403, detail="Missing permission: customers.impersonate")

    # Fail-closed: record the impersonation BEFORE minting the link, so a staffer
    # can never assume a customer's identity without an audit trail (if the audit
    # write fails, critical=True raises and no link is generated).
    write_audit_log(
        staff,
        "customers.impersonate",
        target_type="customer",
        target_id=user_id,
        ip=request.client.host if request.client else None,
        critical=True,
    )
    result = generate_impersonation_link(user_id)
    return result
