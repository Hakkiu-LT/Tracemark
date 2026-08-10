"""
Tiered detection funnel: deterministic pre-filter (Tier 0) that runs on every
scraped candidate before any LLM call.

Tier 0 signals (no AI, milliseconds):
- Typosquatting distance (Levenshtein on domain labels)
- Brand name/keyword match in text/URL (rapidfuzz)
- Domain age from WHOIS creation date
- Registrar reputation (known abuse-friendly registrars)
- SSL certificate issuer anomalies
- Ad-hijack heuristic score (for ads)

Each candidate is classified as:
- obvious_copycat  -> auto-flagged, skip LLM
- obvious_non_match -> auto-dismissed, skip LLM
- ambiguous -> advances to Tier 1 / Tier 2
"""
from __future__ import annotations

import socket
import ssl
from datetime import datetime, timezone

from tracemark_api.services.ai import (
    AdEvidence,
    CriterionScore,
    DomainEvidence,
    Evidence,
    MarketplaceEvidence,
    ScoredEvidenceItem,
    SocialEvidence,
    Tier0Signals,
    Tier1Signals,
)
from tracemark_api.services.detection import keyword_matcher, typosquat_distance
from tracemark_api.services.embedding_helper import (
    compute_screenshot_phash,
    cosine_similarity,
    embed_text,
    ensure_official_site_reference,
    extract_logo_phash_from_url,
    get_brand_reference_assets,
    phash_similarity,
)
from tracemark_api.services.storage import compute_content_hash

# ── Thresholds ────────────────────────────────────────────────────────────────

_TYPOSQUAT_COPYCAT = 2
_TYPOSQUAT_UNRELATED = 8
_BRAND_MATCH_COPYCAT = 0.95
_BRAND_MATCH_UNRELATED = 0.50
_DOMAIN_AGE_NEW = 30
_DOMAIN_AGE_OLD = 3650
_AD_HIJACK_COPYCAT = 80

# ── Registrar reputation ─────────────────────────────────────────────────────

_SUSPICIOUS_REGISTRARS = {
    "alibaba", "china network", "bizcn", "22net", "jiangsu bangning",
    "chengdu west dimension", "hui cheng", "reg.ru", "naunet",
}

_TRUSTED_REGISTRARS = {
    "godaddy", "markmonitor", "verisign", "csc corporate", "namesilo",
    "cloudflare", "google domains", "squarespace", "namecheap", "porkbun",
    "gandi", "dynadot", "enom", "tucows", "key-systems",
}

_HIJACKING_SIGNALS = (
    "official", "authentic", "sale", "discount", "free shipping",
    "limited time", "up to", "% off", "shop now", "buy now", "clearance",
)


# ── Signal helpers ────────────────────────────────────────────────────────────

def _registrar_reputation(registrar: str | None) -> str:
    if not registrar:
        return "unknown"
    r = registrar.lower()
    for s in _SUSPICIOUS_REGISTRARS:
        if s in r:
            return "suspicious"
    for t in _TRUSTED_REGISTRARS:
        if t in r:
            return "trusted"
    return "neutral"


def _domain_age_days(creation_date: str | None) -> int | None:
    if not creation_date:
        return None
    try:
        dt = datetime.fromisoformat(creation_date.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        try:
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d-%b-%Y"):
                try:
                    dt = datetime.strptime(creation_date, fmt)
                    break
                except ValueError:
                    continue
            else:
                return None
        except Exception:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return max((datetime.now(timezone.utc) - dt).days, 0)


def _check_ssl(hostname: str, timeout: float = 3.0) -> tuple[str | None, bool]:
    """Check SSL certificate issuer. Returns (issuer_org, is_suspicious)."""
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with socket.create_connection((hostname, 443), timeout=timeout) as sock:
            with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                issuer_parts = cert.get("issuer", ())
                org = ""
                for rdn in issuer_parts:
                    for key, val in rdn:
                        if key in ("organizationName", "commonName"):
                            org = val
                            break
                    if org:
                        break
                suspicious = any(
                    kw in org.lower()
                    for kw in ("let's encrypt", "self-signed", "unknown")
                )
                return org or None, suspicious
    except Exception:
        return None, False


def _compute_ad_hijack_score(ad_text: str, advertiser: str, brand_name: str) -> int:
    text = f"{ad_text} {advertiser}".lower()
    brand = brand_name.lower()
    score = 0
    if brand in text:
        score += 40
    if any(signal in text for signal in _HIJACKING_SIGNALS):
        score += 20
    if brand in advertiser.lower():
        score += 30
    return min(score, 100)


def _classify(tier0: Tier0Signals) -> str:
    """Classify based on Tier 0 signals."""
    if tier0.ad_hijack_score is not None and tier0.ad_hijack_score >= _AD_HIJACK_COPYCAT:
        return "obvious_copycat"

    if tier0.typosquat_distance is not None:
        if tier0.typosquat_distance <= _TYPOSQUAT_COPYCAT:
            return "obvious_copycat"
        if (
            tier0.typosquat_distance >= _TYPOSQUAT_UNRELATED
            and tier0.brand_name_match_score < _BRAND_MATCH_UNRELATED
        ):
            return "obvious_non_match"

    if tier0.brand_name_match_score >= _BRAND_MATCH_COPYCAT:
        if tier0.domain_age_days is not None and tier0.domain_age_days < _DOMAIN_AGE_NEW:
            return "obvious_copycat"
        if tier0.registrar_reputation == "suspicious":
            return "obvious_copycat"

    if (
        tier0.brand_name_match_score < _BRAND_MATCH_UNRELATED
        and (tier0.domain_age_days is None or tier0.domain_age_days > _DOMAIN_AGE_OLD)
        and tier0.registrar_reputation == "trusted"
    ):
        return "obvious_non_match"

    return "ambiguous"


def _overall_tier0_score(tier0: Tier0Signals) -> float:
    """Aggregate the individual signals into a 0-1 score."""
    score = 0.0
    if tier0.brand_name_match_score >= _BRAND_MATCH_COPYCAT:
        score += 0.4
    elif tier0.brand_name_match_score >= 0.80:
        score += 0.25
    elif tier0.brand_name_match_score >= _BRAND_MATCH_UNRELATED:
        score += 0.1

    if tier0.typosquat_distance is not None:
        if tier0.typosquat_distance <= _TYPOSQUAT_COPYCAT:
            score += 0.3
        elif tier0.typosquat_distance <= 4:
            score += 0.15

    if tier0.domain_age_days is not None:
        if tier0.domain_age_days < _DOMAIN_AGE_NEW:
            score += 0.15
        elif tier0.domain_age_days > _DOMAIN_AGE_OLD:
            score -= 0.1

    if tier0.registrar_reputation == "suspicious":
        score += 0.1
    elif tier0.registrar_reputation == "trusted":
        score -= 0.05

    if tier0.ssl_suspicious:
        score += 0.05

    if tier0.ad_hijack_score is not None:
        score += (tier0.ad_hijack_score / 100.0) * 0.3

    return max(0.0, min(1.0, score))


# ── Per-type scorers ─────────────────────────────────────────────────────────

def _score_marketplace(
    item: MarketplaceEvidence,
    brand_name: str,
) -> ScoredEvidenceItem:
    text = f"{item.title or ''} {item.seller_name} {item.listing_url}".strip()
    match = keyword_matcher(brand_name, text)
    matched_target = item.title or item.seller_name or item.listing_url
    criteria = [
        CriterionScore(
            name="brand_name_match",
            score=match.score,
            evidence=f"Matched '{brand_name}' in title/seller/URL: {matched_target}",
        ),
    ]
    tier0 = Tier0Signals(
        brand_name_match_score=match.score,
        overall_score=0.0,
        classification="ambiguous",
    )
    tier0.overall_score = _overall_tier0_score(tier0)
    tier0.classification = _classify(tier0)

    return ScoredEvidenceItem(
        source_url=item.listing_url,
        platform=item.platform,
        screenshot_url=item.screenshot_url,
        tier0=tier0,
        overall_score=tier0.overall_score,
        verdict=tier0.classification if tier0.classification != "ambiguous" else "ambiguous",
        category=["marketplace_listing"],
        criteria=criteria,
        confidence="high" if tier0.classification != "ambiguous" else "low",
    )


def _score_ad(
    item: AdEvidence,
    brand_name: str,
) -> ScoredEvidenceItem:
    match = keyword_matcher(brand_name, item.ad_copy)
    hijack = _compute_ad_hijack_score(item.ad_copy, item.platform, brand_name)
    criteria = [
        CriterionScore(
            name="brand_name_match",
            score=match.score,
            evidence=f"Matched '{brand_name}' in ad copy",
        ),
        CriterionScore(
            name="ad_hijack_score",
            score=hijack / 100.0,
            evidence=f"Hijacking heuristic: {hijack}/100",
        ),
    ]
    tier0 = Tier0Signals(
        brand_name_match_score=match.score,
        ad_hijack_score=hijack,
        overall_score=0.0,
        classification="ambiguous",
    )
    tier0.overall_score = _overall_tier0_score(tier0)
    tier0.classification = _classify(tier0)

    return ScoredEvidenceItem(
        source_url=item.destination_url,
        platform=item.platform,
        screenshot_url=item.screenshot_url,
        tier0=tier0,
        overall_score=tier0.overall_score,
        verdict=tier0.classification if tier0.classification != "ambiguous" else "ambiguous",
        category=["ad_hijacking"],
        criteria=criteria,
        confidence="high" if tier0.classification != "ambiguous" else "low",
    )


def _score_domain(
    item: DomainEvidence,
    brand_name: str,
) -> ScoredEvidenceItem:
    dist = typosquat_distance(brand_name, item.domain_name)
    match = keyword_matcher(brand_name, item.domain_name)
    age = _domain_age_days(item.creation_date)
    rep = _registrar_reputation(item.registrar)

    hostname = item.domain_name
    ssl_issuer, ssl_suspicious = _check_ssl(hostname)

    criteria = [
        CriterionScore(
            name="typosquat_distance",
            score=max(0.0, 1.0 - dist / 10.0),
            evidence=f"Levenshtein distance: {dist}",
        ),
        CriterionScore(
            name="brand_name_match",
            score=match.score,
            evidence=f"Brand match in domain: {item.domain_name}",
        ),
    ]
    if age is not None:
        criteria.append(CriterionScore(
            name="domain_age",
            score=max(0.0, 1.0 - age / 3650.0),
            evidence=f"Domain age: {age} days (created {item.creation_date})",
        ))
    criteria.append(CriterionScore(
        name="registrar_reputation",
        score={"trusted": 0.1, "neutral": 0.5, "suspicious": 0.9, "unknown": 0.5}[rep],
        evidence=f"Registrar: {item.registrar} ({rep})",
    ))

    tier0 = Tier0Signals(
        typosquat_distance=dist,
        brand_name_match_score=match.score,
        domain_age_days=age,
        registrar_reputation=rep,
        ssl_issuer=ssl_issuer,
        ssl_suspicious=ssl_suspicious,
        overall_score=0.0,
        classification="ambiguous",
    )
    tier0.overall_score = _overall_tier0_score(tier0)
    tier0.classification = _classify(tier0)

    return ScoredEvidenceItem(
        source_url=f"https://{item.domain_name}",
        platform="domain",
        screenshot_url=item.screenshot_url,
        tier0=tier0,
        overall_score=tier0.overall_score,
        verdict=tier0.classification if tier0.classification != "ambiguous" else "ambiguous",
        category=["typosquatting"] if dist <= _TYPOSQUAT_COPYCAT else ["lookalike_domain"],
        criteria=criteria,
        confidence="high" if tier0.classification != "ambiguous" else "low",
    )


def _score_social(
    item: SocialEvidence,
    brand_name: str,
) -> ScoredEvidenceItem:
    text = f"{item.handle} {item.platform}"
    match = keyword_matcher(brand_name, text)
    criteria = [
        CriterionScore(
            name="brand_name_match",
            score=match.score,
            evidence=f"Matched '{brand_name}' in handle: {item.handle}",
        ),
    ]
    tier0 = Tier0Signals(
        brand_name_match_score=match.score,
        overall_score=0.0,
        classification="ambiguous",
    )
    tier0.overall_score = _overall_tier0_score(tier0)
    tier0.classification = _classify(tier0)

    url = item.post_url or f"https://{item.platform.lower()}.com/{item.handle}"
    return ScoredEvidenceItem(
        source_url=url,
        platform=item.platform,
        screenshot_url=None,
        tier0=tier0,
        overall_score=tier0.overall_score,
        verdict=tier0.classification if tier0.classification != "ambiguous" else "ambiguous",
        category=["social_impersonation"],
        criteria=criteria,
        confidence="high" if tier0.classification != "ambiguous" else "low",
    )


# ── Public API ────────────────────────────────────────────────────────────────

def run_tier0(
    evidence: Evidence,
    brand_name: str,
    brand_website: str | None = None,
) -> list[ScoredEvidenceItem]:
    """
    Run Tier 0 deterministic signals on every evidence item.

    Returns a list of ScoredEvidenceItem objects, one per evidence item,
    with the ``tier0`` field populated and ``verdict`` set based on the
    deterministic classification.
    """
    results: list[ScoredEvidenceItem] = []

    for item in evidence.marketplaces:
        results.append(_score_marketplace(item, brand_name))
    for item in evidence.ads:
        results.append(_score_ad(item, brand_name))
    for item in evidence.domains:
        results.append(_score_domain(item, brand_name))
    for item in evidence.social:
        results.append(_score_social(item, brand_name))

    return results


def run_tier0_and_filter(
    evidence: Evidence,
    brand_name: str,
    brand_website: str | None = None,
) -> tuple[Evidence, list[ScoredEvidenceItem]]:
    """
    Run Tier 0 and return (filtered_evidence, scored_items).

    Items classified as ``obvious_non_match`` are removed from both the
    Evidence object and the scored list. If all items are filtered out,
    the returned Evidence will be empty (caller should check).
    """
    scored = run_tier0(evidence, brand_name, brand_website)
    non_match_urls = {item.source_url for item in scored if item.verdict == "obvious_non_match"}

    if not non_match_urls:
        return evidence, scored

    filtered = evidence.model_copy(deep=True)
    filtered.marketplaces = [
        m for m in filtered.marketplaces if m.listing_url not in non_match_urls
    ]
    filtered.ads = [
        a for a in filtered.ads if a.destination_url not in non_match_urls
    ]
    filtered.domains = [
        d for d in filtered.domains
        if f"https://{d.domain_name}" not in non_match_urls
    ]
    filtered.social = [
        s for s in filtered.social
        if (s.post_url or f"https://{s.platform.lower()}.com/{s.handle}") not in non_match_urls
    ]

    scored = [item for item in scored if item.verdict != "obvious_non_match"]
    return filtered, scored


def filter_evidence_by_scored(
    evidence: Evidence,
    scored_items: list[ScoredEvidenceItem],
) -> Evidence:
    """Filter an Evidence object to remove items whose scored verdict is
    ``obvious_non_match``. Used after Tier 1 reclassifies items."""
    non_match_urls = {s.source_url for s in scored_items if s.verdict == "obvious_non_match"}
    if not non_match_urls:
        return evidence

    filtered = evidence.model_copy(deep=True)
    filtered.marketplaces = [
        m for m in filtered.marketplaces if m.listing_url not in non_match_urls
    ]
    filtered.ads = [
        a for a in filtered.ads if a.destination_url not in non_match_urls
    ]
    filtered.domains = [
        d for d in filtered.domains
        if f"https://{d.domain_name}" not in non_match_urls
    ]
    filtered.social = [
        s for s in filtered.social
        if (s.post_url or f"https://{s.platform.lower()}.com/{s.handle}") not in non_match_urls
    ]
    return filtered


def filter_by_verdict(
    scored_items: list[ScoredEvidenceItem],
    keep: tuple[str, ...] = ("obvious_copycat", "likely_copycat", "ambiguous"),
) -> list[ScoredEvidenceItem]:
    """Filter scored items by verdict. Default: keep everything except obvious_non_match."""
    return [item for item in scored_items if item.verdict in keep]


def verdict_to_risk_level(verdict: str, overall_score: float) -> tuple[str, float]:
    """Map a ScoredEvidenceItem verdict + score to (risk_level, match_score)
    for the infringements table."""
    if verdict in ("obvious_copycat", "likely_copycat"):
        if overall_score >= 0.80:
            return "HIGH", round(overall_score, 2)
        if overall_score >= 0.50:
            return "MEDIUM", round(overall_score, 2)
        return "LOW", round(overall_score, 2)
    if verdict == "obvious_non_match":
        return "LOW", round(overall_score, 2)
    return "MEDIUM" if overall_score >= 0.40 else "LOW", round(overall_score, 2)


# ── Tier 1: similarity scoring (no LLM) ───────────────────────────────────────

_TIER1_COPYCAT = 0.85
_TIER1_UNRELATED = 0.30


def _evidence_text(item: MarketplaceEvidence | AdEvidence | DomainEvidence | SocialEvidence) -> str:
    """Extract a text representation of an evidence item for embedding."""
    if isinstance(item, MarketplaceEvidence):
        return f"{item.seller_name} {item.listing_url} {item.price or ''}"
    if isinstance(item, AdEvidence):
        return f"{item.ad_copy} {item.destination_url}"
    if isinstance(item, DomainEvidence):
        return f"{item.domain_name} {item.registrant_organization or ''}"
    if isinstance(item, SocialEvidence):
        return f"{item.handle} {item.platform}"
    return ""


def _parse_embedding(raw: any) -> list[float] | None:
    """Parse a pgvector embedding from the DB (string or list) into a float list."""
    if raw is None:
        return None
    if isinstance(raw, list):
        return [float(x) for x in raw]
    if isinstance(raw, str):
        try:
            cleaned = raw.strip("[]() ")
            return [float(x.strip()) for x in cleaned.split(",") if x.strip()]
        except (ValueError, IndexError):
            return None
    return None


def _classify_tier1(tier1: Tier1Signals) -> str:
    """Classify based on Tier 1 similarity signals."""
    scores = [
        s for s in [tier1.text_similarity, tier1.visual_similarity,
                    tier1.logo_similarity, tier1.product_similarity]
        if s is not None
    ]
    if not scores:
        return "ambiguous"

    max_score = max(scores)
    min_score = min(scores)

    if max_score >= _TIER1_COPYCAT:
        return "obvious_copycat"
    if max_score < _TIER1_UNRELATED and min_score < _TIER1_UNRELATED:
        return "obvious_non_match"
    return "ambiguous"


def _overall_tier1_score(tier1: Tier1Signals) -> float:
    """Aggregate Tier 1 signals into a 0-1 score."""
    scores = [
        s for s in [tier1.text_similarity, tier1.visual_similarity,
                    tier1.logo_similarity, tier1.product_similarity]
        if s is not None
    ]
    if not scores:
        return 0.0
    return round(sum(scores) / len(scores), 4)


def run_tier1(
    evidence: Evidence,
    scored_items: list[ScoredEvidenceItem],
    brand_id: str | None = None,
) -> list[ScoredEvidenceItem]:
    """
    Run Tier 1 similarity scoring on all ambiguous items from Tier 0.

    For each ambiguous item, computes:
    - text_similarity:     cosine similarity of evidence text embedding vs
                           brand reference content embedding (pgvector/Gemini)
    - visual_similarity:   pHash similarity of screenshot vs reference logo
    - logo_similarity:     pHash similarity of screenshot vs reference logo
    - product_similarity:  pHash similarity of screenshot vs reference product image
    - content_hash:        SHA-256 of evidence text for dedup/caching

    Items already classified as obvious_copycat or obvious_non_match by Tier 0
    are passed through unchanged.

    Requires brand reference assets (uploaded via POST /brands/{id}/assets).
    If no reference assets exist, all ambiguous items stay ambiguous.
    """
    if not brand_id:
        return scored_items

    ensure_official_site_reference(brand_id)

    ref_assets = get_brand_reference_assets(brand_id)
    if not ref_assets:
        return scored_items

    ref_content_embeddings = []
    ref_logo_phashes: list[int] = []
    ref_product_phashes: list[int] = []

    for asset in ref_assets:
        atype = asset.get("asset_type")
        if atype == "reference_content":
            emb = _parse_embedding(asset.get("embedding"))
            if emb:
                ref_content_embeddings.append(emb)
        elif atype == "logo":
            ph = asset.get("phash")
            if ph is not None:
                ref_logo_phashes.append(int(ph))
        elif atype == "product_image":
            ph = asset.get("phash")
            if ph is not None:
                ref_product_phashes.append(int(ph))

    has_text_refs = len(ref_content_embeddings) > 0
    has_logo_refs = len(ref_logo_phashes) > 0
    has_product_refs = len(ref_product_phashes) > 0

    if not has_text_refs and not has_logo_refs and not has_product_refs:
        return scored_items

    evidence_map: dict[str, any] = {}
    for item in evidence.marketplaces:
        evidence_map[item.listing_url] = item
    for item in evidence.ads:
        evidence_map[item.destination_url] = item
    for item in evidence.domains:
        evidence_map[f"https://{item.domain_name}"] = item
    for item in evidence.social:
        url = item.post_url or f"https://{item.platform.lower()}.com/{item.handle}"
        evidence_map[url] = item

    for scored in scored_items:
        if scored.verdict in ("obvious_copycat", "obvious_non_match"):
            continue

        orig_item = evidence_map.get(scored.source_url)
        if orig_item is None:
            continue

        text = _evidence_text(orig_item)
        chash = compute_content_hash(text)

        text_sim = None
        if has_text_refs:
            emb = embed_text(text)
            if emb:
                sims = [cosine_similarity(emb, ref) for ref in ref_content_embeddings]
                text_sim = round(max(sims), 4) if sims else None

        visual_sim = None
        logo_sim = None
        product_sim = None

        if (has_logo_refs or has_product_refs) and scored.screenshot_url:
            # Approach A: try to extract the logo from the page HTML first
            # (more precise than whole-screenshot pHash). Fall back to
            # screenshot pHash if no logo is found in the HTML.
            logo_phash = None
            if has_logo_refs:
                logo_phash = extract_logo_phash_from_url(scored.source_url)

            if logo_phash is not None and has_logo_refs:
                logo_sims = [phash_similarity(logo_phash, ref) for ref in ref_logo_phashes]
                logo_sim = max(logo_sims) if logo_sims else None
                visual_sim = logo_sim
            else:
                # Fall back to whole-screenshot pHash
                ss_phash = compute_screenshot_phash(scored.screenshot_url)
                if ss_phash is not None:
                    if has_logo_refs:
                        logo_sims = [phash_similarity(ss_phash, ref) for ref in ref_logo_phashes]
                        logo_sim = max(logo_sims) if logo_sims else None
                    if has_product_refs:
                        prod_sims = [phash_similarity(ss_phash, ref) for ref in ref_product_phashes]
                        product_sim = max(prod_sims) if prod_sims else None
                    if has_logo_refs and has_product_refs:
                        all_visual = [phash_similarity(ss_phash, ref) for ref in ref_logo_phashes + ref_product_phashes]
                        visual_sim = max(all_visual) if all_visual else None
                    elif has_logo_refs:
                        visual_sim = logo_sim
                    elif has_product_refs:
                        visual_sim = product_sim

        tier1 = Tier1Signals(
            text_similarity=text_sim,
            visual_similarity=visual_sim,
            logo_similarity=logo_sim,
            product_similarity=product_sim,
            content_hash=chash,
            overall_score=0.0,
            classification="ambiguous",
        )
        tier1.overall_score = _overall_tier1_score(tier1)
        tier1.classification = _classify_tier1(tier1)

        scored.tier1 = tier1
        scored.content_hash = chash

        if tier1.classification == "obvious_copycat":
            scored.verdict = "obvious_copycat"
            scored.overall_score = max(scored.overall_score, tier1.overall_score)
            scored.confidence = "high"
        elif tier1.classification == "obvious_non_match":
            scored.verdict = "obvious_non_match"
            scored.overall_score = min(scored.overall_score, tier1.overall_score)
            scored.confidence = "high"
        else:
            avg = (scored.overall_score + tier1.overall_score) / 2.0
            scored.overall_score = round(avg, 4)
            if avg >= 0.65:
                scored.verdict = "likely_copycat"
                scored.confidence = "medium"

        if text_sim is not None:
            scored.criteria.append(CriterionScore(
                name="text_similarity",
                score=text_sim,
                evidence=f"Cosine similarity vs reference content: {text_sim}",
            ))
        if visual_sim is not None:
            scored.criteria.append(CriterionScore(
                name="visual_similarity",
                score=visual_sim,
                evidence=f"pHash similarity vs reference image: {visual_sim}",
            ))
        if logo_sim is not None:
            scored.criteria.append(CriterionScore(
                name="logo_similarity",
                score=logo_sim,
                evidence=f"pHash similarity vs reference logo: {logo_sim}",
            ))
        if product_sim is not None:
            scored.criteria.append(CriterionScore(
                name="product_similarity",
                score=product_sim,
                evidence=f"pHash similarity vs reference product: {product_sim}",
            ))

    return scored_items
