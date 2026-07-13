import os
from fastapi import APIRouter, Depends, HTTPException, Body
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
    persona: Optional[str] = None   # "brand_owner" | "law_firm"

class PlanUpdateRequest(BaseModel):
    plan: str

class WorkspaceUpdateRequest(BaseModel):
    persona: str  # "brand_owner" | "law_firm"

def verify_admin(current_user=Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("profiles").select("is_admin").eq("id", current_user.id).execute()
    if res.data and res.data[0].get("is_admin"):
        return current_user
        
    raise HTTPException(status_code=403, detail="Access restricted to admins.")

@router.get("/users", response_model=List[UserProfile])
def get_all_users(admin_user=Depends(verify_admin)) -> List[UserProfile]:
    """Returns all registered users with their profiles, emails and workspace persona."""
    sb = get_supabase()
    
    # 1. Fetch emails from auth.users (requires service role key)
    auth_users_resp = sb.auth.admin.list_users()
    email_map = {u.id: u.email for u in auth_users_resp}
    
    # 2. Fetch profiles
    profiles_resp = sb.table("profiles").select("id, full_name, organization_id, plan, is_admin").execute()

    # 3. Fetch all org_settings to resolve persona per org
    org_settings_resp = sb.table("org_settings").select("organization_id, persona").execute()
    persona_by_org = {row["organization_id"]: row.get("persona") for row in (org_settings_resp.data or [])}
    
    users = []
    for p in profiles_resp.data:
        org_id = p.get("organization_id")
        users.append(UserProfile(
            id=p["id"],
            email=email_map.get(p["id"], "unknown@example.com"),
            full_name=p.get("full_name"),
            organization_id=org_id,
            plan=p.get("plan", "free"),
            is_admin=bool(p.get("is_admin", False)),
            persona=persona_by_org.get(org_id) if org_id else None,
        ))
    return users

@router.put("/users/{user_id}/plan")
def update_user_plan(user_id: str, payload: PlanUpdateRequest, admin_user=Depends(verify_admin)):
    """Updates a user's subscription plan and admin status."""
    sb = get_supabase()
    is_admin = payload.plan.lower() == "admin"
    
    # Update the profile
    sb.table("profiles").update({
        "plan": payload.plan,
        "is_admin": is_admin
    }).eq("id", user_id).execute()
    
    return {"success": True, "plan": payload.plan, "is_admin": is_admin}

@router.put("/users/{user_id}/workspace")
def update_user_workspace(user_id: str, payload: WorkspaceUpdateRequest, admin_user=Depends(verify_admin)):
    """Sets the workspace persona (brand_owner | law_firm) for the user's organization."""
    if payload.persona not in ("brand_owner", "law_firm"):
        raise HTTPException(status_code=400, detail="persona must be 'brand_owner' or 'law_firm'")
    
    sb = get_supabase()
    # Resolve org_id from profile
    profile_res = sb.table("profiles").select("organization_id").eq("id", user_id).maybe_single().execute()
    if not profile_res.data or not profile_res.data.get("organization_id"):
        raise HTTPException(status_code=404, detail="User has no organization assigned.")
    
    org_id = profile_res.data["organization_id"]
    sb.table("org_settings").update({
        "persona": payload.persona,
        "updated_at": __import__("datetime").datetime.utcnow().isoformat(),
    }).eq("organization_id", org_id).execute()

    return {"success": True, "persona": payload.persona}
