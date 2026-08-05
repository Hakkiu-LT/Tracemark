"""
Detection engine: keyword, image-hash, OCR, and typosquat matching for brand
infringement.

These matchers are the canonical implementations for the tiered detection
funnel:
  Tier 0 (deterministic, no AI):  keyword_matcher, typosquat_distance
  Tier 1 (similarity, no LLM):    hash_matcher
  Tier 2 (LLM adjudication):      ocr_extract_text (Gemini Vision)
"""
from __future__ import annotations

import io
import os
from typing import Literal

import imagehash
from PIL import Image
from pydantic import BaseModel
from rapidfuzz import fuzz
from rapidfuzz.distance import Levenshtein


class MatchResult(BaseModel):
    matched: bool
    score: float        # 0.0 – 1.0
    match_type: Literal["keyword", "image_hash", "none"]


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


def hash_matcher(
    reference_img: Image.Image,
    candidate_img: Image.Image,
    max_distance: int = 10,
    caller_id: str = "system",
    endpoint: str = "/hash-match",
) -> MatchResult:
    """
    Compare two images using Perceptual Hashing (pHash).

    pHash reduces an image to a compact 64-bit hash that captures its visual
    structure (luminance gradients via DCT).  Two visually similar images —
    even after resizing, compression, or minor colour shifts — will have
    hashes with a low Hamming distance.

    Args:
        reference_img:  The original brand logo / product image (PIL Image).
        candidate_img:  The scraped / screenshot image to compare (PIL Image).
        max_distance:   Maximum Hamming distance to consider a match (0‥64).
                        Lower = stricter.  Default 10 catches resizes and
                        moderate JPEG artefacts while rejecting unrelated images.
        caller_id:      Identifier of the calling entity for usage tracking.
        endpoint:       FastAPI endpoint path triggering the tracking.

    Returns:
        MatchResult with score normalised to 0.0–1.0 (1.0 = identical hash).
    """
    from tracemark_api.services.api_usage_tracker import call_with_tracking

    def _execute() -> MatchResult:
        ref_hash = imagehash.phash(reference_img)
        cand_hash = imagehash.phash(candidate_img)

        # Hamming distance: number of differing bits (0 = identical)
        distance = ref_hash - cand_hash

        # Normalise: 0 distance → 1.0 score, 64 distance → 0.0 score
        score = 1.0 - (distance / 64.0)
        matched = distance <= max_distance

        return MatchResult(
            matched=matched,
            score=round(score, 4),
            match_type="image_hash" if matched else "none",
        )

    try:
        return call_with_tracking(
            "image_hash",
            caller_id,
            endpoint,
            _execute,
        )
    except Exception:
        return MatchResult(matched=False, score=0.0, match_type="none")


def ocr_extract_text(
    image: Image.Image | bytes,
    brand_name: str = "",
) -> str:
    """
    Extract brand-relevant text from a screenshot using Gemini Vision.

    This is a lightweight helper — it returns the raw extracted text so the
    caller can feed it into ``keyword_matcher`` or any other downstream check.

    Args:
        image:      A PIL Image or raw image bytes (PNG / JPEG / WebP).
        brand_name: Optional brand hint so Gemini can focus on relevant text.

    Returns:
        Extracted text as a string, or "" on failure / missing API key.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return ""

    try:
        import base64

        from langchain_core.messages import HumanMessage
        from langchain_google_genai import ChatGoogleGenerativeAI

        # Convert PIL Image → base64 PNG bytes
        if isinstance(image, Image.Image):
            buf = io.BytesIO()
            image.save(buf, format="PNG")
            image_bytes = buf.getvalue()
        else:
            image_bytes = image

        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        brand_hint = (
            f' Pay special attention to any text related to the brand "{brand_name}".'
            if brand_name
            else ""
        )

        message = HumanMessage(
            content=[
                {
                    "type": "text",
                    "text": (
                        "Extract ALL visible text from this image. "
                        "Include product titles, descriptions, brand names, prices, "
                        "and any watermark or overlay text."
                        f"{brand_hint} "
                        "Return ONLY the extracted text, nothing else."
                    ),
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64_image}"},
                },
            ]
        )

        model = ChatGoogleGenerativeAI(
            model="gemini-3.5-flash",
            temperature=0.0,
            google_api_key=api_key,
        )

        from tracemark_api.services.api_usage_tracker import call_with_tracking
        response = call_with_tracking(
            "gemini_flash", "system", "/ocr",
            lambda: model.invoke([message]),
        )
        return response.content.strip()

    except Exception as e:
        print(f"[Detection] OCR extraction failed: {e}")
        return ""


def typosquat_distance(brand_name: str, domain_name: str) -> int:
    """
    Compute the Levenshtein edit distance between a brand name and the
    registrable part of a domain (the label before the TLD).

    A distance of 0 means the domain contains the exact brand name.
    A distance of 1-2 typically indicates a typosquat (e.g. "nike" vs "n1ke").
    Distances >= 5 are almost certainly unrelated.

    Args:
        brand_name:  The protected brand (e.g. "Derila").
        domain_name: The full domain (e.g. "deri1a.com") or just the label.

    Returns:
        The Levenshtein distance (int). Lower = more similar.
    """
    if not brand_name or not domain_name:
        return 999

    brand = brand_name.lower().strip()

    domain = domain_name.lower().strip()
    if "." in domain:
        parts = domain.split(".")
        if len(parts) >= 2:
            domain = parts[0]

    return Levenshtein.distance(brand, domain)
