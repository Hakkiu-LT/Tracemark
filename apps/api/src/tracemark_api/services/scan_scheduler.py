"""
scan_scheduler.py
=================
Background worker that periodically runs brand scans for active brands
every 6 hours (the default monitoring cycle).
"""
import asyncio
from datetime import datetime, timedelta, timezone

from tracemark_api.services.ai import make_decision
from tracemark_api.services.database import create_case, get_supabase, save_decision, save_evidence
from tracemark_api.services.detection_funnel import (
    filter_evidence_by_scored,
    run_tier0_and_filter,
    run_tier1,
)
from tracemark_api.services.evidence_scorer import score_evidence
from tracemark_api.services.marketplace import gather_evidence
from tracemark_api.services.persistence import (
    persist_all_infringements,
    persist_scored_evidence_item,
)
from tracemark_api.services.takedown import generate_takedown_reports

SCAN_INTERVAL_HOURS = 6


async def scan_single_brand(brand: dict) -> None:
    """Execute a full monitoring scan cycle for a single brand."""
    brand_id = brand.get("id")
    brand_name = brand.get("brand_name")
    org_id = brand.get("organization_id")
    if not brand_name or not brand_id:
        return

    platforms = brand.get("platforms") or ["amazon", "ebay", "google_ads", "meta_ads", "domains"]
    target_regions = brand.get("target_regions") or ["US"]
    official_advertisers = brand.get("official_advertisers") or None
    official_domains = brand.get("official_domains") or None
    client_id = brand.get("client_id")
    detection_region = target_regions[0] if target_regions else "US"

    print(f"[ScanScheduler] Starting 6-hour scheduled scan for brand '{brand_name}' ({brand_id})")

    try:
        evidence = await gather_evidence(
            brand_name=brand_name,
            platforms=platforms,
            official_advertisers=official_advertisers,
            caller_id=f"scheduler:{brand_id}",
            official_domains=official_domains,
            countries=[r.upper() for r in target_regions if r.strip()] or ["US"],
        )

        evidence, scored_items = run_tier0_and_filter(evidence, brand_name)

        if brand_id and scored_items:
            scored_items = await asyncio.to_thread(
                run_tier1, evidence, scored_items, brand_id,
            )
            evidence = filter_evidence_by_scored(evidence, scored_items)
            scored_items = [s for s in scored_items if s.verdict != "obvious_non_match"]

        if scored_items:
            score_map = {item.source_url: item.overall_score for item in scored_items}
            for d in evidence.domains:
                target_url = f"https://{d.domain_name}"
                if target_url in score_map:
                    d.similarity_score = int(score_map[target_url] * 100)

        has_evidence = bool(
            evidence.marketplaces or evidence.ads or evidence.domains or evidence.social
        )

        if has_evidence:
            case_id = create_case(
                brand_name=brand_name,
                organization_id=org_id,
                detection_region=detection_region,
                target_regions=target_regions,
                client_id=client_id,
                user_id=None,
            )
            save_evidence(case_id, evidence)
            try:
                persist_all_infringements(case_id, evidence, scored_items=scored_items)
            except Exception as e:
                print(f"[ScanScheduler] Failed to persist infringements for {brand_name}: {e}")

            if scored_items:
                try:
                    for scored in scored_items:
                        persist_scored_evidence_item(case_id, scored)
                except Exception as e:
                    print(f"[ScanScheduler] Failed to persist scored items: {e}")

            decision = make_decision(evidence, scored_items=scored_items if scored_items else None)
            score = score_evidence(evidence)
            save_decision(case_id, decision, score=score)
            generate_takedown_reports(
                case_id=case_id,
                brand_name=brand_name,
                decision=decision,
                evidence=evidence,
            )
            print(f"[ScanScheduler] Completed scan for '{brand_name}': created case {case_id}")
        else:
            print(f"[ScanScheduler] Completed scan for '{brand_name}': 0 infringements found")

        # Update last_scan_at on the brand row
        sb = get_supabase()
        sb.table("brands").update({"last_scan_at": datetime.now(timezone.utc).isoformat()}).eq("id", brand_id).execute()

    except Exception as exc:
        print(f"[ScanScheduler] Error during scheduled scan for '{brand_name}': {exc}")


async def run_due_brand_scans() -> None:
    """Find all active brands due for a scan and trigger their scan cycles."""
    try:
        sb = get_supabase()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=SCAN_INTERVAL_HOURS)

        res = sb.table("brands").select("*").neq("status", "on_hold").execute()
        brands = res.data or []

        for brand in brands:
            last_scan = brand.get("last_scan_at")
            is_due = False
            if not last_scan:
                is_due = True
            else:
                try:
                    dt = datetime.fromisoformat(str(last_scan).replace("Z", "+00:00"))
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if dt <= cutoff:
                        is_due = True
                except Exception:
                    is_due = True

            if is_due:
                await scan_single_brand(brand)
    except Exception as e:
        print(f"[ScanScheduler] Error checking due brand scans: {e}")


def run_scan_scheduler_loop() -> None:
    """Entrypoint for the background daemon thread."""
    import time
    time.sleep(120)  # Wait 2 minutes after startup before running first check
    while True:
        try:
            asyncio.run(run_due_brand_scans())
        except Exception as e:
            print(f"[ScanScheduler] Loop exception: {e}")
        time.sleep(15 * 60)  # Re-check for due brands every 15 minutes
