"""Global search across companies, people and brands."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from tracemark_admin_api.clients import admin_sb, customer_sb
from tracemark_admin_api.dependencies import StaffPrincipal, require_permission

router = APIRouter(prefix="/search", tags=["search"])


class SearchResults(BaseModel):
    organizations: list[dict]
    people: list[dict]
    brands: list[dict]


@router.get("", response_model=SearchResults)
def search(
    q: str = Query(min_length=1),
    include_staff: bool = Query(
        False,
        description="Include staff accounts in the people results. Used by 'Add member' so a "
        "staff/super-admin login can be attached to a customer company; the global search "
        "box leaves it False to stay customer-focused.",
    ),
    staff: StaffPrincipal = Depends(require_permission("customers.view")),
):
    sb = customer_sb()
    like = f"%{q}%"
    staff_ids = {r["id"] for r in (admin_sb().table("staff_accounts").select("id").execute().data or [])}

    # Companies by name.
    orgs = (
        sb.table("organizations").select("id, name, industry").ilike("name", like).limit(10).execute().data
        or []
    )
    orgs = [o for o in orgs if o["id"] not in staff_ids]

    # People: match on profile full_name OR auth email. (Email lives in auth.users; we
    # filter the in-memory user list — fine at admin scale.)
    ql = q.lower()
    emails = {u.id: (u.email or "") for u in sb.auth.admin.list_users(page=1, per_page=1000)}
    profiles = sb.table("profiles").select("id, full_name, organization_id").limit(1000).execute().data or []
    people = []
    for p in profiles:
        if p["id"] in staff_ids and not include_staff:
            continue
        email = emails.get(p["id"], "")
        name = p.get("full_name") or ""
        if ql in email.lower() or ql in name.lower():
            people.append(
                {"user_id": p["id"], "email": email, "full_name": p.get("full_name"), "organization_id": p.get("organization_id")}
            )
        if len(people) >= 10:
            break

    # Brands by name.
    brands = (
        sb.table("brands").select("id, brand_name, organization_id").ilike("brand_name", like).limit(10).execute().data
        or []
    )

    return SearchResults(organizations=orgs, people=people, brands=brands)
