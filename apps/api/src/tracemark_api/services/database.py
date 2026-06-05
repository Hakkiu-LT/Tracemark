from supabase import create_client, Client
import os
from tracemark_api.services.ai import Evidence, Decision

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _client


def create_case(brand_name: str) -> str:
    sb = get_supabase()
    result = sb.table("cases").insert({"brand_name": brand_name, "status": "pending"}).execute()
    return result.data[0]["id"]


def save_evidence(case_id: str, evidence: Evidence) -> str:
    sb = get_supabase()
    result = sb.table("evidence").insert({
        "case_id": case_id,
        "marketplaces": [m.model_dump() for m in evidence.marketplaces],
        "ads": [a.model_dump() for a in evidence.ads],
        "domains": [d.model_dump() for d in evidence.domains],
        "social": [s.model_dump() for s in evidence.social],
    }).execute()
    return result.data[0]["id"]


def save_decision(case_id: str, decision: Decision) -> str:
    sb = get_supabase()
    result = sb.table("decisions").insert({
        "case_id": case_id,
        "risk_level": decision.risk_level,
        "recommended_action": decision.recommended_action,
        "case_summary": decision.case_summary,
        "confidence_score": decision.confidence_score,
        "evidence_quality": decision.evidence_quality,
        "key_findings": decision.key_findings,
    }).execute()
    sb.table("cases").update({"status": "complete"}).eq("id", case_id).execute()
    return result.data[0]["id"]


def update_case_status(case_id: str, status: str) -> None:
    sb = get_supabase()
    sb.table("cases").update({"status": status}).eq("id", case_id).execute()


def get_case_with_decision(case_id: str) -> dict:
    sb = get_supabase()
    case = sb.table("cases").select("*, decisions(*)").eq("id", case_id).single().execute()
    return case.data
