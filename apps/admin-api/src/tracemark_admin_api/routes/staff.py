"""Staff & role management: create employees, set roles, toggle granular permissions.

All endpoints require the `staff.manage` permission; creating a super-admin or deleting
staff additionally requires the caller to be a super-admin.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from tracemark_admin_api.clients import admin_sb
from tracemark_admin_api.dependencies import (
    StaffPrincipal,
    require_permission,
    require_super_admin,
)
from tracemark_admin_api.permissions import (
    ALL_PERMISSIONS,
    PERMISSIONS,
    ROLE_PRESETS,
    resolve_effective_permissions,
)
from tracemark_admin_api.services.audit import write_audit_log

router = APIRouter(prefix="/staff", tags=["staff-management"])

_VALID_ROLES = set(ROLE_PRESETS)


class StaffOut(BaseModel):
    id: str
    email: str
    full_name: str | None
    role: str
    is_super_admin: bool
    is_active: bool
    permissions: list[str]


class CreateStaffRequest(BaseModel):
    email: str
    password: str
    full_name: str | None = None
    role: str = "sales"
    is_super_admin: bool = False


class UpdateStaffRequest(BaseModel):
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    is_super_admin: bool | None = None
    email: str | None = None
    password: str | None = None


class PermissionOverride(BaseModel):
    permission: str
    granted: bool


class SetPermissionsRequest(BaseModel):
    overrides: list[PermissionOverride]


def _load_overrides(staff_id: str) -> list[dict]:
    res = (
        admin_sb()
        .table("staff_permissions")
        .select("permission, granted")
        .eq("staff_id", staff_id)
        .execute()
    )
    return res.data or []


def _to_out(row: dict) -> StaffOut:
    perms = resolve_effective_permissions(
        role=row["role"],
        is_super_admin=bool(row.get("is_super_admin")),
        overrides=_load_overrides(row["id"]),
    )
    return StaffOut(
        id=row["id"],
        email=row.get("email", ""),
        full_name=row.get("full_name"),
        role=row["role"],
        is_super_admin=bool(row.get("is_super_admin")),
        is_active=bool(row.get("is_active", True)),
        permissions=sorted(perms),
    )


@router.get("/permissions/catalog")
def permission_catalog(staff: StaffPrincipal = Depends(require_permission("staff.manage"))):
    """Return the full permission catalog + role presets so the UI can render toggles."""
    return {
        "permissions": PERMISSIONS,
        "role_presets": {role: sorted(perms) for role, perms in ROLE_PRESETS.items()},
    }


@router.get("", response_model=list[StaffOut])
def list_staff(staff: StaffPrincipal = Depends(require_permission("staff.manage"))):
    rows = admin_sb().table("staff_accounts").select("*").execute().data or []
    return [_to_out(r) for r in rows]


@router.get("/{staff_id}", response_model=StaffOut)
def get_staff(staff_id: str, staff: StaffPrincipal = Depends(require_permission("staff.manage"))):
    row = admin_sb().table("staff_accounts").select("*").eq("id", staff_id).maybe_single().execute()
    if not row or not row.data:
        raise HTTPException(status_code=404, detail="Staff not found")
    return _to_out(row.data)


@router.post("", response_model=StaffOut)
def create_staff(
    payload: CreateStaffRequest,
    staff: StaffPrincipal = Depends(require_permission("staff.manage")),
):
    if payload.role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {payload.role}")
    # Only a super-admin may mint another super-admin.
    if payload.is_super_admin and not staff.is_super_admin:
        raise HTTPException(status_code=403, detail="Super-admin required to create a super-admin")

    sb = admin_sb()
    # 1. Create the auth user in the staff project (email confirmed, no self-signup).
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

    # 2. Insert the staff_accounts row.
    row = (
        sb.table("staff_accounts")
        .insert(
            {
                "id": new_id,
                "email": payload.email,
                "full_name": payload.full_name,
                "role": payload.role,
                "is_super_admin": payload.is_super_admin,
                "created_by": staff.id,
            }
        )
        .execute()
        .data[0]
    )

    write_audit_log(
        staff,
        "staff.create",
        target_type="staff",
        target_id=new_id,
        metadata={"email": payload.email, "role": payload.role},
    )
    return _to_out(row)


@router.patch("/{staff_id}", response_model=StaffOut)
def update_staff(
    staff_id: str,
    payload: UpdateStaffRequest,
    staff: StaffPrincipal = Depends(require_permission("staff.manage")),
):
    updates: dict = {}
    if payload.full_name is not None:
        updates["full_name"] = payload.full_name
    if payload.role is not None:
        if not staff.is_super_admin:
            raise HTTPException(status_code=403, detail="Super-admin required to change role")
        if payload.role not in _VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role: {payload.role}")
        updates["role"] = payload.role
    if payload.is_active is not None:
        if not staff.is_super_admin:
            raise HTTPException(status_code=403, detail="Super-admin required to change active status")
        if payload.is_active is False:
            # Block self-deactivation.
            if staff_id == staff.id:
                raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
            # Prevent lockout: never deactivate the last active super-admin.
            target = (
                admin_sb().table("staff_accounts").select("is_super_admin")
                .eq("id", staff_id).maybe_single().execute()
            )
            if target and target.data and target.data.get("is_super_admin"):
                active_supers = (
                    admin_sb().table("staff_accounts").select("id")
                    .eq("is_super_admin", True).eq("is_active", True).execute().data or []
                )
                if len(active_supers) <= 1:
                    raise HTTPException(
                        status_code=400,
                        detail="Cannot deactivate the last active super-admin",
                    )
        updates["is_active"] = payload.is_active
    if payload.is_super_admin is not None:
        # Only a super-admin may grant/revoke super-admin.
        if not staff.is_super_admin:
            raise HTTPException(status_code=403, detail="Super-admin required to change super-admin status")
        # Prevent lockout: never demote the last active super-admin.
        if payload.is_super_admin is False:
            supers = (
                admin_sb().table("staff_accounts").select("id")
                .eq("is_super_admin", True).eq("is_active", True).execute().data or []
            )
            if len(supers) <= 1 and any(s["id"] == staff_id for s in supers):
                raise HTTPException(status_code=400, detail="Cannot demote the last remaining super-admin")
        updates["is_super_admin"] = payload.is_super_admin
    if payload.email is not None:
        updates["email"] = payload.email  # keep staff_accounts.email in sync

    sb = admin_sb()

    # Email / password live in the staff auth.users — update via admin auth API.
    auth_attrs: dict = {}
    if payload.email is not None:
        auth_attrs["email"] = payload.email
        auth_attrs["email_confirm"] = True
    if payload.password is not None:
        if len(payload.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        auth_attrs["password"] = payload.password
    if auth_attrs:
        try:
            sb.auth.admin.update_user_by_id(staff_id, auth_attrs)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=f"Could not update staff auth account: {exc}")

    if not updates and not auth_attrs:
        raise HTTPException(status_code=400, detail="No fields to update")

    row = None
    if updates:
        res = sb.table("staff_accounts").update(updates).eq("id", staff_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Staff not found")
        row = res.data[0]
    else:
        r = sb.table("staff_accounts").select("*").eq("id", staff_id).maybe_single().execute()
        row = r.data if r else None
        if not row:
            raise HTTPException(status_code=404, detail="Staff not found")

    audit_meta = dict(updates)
    if "password" in (payload.model_dump(exclude_none=True)):
        audit_meta["password"] = "***changed***"
    write_audit_log(
        staff, "staff.update", target_type="staff", target_id=staff_id, metadata=audit_meta
    )
    return _to_out(row)


@router.put("/{staff_id}/permissions", response_model=StaffOut)
def set_permissions(
    staff_id: str,
    payload: SetPermissionsRequest,
    staff: StaffPrincipal = Depends(require_super_admin),
):
    """Replace the full set of per-staff permission overrides (grant/deny). Super-admin only."""
    if staff_id == staff.id:
        raise HTTPException(status_code=403, detail="Cannot modify your own permissions")
    sb = admin_sb()
    acct = sb.table("staff_accounts").select("*").eq("id", staff_id).maybe_single().execute()
    if not acct or not acct.data:
        raise HTTPException(status_code=404, detail="Staff not found")

    # Validate every permission against the catalog.
    for ov in payload.overrides:
        if ov.permission not in ALL_PERMISSIONS:
            raise HTTPException(status_code=400, detail=f"Unknown permission: {ov.permission}")

    # Replace: delete existing overrides, then insert the new set.
    sb.table("staff_permissions").delete().eq("staff_id", staff_id).execute()
    if payload.overrides:
        sb.table("staff_permissions").insert(
            [
                {"staff_id": staff_id, "permission": ov.permission, "granted": ov.granted}
                for ov in payload.overrides
            ]
        ).execute()

    write_audit_log(
        staff,
        "staff.set_permissions",
        target_type="staff",
        target_id=staff_id,
        metadata={"overrides": [ov.model_dump() for ov in payload.overrides]},
    )
    return _to_out(acct.data)


@router.delete("/{staff_id}")
def delete_staff(
    staff_id: str,
    staff: StaffPrincipal = Depends(require_super_admin),
):
    """Hard-delete a staff member (super-admin only). Prefer PATCH is_active=false to
    soft-disable while keeping the audit trail intact."""
    if staff_id == staff.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    sb = admin_sb()
    try:
        sb.auth.admin.delete_user(staff_id)
    except Exception as exc:  # noqa: BLE001
        print(f"[staff] auth user delete failed for {staff_id}: {exc}")
    # staff_accounts row + its permissions cascade via FK ON DELETE CASCADE.
    sb.table("staff_accounts").delete().eq("id", staff_id).execute()

    write_audit_log(staff, "staff.delete", target_type="staff", target_id=staff_id)
    return {"success": True}
