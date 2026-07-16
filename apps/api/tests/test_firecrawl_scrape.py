"""
Live Firecrawl integration test that scrapes https://derilashop.com and writes
the markdown + HTML to apps/api/tests/fixtures/ so the output can be inspected
after the test run.

Run with:
    cd apps/api
    .venv\\Scripts\\pytest.exe tests\\test_firecrawl_scrape.py -v -s
"""
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from dotenv import load_dotenv, find_dotenv

from tracemark_api.services.firecrawl_client import scrape_page, screenshot_page


load_dotenv(find_dotenv())


TARGET_URL = "https://www.adidas.com/us"
ARTIFACTS_DIR = Path(__file__).parent / "artifacts"
MARKDOWN_PATH = ARTIFACTS_DIR / "firecrawl_adidas_com.md"
HTML_PATH = ARTIFACTS_DIR / "firecrawl_adidas_com.html"
PREVIEW_CHARS = 600

RATE_LIMIT_SIGNALS = ("rate_limited", "rate limited", "rate-limit")


def _looks_like_rate_limit(markdown: str | None) -> bool:
    if not markdown:
        return False
    md_lower = markdown.lower()
    return any(sig in md_lower for sig in RATE_LIMIT_SIGNALS)


requires_firecrawl_key = pytest.mark.skipif(
    not os.environ.get("FIRECRAWL_API_KEY"),
    reason="FIRECRAWL_API_KEY not set — skipping live Firecrawl integration test",
)


def _print_preview(result, total: int) -> None:
    preview = (result.markdown or "")[:PREVIEW_CHARS]
    suffix = (
        f"\n... [{total - PREVIEW_CHARS} more chars in file]"
        if total > PREVIEW_CHARS
        else ""
    )
    print(
        f"\n[Firecrawl] URL:      {result.url}\n"
        f"[Firecrawl] Title:    {result.title}\n"
        f"[Firecrawl] Markdown: {MARKDOWN_PATH} ({total} chars)\n"
        f"[Firecrawl] HTML:     {HTML_PATH} ({len(result.html or '')} chars)\n"
        f"[Firecrawl] --- preview ---\n{preview}{suffix}\n"
    )


class TestScrapePageDownload:
    @requires_firecrawl_key
    def test_scrape_derilashop_saves_markdown_and_html_to_disk(self):
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

        result = scrape_page(TARGET_URL)

        MARKDOWN_PATH.write_text(result.markdown or "", encoding="utf-8")
        HTML_PATH.write_text(result.html or "", encoding="utf-8")

        _print_preview(result, len(result.markdown or ""))

        if _looks_like_rate_limit(result.markdown):
            pytest.fail(
                "Firecrawl returned a rate-limit placeholder "
                f"({len(result.markdown or '')} chars) — the scrape did NOT "
                "actually fetch the page despite success=True. "
                "Check your Firecrawl quota at https://firecrawl.dev and retry "
                "later. The placeholder content was saved to "
                f"{MARKDOWN_PATH} for inspection."
            )

        assert result.success is True, (
            f"Firecrawl scrape failed: {result.error_message}"
        )
        assert MARKDOWN_PATH.read_text(encoding="utf-8") == (result.markdown or "")
        assert HTML_PATH.read_text(encoding="utf-8") == (result.html or "")

    @requires_firecrawl_key
    def test_scrape_derilashop_result_has_expected_shape(self):
        result = scrape_page(TARGET_URL)

        if _looks_like_rate_limit(result.markdown):
            pytest.skip(
                "Firecrawl returned a rate-limit placeholder — skipping shape check"
            )

        assert result.success is True, (
            f"Firecrawl scrape failed: {result.error_message}"
        )
        assert result.url == TARGET_URL
        assert result.markdown is not None
        assert len(result.markdown) > 100, (
            f"Markdown is suspiciously short: {len(result.markdown)} chars"
        )
        assert result.title is not None
        assert "#" in result.markdown, (
            "Markdown contains no heading marker — looks like unconverted HTML"
        )


class TestScrapePageMocked:
    def test_scrape_page_raises_without_api_key(self, monkeypatch):
        monkeypatch.delenv("FIRECRAWL_API_KEY", raising=False)
        with pytest.raises(ValueError, match="FIRECRAWL_API_KEY"):
            scrape_page(TARGET_URL)

    def test_scrape_page_handles_api_error(self, monkeypatch):
        monkeypatch.setenv("FIRECRAWL_API_KEY", "test_key")

        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"

        with patch(
            "tracemark_api.services.firecrawl_client.httpx.post",
            return_value=mock_resp,
        ):
            result = scrape_page(TARGET_URL)

        assert result.success is False
        assert result.error_message is not None
        assert "500" in result.error_message


class TestScreenshotPage:
    @requires_firecrawl_key
    def test_screenshot_derilashop_returns_url(self):
        url = screenshot_page(TARGET_URL)
        if url is None:
            pytest.skip("Firecrawl screenshot returned None (likely quota/billing)")
        assert isinstance(url, str)
        assert url.startswith("http")
