"""Staff authentication + authorization dependencies.

Mirrors the shape of the main API's dependencies.py (get_current_user), but validates
against the SEPARATE staff Supabase project and resolves granular permissions.

Usage on an endpoint:
    @router.get("/customers")
    def list_customers(staff = Depends(require_permission("customers.view"))):
        ...
"""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException

from tracemark_admin_api.clients import admin_sb
from tracemark_admin_api.permissions import resolve_effective_permissions


class StaffPrincipal:
    """An authenticated staff member with their resolved permission set."""

    def __init__(
        self,
        id: str,
        email: str,
        full_name: str | None,
        role: str,
        is_super_admin: bool,
        permissions: set[str],
    ):
        self.id = id
        self.email = email
        self.full_name = full_name
        self.role = role
        self.is_super_admin = is_super_admin
        self.permissions = permissions

    def has(self, permission: str) -> bool:
        return self.is_super_admin or permission in self.permissions


def get_current_staff(authorization: str = Header(...)) -> StaffPrincipal:
    """Validate a staff Supabase JWT and load the staff account + permissions.

    Raises 401 if the token is invalid, 403 if the token is valid but the user is
    not an active staff account (e.g. a leaked customer token, which is issued by a
    different project and would fail get_user here anyway).
    """
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    sb = admin_sb()
    try:
        user = sb.auth.get_user(token).user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    acct_res = (
        sb.table("staff_accounts")
        .select("id, email, full_name, role, is_super_admin, is_active")
        .eq("id", user.id)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    acct = acct_res.data if acct_res else None
    if not acct:
        raise HTTPException(status_code=403, detail="Not an active staff account")

    overrides_res = (
        sb.table("staff_permissions")
        .select("permission, granted")
        .eq("staff_id", user.id)
        .execute()
    )
    perms = resolve_effective_permissions(
        role=acct["role"],
        is_super_admin=bool(acct.get("is_super_admin")),
        overrides=overrides_res.data or [],
    )

    return StaffPrincipal(
        id=acct["id"],
        email=acct.get("email") or (user.email or ""),
        full_name=acct.get("full_name"),
        role=acct["role"],
        is_super_admin=bool(acct.get("is_super_admin")),
        permissions=perms,
    )


def require_permission(permission: str):
    """Dependency factory: 403 unless the staff member has `permission` (or is super-admin)."""

    def _dep(staff: StaffPrincipal = Depends(get_current_staff)) -> StaffPrincipal:
        if staff.has(permission):
            return staff
        raise HTTPException(status_code=403, detail=f"Missing permission: {permission}")

    return _dep


def require_super_admin(staff: StaffPrincipal = Depends(get_current_staff)) -> StaffPrincipal:
    """Dependency for destructive/impersonation actions reserved for super-admins."""
    if not staff.is_super_admin:
        raise HTTPException(status_code=403, detail="Super-admin required")
    return staff
