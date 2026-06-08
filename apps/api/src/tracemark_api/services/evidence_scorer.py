from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tracemark_api.services.ai import Evidence


@dataclass
class EvidenceScore:
    total_score: float
    quality_label: str           # "STRONG" | "MODERATE" | "WEAK"
    marketplace_score: float
    ads_score: float
    domains_score: float
    social_score: float
    top_findings: list[str]
    is_empty: bool


def score_evidence(evidence: "Evidence") -> EvidenceScore:
    """
    Scores incoming Evidence across 4 dimensions and returns a quality rating.

    Scoring weights:
    - Marketplace listings: 40%  (most direct proof of counterfeiting)
    - Ads:                  30%  (impersonation via paid ads is high-value signal)
    - Domains:              20%  (typosquatting is lower severity but common)
    - Social:               10%  (supporting signal)
    """
    mp_count = len(evidence.marketplaces)
    ads_count = len(evidence.ads)
    domains_count = len(evidence.domains)
    social_count = len(evidence.social)
    total_count = mp_count + ads_count + domains_count + social_count

    if total_count == 0:
        return EvidenceScore(
            total_score=0.0,
            quality_label="WEAK",
            marketplace_score=0.0,
            ads_score=0.0,
            domains_score=0.0,
            social_score=0.0,
            top_findings=[],
            is_empty=True,
        )

    mp_score = min(mp_count / 10, 1.0)
    ads_score = min(ads_count / 5, 1.0)
    domains_score = min(domains_count / 5, 1.0)
    social_score = min(social_count / 3, 1.0)

    total = (
        mp_score * 0.40
        + ads_score * 0.30
        + domains_score * 0.20
        + social_score * 0.10
    )

    if total >= 0.65:
        label = "STRONG"
    elif total >= 0.30:
        label = "MODERATE"
    else:
        label = "WEAK"

    findings = _build_findings(evidence, mp_count, ads_count, domains_count, social_count)

    return EvidenceScore(
        total_score=round(total, 3),
        quality_label=label,
        marketplace_score=round(mp_score, 3),
        ads_score=round(ads_score, 3),
        domains_score=round(domains_score, 3),
        social_score=round(social_score, 3),
        top_findings=findings,
        is_empty=False,
    )


def _build_findings(
    evidence: "Evidence",
    mp_count: int,
    ads_count: int,
    domains_count: int,
    social_count: int,
) -> list[str]:
    findings = []
    if mp_count > 0:
        sellers = list({m.seller_name for m in evidence.marketplaces if m.seller_name})[:3]
        findings.append(
            f"{mp_count} suspicious marketplace listing(s) found"
            + (f" — sellers: {', '.join(sellers)}" if sellers else "")
        )
    if ads_count > 0:
        findings.append(f"{ads_count} potentially infringing ad(s) detected on Google/Meta")
    if domains_count > 0:
        domains = [d.domain_name for d in evidence.domains[:3]]
        findings.append(
            f"{domains_count} suspicious domain(s) registered: {', '.join(domains)}"
        )
    if social_count > 0:
        findings.append(f"{social_count} suspicious social media profile(s) detected")
    return findings
