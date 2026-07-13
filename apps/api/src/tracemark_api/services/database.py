from supabase import create_client, Client
import os
from tracemark_api.services.ai import Evidence, Decision
from tracemark_api.services.evidence_scorer import EvidenceScore

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _client


def create_case(
    brand_name: str,
    organization_id: str | None = None,
    detection_region: str | None = None,
    target_regions: list[str] | None = None,
    client_id: str | None = None,
    user_id: str | None = None,
) -> str:
    sb = get_supabase()
    payload = {"brand_name": brand_name, "status": "pending"}
    if organization_id:
        payload["organization_id"] = organization_id
    if detection_region:
        payload["detection_region"] = detection_region
    if target_regions:
        payload["target_regions"] = target_regions
    if client_id:
        payload["client_id"] = client_id
    if user_id:
        payload["user_id"] = user_id
    result = sb.table("cases").insert(payload).execute()
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


def save_decision(case_id: str, decision: Decision, score: EvidenceScore | None = None) -> str:
    sb = get_supabase()
    payload: dict = {
        "case_id": case_id,
        "risk_level": decision.risk_level,
        "recommended_action": decision.recommended_action,
        "case_summary": decision.case_summary,
        "confidence_score": decision.confidence_score,
        "evidence_quality": decision.evidence_quality,
        "key_findings": decision.key_findings,
    }
    if score is not None:
        payload.update({
            "evidence_score": score.total_score,
            "marketplace_score": score.marketplace_score,
            "ads_score": score.ads_score,
            "domains_score": score.domains_score,
        })
    result = sb.table("decisions").insert(payload).execute()
    return result.data[0]["id"]


def update_case_status(case_id: str, status: str, decline_reason: str | None = None) -> None:
    sb = get_supabase()
    updates = {"status": status}
    if decline_reason is not None:
        updates["decline_reason"] = decline_reason
    try:
        sb.table("cases").update(updates).eq("id", case_id).execute()
    except Exception as e:
        if "decline_reason" in str(e):
            sb.table("cases").update({"status": status}).eq("id", case_id).execute()
            if decline_reason:
                dec_res = sb.table("decisions").select("id, case_summary").eq("case_id", case_id).execute()
                if dec_res.data:
                    dec_id = dec_res.data[0]["id"]
                    old_summary = dec_res.data[0].get("case_summary") or ""
                    new_summary = f"Decline Reason: {decline_reason}\n\n{old_summary}"
                    sb.table("decisions").update({"case_summary": new_summary}).eq("id", dec_id).execute()
        else:
            raise e


def get_case_with_decision(case_id: str) -> dict:
    sb = get_supabase()
    case = sb.table("cases").select("*, decisions(*)").eq("id", case_id).single().execute()
    return case.data


def get_full_case(case_id: str) -> dict:
    sb = get_supabase()
    case = sb.table("cases").select("*, decisions(*), evidence(*), takedown_reports(*)").eq("id", case_id).single().execute()
    return case.data


def update_decision_action(case_id: str, action: str) -> None:
    sb = get_supabase()
    sb.table("decisions").update({"recommended_action": action}).eq("case_id", case_id).execute()

