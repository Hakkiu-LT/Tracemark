from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from tracemark_api.dependencies import get_current_user
from tracemark_api.services.database import get_supabase

router = APIRouter(prefix="/admin", tags=["admin"])


class UserProfile(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    organization_id: Optional[str]
    plan: str
    is_admin: bool


class PlanUpdateRequest(BaseModel):
    plan: str


def verify_admin(current_user=Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("profiles").select("is_admin").eq("id", current_user.id).execute()
    if res.data and res.data[0].get("is_admin"):
        return current_user

    raise HTTPException(status_code=403, detail="Access restricted to admins.")


@router.get("/users", response_model=List[UserProfile])
def get_all_users(admin_user=Depends(verify_admin)) -> List[UserProfile]:
    """Returns all registered users with their profiles and emails."""
    sb = get_supabase()

    # 1. Fetch emails from auth.users (requires service role key)
    auth_users_resp = sb.auth.admin.list_users()
    email_map = {u.id: u.email for u in auth_users_resp}

    # 2. Fetch profiles
    profiles_resp = (
        sb.table("profiles")
        .select("id, full_name, organization_id, plan, is_admin")
        .execute()
    )

    users = []
    for p in profiles_resp.data:
        users.append(
            UserProfile(
                id=p["id"],
                email=email_map.get(p["id"], "unknown@example.com"),
                full_name=p.get("full_name"),
                organization_id=p.get("organization_id"),
                plan=p.get("plan", "free"),
                is_admin=bool(p.get("is_admin", False)),
            )
        )
    return users


@router.put("/users/{user_id}/plan")
def update_user_plan(
    user_id: str, payload: PlanUpdateRequest, admin_user=Depends(verify_admin)
):
    """Updates a user's subscription plan and admin status."""
    sb = get_supabase()
    is_admin = payload.plan.lower() == "admin"

    # Update the profile
    sb.table("profiles").update({"plan": payload.plan, "is_admin": is_admin}).eq(
        "id", user_id
    ).execute()

    return {"success": True, "plan": payload.plan, "is_admin": is_admin}
