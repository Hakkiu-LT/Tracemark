"""
Persistence helpers for individual infringement records.

After the AI decision agent scores a whole case, these functions break that
case down into individual flagged items (one per ad, listing, domain, or
social profile) and upsert them into the `infringements` table.
"""
from __future__ import annotations

from typing import Literal

from tracemark_api.services.ai import (
    AdEvidence,
    DomainEvidence,
    Evidence,
    MarketplaceEvidence,
    SocialEvidence,
)
from tracemark_api.services.database import get_supabase

RiskLevel = Literal["HIGH", "MEDIUM", "LOW"]

# ──────────────────────────────────────────────────────────────────────────────
# Step 2: risk_scorer
# ──────────────────────────────────────────────────────────────────────────────

def risk_scorer(
    item: MarketplaceEvidence | AdEvidence | DomainEvidence | SocialEvidence,
) -> tuple[RiskLevel, float]:
    """
    Score a single evidence item and return (risk_level, match_score 0‥1).

    Rules per type:
    - MarketplaceEvidence: always HIGH (direct counterfeit sale). Score = 1.0.
    - AdEvidence: always HIGH (paid brand impersonation). Score = 0.9.
    - DomainEvidence: based on similarity_score.
        >= 80 → HIGH (1.0), >= 50 → MEDIUM (0.6), else LOW (0.3).
    - SocialEvidence: based on follower_count.
        > 10 000 → HIGH (0.85), > 1 000 → MEDIUM (0.55), else LOW (0.25).
    """
    if isinstance(item, MarketplaceEvidence):
        return "HIGH", 1.0

    if isinstance(item, AdEvidence):
        return "HIGH", 0.9

    if isinstance(item, DomainEvidence):
        sim = item.similarity_score  # 0–100
        if sim >= 80:
            return "HIGH", round(sim / 100, 2)
        if sim >= 50:
            return "MEDIUM", round(sim / 100, 2)
        return "LOW", round(sim / 100, 2)

    if isinstance(item, SocialEvidence):
        count = item.follower_count or 0
        if count > 10_000:
            return "HIGH", 0.85
        if count > 1_000:
            return "MEDIUM", 0.55
        return "LOW", 0.25

    raise TypeError(f"Unsupported evidence type: {type(item)}")


# ──────────────────────────────────────────────────────────────────────────────
# Step 3: persist_infringement
# ──────────────────────────────────────────────────────────────────────────────

def _item_url(item: MarketplaceEvidence | AdEvidence | DomainEvidence | SocialEvidence) -> str:
    if isinstance(item, MarketplaceEvidence):
        return item.listing_url
    if isinstance(item, AdEvidence):
        return item.destination_url
    if isinstance(item, DomainEvidence):
        return f"https://{item.domain_name}"
    if isinstance(item, SocialEvidence):
        return item.post_url or f"https://{item.platform.lower()}.com/{item.handle}"
    return ""


def _item_platform(item: MarketplaceEvidence | AdEvidence | DomainEvidence | SocialEvidence) -> str:
    if isinstance(item, DomainEvidence):
        return "domain"
    return item.platform


def _match_type(item: MarketplaceEvidence | AdEvidence | DomainEvidence | SocialEvidence) -> str:
    """Rough heuristic: domains & social are keyword-matched; ads/marketplaces use both."""
    if isinstance(item, (DomainEvidence, SocialEvidence)):
        return "keyword"
    return "both"


def persist_infringement(
    case_id: str,
    item: MarketplaceEvidence | AdEvidence | DomainEvidence | SocialEvidence,
) -> str | None:
    """
    Upsert one infringement record into the `infringements` table.

    Uses source_url + case_id as the natural duplicate key — if the same URL
    has already been stored for this case, the row is updated instead of
    inserted again (idempotent).

    Returns the row id.
    """
    risk_level, match_score = risk_scorer(item)
    source_url = _item_url(item)

    screenshot_url = getattr(item, "screenshot_url", None)

    sb = get_supabase()
    client_id = None
    try:
        case_res = sb.table("cases").select("client_id").eq("id", case_id).maybe_single().execute()
        if case_res.data:
            client_id = case_res.data.get("client_id")
    except Exception as e:
        print(f"[warn] Failed to fetch client_id for case {case_id}: {e}")

    result = (
        sb.table("infringements")
        .upsert(
            {
                "case_id": case_id,
                "source_url": source_url,
                "platform": _item_platform(item),
                "risk_level": risk_level,
                "match_score": match_score,
                "match_type": _match_type(item),
                "status": "flagged",
                "screenshot_url": screenshot_url,
                "client_id": client_id,
            },
            on_conflict="case_id,source_url",
        )
        .execute()
    )
    rows = result.data or []
    if not rows:
        # An upsert that hits the on-conflict target can return no representation
        # depending on PostgREST's Prefer settings; fetch the row so we still get
        # its id instead of crashing with IndexError mid-persistence.
        existing = (
            sb.table("infringements")
            .select("id")
            .eq("case_id", case_id)
            .eq("source_url", source_url)
            .limit(1)
            .execute()
        )
        rows = existing.data or []
    if not rows:
        return None
    infringement_id = rows[0]["id"]

    if risk_level == "HIGH":
        _trigger_new_infringement_notification(infringement_id, case_id, source_url, _item_platform(item))

    return infringement_id


def _trigger_new_infringement_notification(
    infringement_id: str,
    case_id: str,
    source_url: str,
    platform: str,
) -> None:
    """Fire dispatch_notifications and log the delivery attempt."""
    try:
        from tracemark_api.services.notifications import dispatch_notifications
        from tracemark_api.services.delivery_log import log_delivery

        event = {
            "type": "new_infringement",
            "infringement_id": infringement_id,
            "case_id": case_id,
            "source_url": source_url,
            "platform": platform,
        }
        dispatch_notifications(event)
        log_delivery("new_infringement", ok=True, infringement_id=infringement_id, payload=event)
    except ImportError:
        pass
    except Exception as e:
        try:
            from tracemark_api.services.delivery_log import log_delivery
            log_delivery("new_infringement", ok=False, infringement_id=infringement_id, error=str(e))
        except Exception:
            print(f"[Persistence] Notification trigger failed: {e}")


# ──────────────────────────────────────────────────────────────────────────────
# Evidence persistence
# ──────────────────────────────────────────────────────────────────────────────

def persist_evidence(
    infringement_id: str,
    screenshot_url: str,
    ai_analysis: dict | None = None,
    brand_name: str | None = None,
) -> str:
    """
    Insert one evidence snapshot for an infringement.

    Each call creates a new row, so a single infringement can accumulate
    multiple screenshots taken at different points in time.

    When ``brand_name`` is provided and ``ai_analysis`` is ``None``, the
    function will automatically call ``generate_evidence_analysis()`` to
    populate the ``ai_analysis`` jsonb column using Gemini Vision.

    Returns the new evidence row id.
    """
    # Auto-populate ai_analysis via Gemini Vision when possible
    if ai_analysis is None and brand_name and screenshot_url:
        try:
            from tracemark_api.services.ai import generate_evidence_analysis
            ai_analysis = generate_evidence_analysis(screenshot_url, brand_name)
        except Exception as e:
            print(f"[Persistence] AI analysis generation failed: {e}")

    sb = get_supabase()
    result = (
        sb.table("evidence")
        .insert(
            {
                "infringement_id": infringement_id,
                "screenshot_url": screenshot_url,
                "ai_analysis": ai_analysis,
            }
        )
        .execute()
    )
    return result.data[0]["id"]


def persist_all_infringements(case_id: str, evidence: Evidence) -> list[str]:
    """
    Convenience wrapper: persist every item from an Evidence object.
    Returns a list of infringement ids (one per item).
    """
    ids: list[str] = []
    for item in (
        list(evidence.marketplaces)
        + list(evidence.ads)
        + list(evidence.domains)
        + list(evidence.social)
    ):
        inf_id = persist_infringement(case_id, item)
        if inf_id is not None:
            ids.append(inf_id)
    return ids
