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
    ScoredEvidenceItem,
    SocialEvidence,
)
from tracemark_api.services.database import get_supabase
from tracemark_api.services.detection_funnel import verdict_to_risk_level

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


# Statuses that "close" a per-copycat record. Once an infringement reaches one
# of these, a future scan may re-detect the same URL. Everything else —
# including `safe`/`dismissed` — blocks re-detection until the user changes the
# status (e.g. back to Complete via Re-analyze). So a page the user judged Safe
# is never re-added for that org+brand until they explicitly move it.
_TERMINAL_STATUSES = ("complete", "completed", "resolved", "declined")


def _find_open_infringement(sb, source_url: str, organization_id, brand_name) -> str | None:
    """Return the id of an existing non-terminal infringement for the same
    source_url under the same org+brand, else None (best-effort — never raises)."""
    try:
        # All infringements for this URL across the DB are a small set (one row
        # per scan that found it); load them, then resolve parent cases' org &
        # brand in one shot — avoids an unbounded IN-list on case_id.
        res = (
            sb.table("infringements")
            .select("id,case_id,status")
            .eq("source_url", source_url)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None
        case_ids = list({r["case_id"] for r in rows if r.get("case_id")})
        if not case_ids:
            return None
        cases_res = (
            sb.table("cases")
            .select("id,organization_id,brand_name")
            .in_("id", case_ids)
            .execute()
        )
        wanted = {
            c["id"]
            for c in (cases_res.data or [])
            if c.get("organization_id") == organization_id and c.get("brand_name") == brand_name
        }
        for r in rows:
            if r.get("case_id") in wanted and r.get("status") not in _TERMINAL_STATUSES:
                return r["id"]
    except Exception as e:
        print(f"[warn] _find_open_infringement failed for {source_url}: {e}")
    return None


def persist_infringement(
    case_id: str,
    item: MarketplaceEvidence | AdEvidence | DomainEvidence | SocialEvidence,
    scored: ScoredEvidenceItem | None = None,
) -> str:
    """
    Upsert one infringement record into the `infringements` table.

    Uses source_url + case_id as the natural duplicate key — if the same URL
    has already been stored for this case, the row is updated instead of
    inserted again (idempotent).

    When ``scored`` is provided, the risk level and match score are derived
    from the tiered funnel scores instead of the hardcoded ``risk_scorer``.

    Returns the row id.
    """
    if scored is not None:
        risk_level, match_score = verdict_to_risk_level(scored.verdict, scored.overall_score)
    else:
        risk_level, match_score = risk_scorer(item)
    source_url = _item_url(item)

    screenshot_url = getattr(item, "screenshot_url", None)

    sb = get_supabase()
    client_id = None
    organization_id = None
    brand_name = None
    try:
        case_res = sb.table("cases").select("client_id, organization_id, brand_name").eq("id", case_id).maybe_single().execute()
        if case_res.data:
            client_id = case_res.data.get("client_id")
            organization_id = case_res.data.get("organization_id")
            brand_name = case_res.data.get("brand_name")
    except Exception as e:
        print(f"[warn] Failed to fetch case context for {case_id}: {e}")

    # ── Cross-case dedup ───────────────────────────────────────────────────
    # Don't re-add a copycat URL that already has an OPEN infringement for the
    # same org+brand — until that earlier case is closed (status Complete or
    # Rejected). Safe/dismissed counts as "open forever" here, so a page the
    # user judged non-infringing is never re-detected for that brand (until
    # the user changes the status, e.g. back to Complete via Re-analyze).
    if organization_id and brand_name and source_url:
        prior_id = _find_open_infringement(sb, source_url, organization_id, brand_name)
        if prior_id:
            return prior_id

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
                # Country this item was actually scraped from (multi-region scans).
                "detection_region": getattr(item, "detection_region", None),
            },
            on_conflict="case_id,source_url",
        )
        .execute()
    )
    infringement_id = result.data[0]["id"]

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
    Insert one evidence snapshot for an infringement into ``evidence_items``.

    Each call creates a new row, so a single infringement can accumulate
    multiple screenshots taken at different points in time.

    When ``brand_name`` is provided and ``ai_analysis`` is ``None``, the
    function will automatically call ``generate_evidence_analysis()`` to
    populate the criteria from Gemini Vision.

    Returns the new evidence_items row id.
    """
    if ai_analysis is None and brand_name and screenshot_url:
        try:
            from tracemark_api.services.ai import generate_evidence_analysis
            ai_analysis = generate_evidence_analysis(screenshot_url, brand_name)
        except Exception as e:
            print(f"[Persistence] AI analysis generation failed: {e}")

    sb = get_supabase()

    case_id = None
    source_url = ""
    platform = ""
    try:
        inf_res = (
            sb.table("infringements")
            .select("case_id, source_url, platform")
            .eq("id", infringement_id)
            .maybe_single()
            .execute()
        )
        if inf_res and inf_res.data:
            case_id = inf_res.data.get("case_id")
            source_url = inf_res.data.get("source_url", "")
            platform = inf_res.data.get("platform", "")
    except Exception as e:
        print(f"[warn] Failed to fetch infringement {infringement_id}: {e}")

    tier2_score = None
    criteria: list[dict] = []
    if ai_analysis:
        vis_score = ai_analysis.get("visual_similarity_score")
        if vis_score is not None:
            tier2_score = vis_score
        criteria = [
            {
                "name": "brand_match_detected",
                "score": 1.0 if ai_analysis.get("brand_match_detected") else 0.0,
                "evidence": ", ".join(ai_analysis.get("brand_names_found", [])),
            },
            {
                "name": "visual_similarity",
                "score": vis_score or 0.0,
                "evidence": ai_analysis.get("risk_assessment", ""),
            },
        ]

    result = (
        sb.table("evidence_items")
        .insert(
            {
                "case_id": case_id,
                "infringement_id": infringement_id,
                "source_url": source_url,
                "platform": platform,
                "screenshot_url": screenshot_url,
                "tier2_score": tier2_score,
                "criteria": criteria,
            }
        )
        .execute()
    )
    return result.data[0]["id"]


def persist_scored_evidence_item(
    case_id: str,
    item: ScoredEvidenceItem,
    infringement_id: str | None = None,
) -> str:
    """
    Persist a ``ScoredEvidenceItem`` (the unified per-detection record from the
    tiered funnel) into the ``evidence_items`` table.

    Returns the new row id.
    """
    sb = get_supabase()
    payload: dict = {
        "case_id": case_id,
        "source_url": item.source_url,
        "platform": item.platform,
        "screenshot_url": item.screenshot_url,
        "content_hash": item.content_hash,
        "overall_score": item.overall_score,
        "verdict": item.verdict,
        "category": item.category,
        "criteria": [c.model_dump() for c in item.criteria],
        "confidence": item.confidence,
        "scraped_at": item.scraped_at.isoformat(),
        "status": item.status,
    }
    if infringement_id:
        payload["infringement_id"] = infringement_id
    if item.tier0:
        payload["tier0_score"] = item.tier0.overall_score
    if item.tier1:
        payload["tier1_score"] = item.tier1.overall_score
        if item.tier1.content_hash:
            payload["content_hash"] = item.tier1.content_hash
    if item.tier2_score is not None:
        payload["tier2_score"] = item.tier2_score

    result = sb.table("evidence_items").insert(payload).execute()
    return result.data[0]["id"]


def persist_all_infringements(
    case_id: str,
    evidence: Evidence,
    scored_items: list[ScoredEvidenceItem] | None = None,
) -> list[str]:
    """
    Convenience wrapper: persist every item from an Evidence object.
    Returns a list of infringement ids (one per item).

    When ``scored_items`` is provided, each infringement is scored using the
    tiered funnel scores instead of the hardcoded ``risk_scorer``.
    """
    scored_map: dict[str, ScoredEvidenceItem] = {}
    for s in scored_items or []:
        scored_map[s.source_url] = s

    ids: list[str] = []
    for item in evidence.marketplaces:
        ids.append(persist_infringement(case_id, item, scored_map.get(item.listing_url)))
    for item in evidence.ads:
        ids.append(persist_infringement(case_id, item, scored_map.get(item.destination_url)))
    for item in evidence.domains:
        ids.append(persist_infringement(case_id, item, scored_map.get(f"https://{item.domain_name}")))
    for item in evidence.social:
        url = item.post_url or f"https://{item.platform.lower()}.com/{item.handle}"
        ids.append(persist_infringement(case_id, item, scored_map.get(url)))
    return ids
