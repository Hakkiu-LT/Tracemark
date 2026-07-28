from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from tracemark_api.dependencies import get_current_profile, CurrentProfile
from tracemark_api.services.database import get_supabase

router = APIRouter(prefix="/clients", tags=["clients"])

class ClientCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    plan: Optional[str] = "Pro"
    mrr: Optional[int] = 0
    contact: Optional[str] = None

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    plan: Optional[str] = None
    mrr: Optional[int] = None
    contact: Optional[str] = None

class ClientResponse(BaseModel):
    id: str
    name: str
    industry: Optional[str] = None
    plan: str
    mrr: int
    contact: Optional[str] = None
    organization_id: Optional[str] = None

class ClientBillingResponse(BaseModel):
    client_id: str
    mrr: int
    plan: str
    cases_count: int
    takedowns_count: int
    resolved_takedowns: int
    api_usage_credits: int

@router.get("", response_model=list[ClientResponse])
def list_clients(profile: CurrentProfile = Depends(get_current_profile)):
    org_id = profile.organization_id
    sb = get_supabase()
    res = sb.table("clients").select("*").eq("organization_id", org_id).order("created_at", desc=True).execute()
    return res.data or []

@router.get("/{client_id}", response_model=ClientResponse)
def get_client(client_id: str, profile: CurrentProfile = Depends(get_current_profile)):
    org_id = profile.organization_id
    sb = get_supabase()
    res = sb.table("clients").select("*").eq("id", client_id).eq("organization_id", org_id).maybe_single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Client not found")
    return res.data

@router.post("", response_model=ClientResponse)
def create_client(payload: ClientCreate, profile: CurrentProfile = Depends(get_current_profile)):
    org_id = profile.organization_id
    sb = get_supabase()
    client_data = {
        "name": payload.name,
        "industry": payload.industry,
        "plan": payload.plan or "Pro",
        "mrr": payload.mrr or 0,
        "contact": payload.contact,
        "organization_id": org_id,
    }
    res = sb.table("clients").insert(client_data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create client")
    return res.data[0]

@router.put("/{client_id}", response_model=ClientResponse)
def update_client(client_id: str, payload: ClientUpdate, profile: CurrentProfile = Depends(get_current_profile)):
    org_id = profile.organization_id
    sb = get_supabase()
    
    # Check existence
    existing = sb.table("clients").select("id").eq("id", client_id).eq("organization_id", org_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Client not found")
        
    update_data = {}
    if payload.name is not None:
        update_data["name"] = payload.name
    if payload.industry is not None:
        update_data["industry"] = payload.industry
    if payload.plan is not None:
        update_data["plan"] = payload.plan
    if payload.mrr is not None:
        update_data["mrr"] = payload.mrr
    if payload.contact is not None:
        update_data["contact"] = payload.contact

    if not update_data:
        # Fetch current record if nothing is updated
        res = sb.table("clients").select("*").eq("id", client_id).eq("organization_id", org_id).maybe_single().execute()
        return res.data

    res = sb.table("clients").update(update_data).eq("id", client_id).eq("organization_id", org_id).execute()
    return res.data[0]

@router.delete("/{client_id}")
def delete_client(client_id: str, profile: CurrentProfile = Depends(get_current_profile)):
    org_id = profile.organization_id
    sb = get_supabase()
    
    existing = sb.table("clients").select("id").eq("id", client_id).eq("organization_id", org_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Client not found")
        
    sb.table("clients").delete().eq("id", client_id).execute()
    return {"success": True}

@router.get("/{client_id}/billing", response_model=ClientBillingResponse)
def get_client_billing(client_id: str, profile: CurrentProfile = Depends(get_current_profile)):
    org_id = profile.organization_id
    sb = get_supabase()
    
    # Fetch client details
    client = sb.table("clients").select("*").eq("id", client_id).eq("organization_id", org_id).maybe_single().execute()
    if not client.data:
        raise HTTPException(status_code=404, detail="Client not found")
        
    # Count client cases (org-scoped defence-in-depth; client already org-verified above)
    cases = sb.table("cases").select("id").eq("client_id", client_id).eq("organization_id", org_id).execute()
    cases_list = cases.data or []
    cases_count = len(cases_list)
    case_ids = [c["id"] for c in cases_list]
    
    takedowns_count = 0
    resolved_takedowns = 0
    
    if case_ids:
        # Count client takedown reports
        takedowns = sb.table("takedown_reports").select("status").in_("case_id", case_ids).execute()
        t_data = takedowns.data or []
        takedowns_count = len(t_data)
        resolved_takedowns = len([t for t in t_data if t.get("status") in ("sent", "acknowledged", "resolved")])
        
    return ClientBillingResponse(
        client_id=client_id,
        mrr=client.data["mrr"],
        plan=client.data["plan"],
        cases_count=cases_count,
        takedowns_count=takedowns_count,
        resolved_takedowns=resolved_takedowns,
        api_usage_credits=cases_count * 15
    )
