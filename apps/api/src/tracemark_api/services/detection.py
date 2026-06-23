"""
Detection engine: keyword and image matching for brand infringement.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel
from rapidfuzz import fuzz


class MatchResult(BaseModel):
    matched: bool
    score: float        # 0.0 – 1.0
    match_type: Literal["keyword", "none"]


def keyword_matcher(
    brand_name: str,
    text: str,
    threshold: float = 0.80,
) -> MatchResult:
    """
    Fuzzy keyword match using Levenshtein distance (via rapidfuzz).

    Uses partial_ratio so a brand name of "Nike" will match inside a long
    product title like "Best Nike Running Shoes 2024" with score=1.0, and
    will also catch typosquats like "N1ke" or "Nikee" above the threshold.

    Args:
        brand_name: The protected brand (e.g. "Nike").
        text:       The product title, description, or domain to check.
        threshold:  Minimum similarity to consider a match (default 0.80).

    Returns:
        MatchResult with matched=True if score >= threshold.
    """
    if not brand_name or not text:
        return MatchResult(matched=False, score=0.0, match_type="none")

    brand = brand_name.lower().strip()
    haystack = text.lower()

    # partial_ratio finds the highest-scoring window of len(brand) in haystack.
    # Catches "nike" inside "best nike shoes" as well as short edits like "nikee".
    score = fuzz.partial_ratio(brand, haystack) / 100.0
    matched = score >= threshold

    return MatchResult(
        matched=matched,
        score=round(score, 4),
        match_type="keyword" if matched else "none",
    )
