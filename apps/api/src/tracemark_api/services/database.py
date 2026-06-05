import os
from supabase import create_client, Client

_client: Client | None = None


def get_db() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _client = create_client(url, key)
    return _client


def insert_case(brand_name: str, platforms: list[str]) -> dict:
    db = get_db()
    result = db.table("cases").insert({
        "brand_name": brand_name,
        "platforms": platforms
    }).execute()
    return result.data[0]


def insert_evidence(case_id: str, evidence_payload: dict) -> dict:
    db = get_db()
    result = db.table("evidence").insert({
        "case_id": case_id,
        "payload": evidence_payload
    }).execute()
    return result.data[0]


def insert_decision(case_id: str, decision_payload: dict) -> dict:
    db = get_db()
    result = db.table("decisions").insert({
        "case_id": case_id,
        **decision_payload
    }).execute()
    return result.data[0]
