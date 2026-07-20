"""Staff identity endpoint: who am I + what can I do."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from tracemark_admin_api.dependencies import StaffPrincipal, get_current_staff

router = APIRouter(prefix="/staff", tags=["staff-auth"])


class StaffMe(BaseModel):
    id: str
    email: str
    full_name: str | None
    role: str
    is_super_admin: bool
    permissions: list[str]


@router.get("/me", response_model=StaffMe)
def me(staff: StaffPrincipal = Depends(get_current_staff)) -> StaffMe:
    """Return the authenticated staff member + their resolved permission set.

    The frontend uses `permissions` to show/hide nav items and action buttons.
    """
    return StaffMe(
        id=staff.id,
        email=staff.email,
        full_name=staff.full_name,
        role=staff.role,
        is_super_admin=staff.is_super_admin,
        permissions=sorted(staff.permissions),
    )
