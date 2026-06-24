"""
Unit tests for the detection engine: keyword_matcher, hash_matcher, and ocr_extract_text.
"""
import pytest
from PIL import Image, ImageDraw

from tracemark_api.services.detection import (
    MatchResult,
    hash_matcher,
    keyword_matcher,
    ocr_extract_text,
)


# ──────────────────────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_images():
    """Generate simple in-memory test images with known visual differences."""
    # Image A: blue background with a red rectangle
    img_a = Image.new("RGB", (100, 100), color="blue")
    draw = ImageDraw.Draw(img_a)
    draw.rectangle([20, 20, 80, 80], fill="red")

    # Resized version of A — should have near-identical pHash
    img_a_resized = img_a.resize((50, 50))

    # Completely different image — solid green
    img_b = Image.new("RGB", (100, 100), color="green")

    return img_a, img_a_resized, img_b


# ──────────────────────────────────────────────────────────────────────────────
# keyword_matcher tests
# ──────────────────────────────────────────────────────────────────────────────

class TestKeywordMatcher:
    def test_exact_match(self):
        """Brand name present verbatim in text."""
        res = keyword_matcher("Nike", "Nike Running Shoes 2024")
        assert res.matched is True
        assert res.match_type == "keyword"
        assert res.score == 1.0

    def test_case_insensitive(self):
        """Match should be case-insensitive."""
        res = keyword_matcher("NIKE", "best nike shoes ever")
        assert res.matched is True

    def test_typosquat_match(self):
        """Should catch common typosquats above threshold."""
        res = keyword_matcher("Nike", "Nikee Air Max")
        assert res.matched is True
        assert res.score >= 0.80

    def test_no_match(self):
        """Completely unrelated text → no match."""
        res = keyword_matcher("Nike", "Adidas UltraBoost 22")
        assert res.matched is False
        assert res.match_type == "none"

    def test_empty_brand_name(self):
        """Empty brand name → no match."""
        res = keyword_matcher("", "Nike Shoes")
        assert res.matched is False
        assert res.score == 0.0

    def test_empty_text(self):
        """Empty text → no match."""
        res = keyword_matcher("Nike", "")
        assert res.matched is False
        assert res.score == 0.0

    def test_both_empty(self):
        """Both empty → no match."""
        res = keyword_matcher("", "")
        assert res.matched is False

    def test_custom_threshold_strict(self):
        """Higher threshold rejects partial matches."""
        res = keyword_matcher("Nike", "N1ke", threshold=0.95)
        assert res.matched is False

    def test_custom_threshold_lenient(self):
        """Lower threshold accepts weaker matches."""
        res = keyword_matcher("Nike", "N1ke", threshold=0.50)
        assert res.matched is True

    def test_partial_in_longer_text(self):
        """Brand inside a long product title."""
        res = keyword_matcher(
            "Derila",
            "Best Derila Memory Foam Contoured Pillow - 50% Off Sale",
        )
        assert res.matched is True
        assert res.score == 1.0

    def test_returns_match_result_model(self):
        """Should always return a MatchResult instance."""
        res = keyword_matcher("test", "test")
        assert isinstance(res, MatchResult)


# ──────────────────────────────────────────────────────────────────────────────
# hash_matcher tests
# ──────────────────────────────────────────────────────────────────────────────

class TestHashMatcher:
    def test_identical_images(self, sample_images):
        """Same image compared to itself → exact match."""
        img_a, _, _ = sample_images
        res = hash_matcher(img_a, img_a)
        assert res.matched is True
        assert res.score == 1.0
        assert res.match_type == "image_hash"

    def test_resized_image_matches(self, sample_images):
        """Resized copy should still match (pHash is resolution-invariant)."""
        img_a, img_a_resized, _ = sample_images
        res = hash_matcher(img_a, img_a_resized)
        assert res.matched is True
        assert res.score >= 0.80

    def test_different_images_no_match(self, sample_images):
        """Visually different images → no match."""
        img_a, _, img_b = sample_images
        res = hash_matcher(img_a, img_b, max_distance=5)
        assert res.matched is False
        assert res.match_type == "none"

    def test_score_normalization(self, sample_images):
        """Score should always be between 0.0 and 1.0."""
        img_a, _, img_b = sample_images
        res = hash_matcher(img_a, img_b)
        assert 0.0 <= res.score <= 1.0

    def test_max_distance_zero_strict(self, sample_images):
        """max_distance=0 only matches perfectly identical hashes."""
        img_a, img_a_resized, _ = sample_images
        res = hash_matcher(img_a, img_a, max_distance=0)
        assert res.matched is True
        assert res.score == 1.0

    def test_max_distance_very_high(self, sample_images):
        """max_distance=64 matches everything."""
        img_a, _, img_b = sample_images
        res = hash_matcher(img_a, img_b, max_distance=64)
        assert res.matched is True

    def test_returns_match_result_model(self, sample_images):
        """Should always return a MatchResult instance."""
        img_a, _, _ = sample_images
        res = hash_matcher(img_a, img_a)
        assert isinstance(res, MatchResult)

    def test_error_handling_invalid_input(self):
        """Non-image input should fail gracefully, not crash."""
        # Passing None should trigger the except clause
        res = hash_matcher(None, None)  # type: ignore
        assert res.matched is False
        assert res.score == 0.0
        assert res.match_type == "none"

    def test_grayscale_image(self):
        """pHash should handle grayscale images."""
        gray = Image.new("L", (100, 100), color=128)
        res = hash_matcher(gray, gray)
        assert res.matched is True

    def test_rgba_image(self):
        """pHash should handle RGBA images (with alpha channel)."""
        rgba = Image.new("RGBA", (100, 100), color=(255, 0, 0, 128))
        res = hash_matcher(rgba, rgba)
        assert res.matched is True

    def test_hash_matcher_records_api_usage(self, sample_images):
        """Calling hash_matcher should increment the usage count in the api tracker."""
        from tracemark_api.services.api_usage_tracker import tracker
        img_a, _, _ = sample_images

        # Reset counts for testing
        tracker.reset_all()
        initial_count = tracker.get_used_count("image_hash")

        hash_matcher(img_a, img_a)

        final_count = tracker.get_used_count("image_hash")
        assert final_count == initial_count + 1


# ──────────────────────────────────────────────────────────────────────────────
# ocr_extract_text tests
# ──────────────────────────────────────────────────────────────────────────────

class TestOcrExtractText:
    def test_no_api_key_returns_empty(self, monkeypatch):
        """Without GEMINI_API_KEY, returns empty string."""
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        img = Image.new("RGB", (100, 100), color="white")
        result = ocr_extract_text(img, "Nike")
        assert result == ""

    def test_no_api_key_with_bytes(self, monkeypatch):
        """Without API key, bytes input also returns empty."""
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        result = ocr_extract_text(b"\x89PNG\r\n\x1a\n", "Nike")
        assert result == ""

    def test_returns_string(self, monkeypatch):
        """Return type is always str."""
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        img = Image.new("RGB", (50, 50), color="red")
        result = ocr_extract_text(img)
        assert isinstance(result, str)


# ──────────────────────────────────────────────────────────────────────────────
# MatchResult model tests
# ──────────────────────────────────────────────────────────────────────────────

class TestMatchResultModel:
    def test_keyword_type(self):
        m = MatchResult(matched=True, score=0.95, match_type="keyword")
        assert m.match_type == "keyword"

    def test_image_hash_type(self):
        m = MatchResult(matched=True, score=0.88, match_type="image_hash")
        assert m.match_type == "image_hash"

    def test_none_type(self):
        m = MatchResult(matched=False, score=0.0, match_type="none")
        assert m.match_type == "none"

    def test_invalid_type_rejected(self):
        """Unknown match_type values should be rejected by Pydantic."""
        with pytest.raises(Exception):
            MatchResult(matched=True, score=0.5, match_type="unknown")  # type: ignore
