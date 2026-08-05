"""Customer management across ALL organizations (service-role, bypasses RLS).

List/detail migrate the old main-API /admin/users logic; create/edit/delete are
new full-control actions.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from tracemark_admin_api import main_api
from tracemark_admin_api.clients import admin_sb, customer_sb
from tracemark_admin_api.dependencies import (
    StaffPrincipal,
    require_permission,
    require_super_admin,
)
from tracemark_admin_api.services.audit import write_audit_log
from tracemark_admin_api.services.auth_users import (
    email_map,
    find_auth_user_by_email,
    get_email,
    is_orphan_auth_user,
)
from tracemark_admin_api.services.impersonation import (
    generate_impersonation_link,
    generate_recovery_link,
)

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
    # Optional: leave blank to create a passwordless login and email the customer a
    # set-password link instead (requires send_invite=true).
    password: str | None = None
    full_name: str | None = None
    organization_id: str | None = None  # optional: attach to an existing org
    org_role: str = "member"
    send_invite: bool = False  # email the customer a set-password link after creating


class UpdateCustomerRequest(BaseModel):
    full_name: str | None = None
    persona: str | None = None  # "brand_owner" | "law_firm"
    email: str | None = None
    password: str | None = None  # optional: set a new login password for the customer
    organization_id: str | None = None
    org_role: str | None = None


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
    emails = email_map(sb)
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

    Password is optional: leave it blank with send_invite=true to create a passwordless
    login and email the customer a set-password link (recovery) instead of the staffer
    inventing and hand-delivering a password.
    """
    pw = (payload.password or "").strip()
    if pw and len(pw) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not pw and not payload.send_invite:
        raise HTTPException(
            status_code=400,
            detail="Set a password, or enable 'send invite link' so the customer can set their own.",
        )
    # A random password lets us create the auth user even when staff didn't set one; the
    # customer replaces it via the invite link. It is NEVER returned, logged, or audited.
    effective_password = pw or secrets.token_urlsafe(24)

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

    # 2a. If this email is still registered in auth.users, decide what to do.
    #     An "orphan" login (no profile, no memberships) is invisible in the admin
    #     UI, so staff cannot delete it the normal way — yet it blocks re-creation
    #     with a confusing "already registered" error. Clean it up automatically.
    existing = find_auth_user_by_email(sb, payload.email)
    if existing is not None:
        if is_orphan_auth_user(sb, existing.id):
            try:
                sb.auth.admin.delete_user(existing.id)
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(
                    status_code=400,
                    detail=f"Email is registered to an orphaned login that could not be removed: {exc}",
                )
            write_audit_log(
                staff,
                "customer.orphan_cleanup",
                target_type="customer",
                target_id=existing.id,
                metadata={"email": payload.email, "reason": "orphan auth user blocking recreation"},
                ip=request.client.host if request.client else None,
            )
        else:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This email already belongs to an active user. Delete that user from "
                    "their customer page first, or attach them via 'Add member' instead of "
                    "creating a new login."
                ),
            )

    # 2b. Create the auth user (email confirmed, no confirmation email).
    try:
        created = sb.auth.admin.create_user(
            {
                "email": payload.email,
                "password": effective_password,
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
            # Atomicity: we just created this auth user; if attaching it to the org fails,
            # roll the login back so we don't leak an orphan auth user (no profile/no org)
            # that would block re-creating the same email later.
            try:
                sb.auth.admin.delete_user(new_id)
            except Exception:  # noqa: BLE001 — best-effort cleanup
                pass
            raise HTTPException(status_code=400, detail=f"Could not assign to group: {exc}")

    write_audit_log(
        staff,
        "customer.create",
        target_type="customer",
        target_id=new_id,
        target_org_id=payload.organization_id,
        metadata={
            "email": payload.email,
            "organization_id": payload.organization_id,
            "role": payload.org_role,
            "invited": payload.send_invite,
        },
        ip=request.client.host if request.client else None,
    )

    # Optionally email the customer a set-password link now (best delivery of a new login).
    if payload.send_invite:
        try:
            company_name = None
            if payload.organization_id:
                org_row = (
                    sb.table("organizations").select("name").eq("id", payload.organization_id)
                    .maybe_single().execute()
                )
                company_name = (org_row.data or {}).get("name") if org_row else None
            link = generate_recovery_link(payload.email)
            main_api.send_customer_invite(payload.email, link, company_name)
            write_audit_log(
                staff, "customer.invite_sent", target_type="customer", target_id=new_id,
                target_org_id=payload.organization_id, metadata={"email": payload.email},
                ip=request.client.host if request.client else None,
            )
        except HTTPException:
            # The login exists; only delivery failed. Staff can retry via "Send login link".
            raise HTTPException(
                status_code=502,
                detail="User created, but the invite email couldn't be sent. Use 'Send login link' to retry.",
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

    personas = _persona_by_org(sb)
    role_map = _org_role_map(sb)

    brands = (
        sb.table("brands").select("*").eq("organization_id", org_id).execute().data
        if org_id
        else []
    ) or []

    return CustomerDetail(
        id=p["id"],
        email=get_email(sb, p["id"]) or "unknown@example.com",
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
        current_email = get_email(sb, user_id) or ""
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
    personas = _persona_by_org(sb)
    role_map = _org_role_map(sb)
    org_id = p.get("organization_id")
    return CustomerRow(
        id=p["id"],
        email=get_email(sb, p["id"]) or "unknown@example.com",
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

    # Guard: never destroy a staff/super-admin login through the customer delete.
    # Staff can be *attached* to a company for testing; removing them there must only
    # detach the membership (handled by the org "Remove" path), not nuke their auth user.
    staff_row = admin_sb().table("staff_accounts").select("id").eq("id", user_id).maybe_single().execute()
    if staff_row and staff_row.data:
        raise HTTPException(
            status_code=400,
            detail="This is a staff account. Remove them from the company instead, or manage the login under Staff.",
        )

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


@router.post("/{user_id}/send-invite")
def send_customer_invite(
    user_id: str,
    request: Request,
    staff: StaffPrincipal = Depends(require_permission("customers.invite")),
):
    """Email a customer a set-password ("login") link.

    Sends ONLY to the email currently stored on the account — a caller cannot redirect the
    link elsewhere. The send is audit-logged (critical, written BEFORE the send) with the
    exact target email, so a leaked link is always traceable.
    """
    sb = customer_sb()
    email = get_email(sb, user_id)
    if not email:
        raise HTTPException(status_code=404, detail="Customer not found")

    prof = sb.table("profiles").select("organization_id").eq("id", user_id).maybe_single().execute()
    org_id = (prof.data or {}).get("organization_id") if prof and prof.data else None
    company_name = None
    if org_id:
        org_row = sb.table("organizations").select("name").eq("id", org_id).maybe_single().execute()
        company_name = (org_row.data or {}).get("name") if org_row else None

    # Fail-closed: record WHO sent a login link to WHICH email before minting it.
    write_audit_log(
        staff, "customer.invite_sent", target_type="customer", target_id=user_id,
        target_org_id=org_id, metadata={"email": email},
        ip=request.client.host if request.client else None, critical=True,
    )

    link = generate_recovery_link(email)
    main_api.send_customer_invite(email, link, company_name)
    return {"success": True, "email": email}


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
