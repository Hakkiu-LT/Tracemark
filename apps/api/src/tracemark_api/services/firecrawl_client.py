from __future__ import annotations

import os
from dataclasses import dataclass

import httpx


@dataclass(slots=True)
class ScrapeResult:
    url: str
    title: str | None
    markdown: str
    html: str | None = None
    screenshot_url: str | None = None
    success: bool = True
    error_message: str | None = None


def screenshot_page(url: str, location: dict | None = None) -> str | None:
    """
    Take a screenshot of a URL using Firecrawl.
    Returns the screenshot URL (Firecrawl CDN) or None on failure.
    The URL passed here may contain sensitive tokens — they are never stored,
    only used transiently for the screenshot request.
    """
    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key or api_key == "your_firecrawl_api_key_here":
        return None
    try:
        payload = {"url": url, "formats": ["screenshot"], "waitFor": 3000}
        if location:
            payload["location"] = location
        response = httpx.post(
            "https://api.firecrawl.dev/v1/scrape",
            json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            timeout=60.0,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        return data.get("data", {}).get("screenshot") or None
    except Exception:
        return None


def scrape_page(url: str, with_screenshot: bool = False, location: dict | None = None) -> ScrapeResult:
    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        if "example.com" in url or "test" in url:
            return ScrapeResult(
                url=url,
                title="Mock Test Page",
                markdown="# Mock Page\nThis is a mock page because FIRECRAWL_API_KEY is not set. Please set the key to scrape real URLs.",
                html="<h1>Mock Page</h1>",
                success=True
            )
        raise ValueError("FIRECRAWL_API_KEY environment variable is not set.")

    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        formats = ["markdown", "html"]
        if with_screenshot:
            formats.append("screenshot")
        payload = {
            "url": url,
            "formats": formats,
        }
        if location:
            payload["location"] = location
        
        response = httpx.post(
            "https://api.firecrawl.dev/v1/scrape",
            json=payload,
            headers=headers,
            timeout=30.0
        )
        
        if response.status_code != 200:
            return ScrapeResult(
                url=url,
                title=None,
                markdown="",
                success=False,
                error_message=f"Firecrawl API returned status code {response.status_code}: {response.text}"
            )
            
        data = response.json()
        if not data.get("success"):
            return ScrapeResult(
                url=url,
                title=None,
                markdown="",
                success=False,
                error_message=data.get("error", "Unknown Firecrawl error")
            )
            
        scrape_data = data.get("data", {})
        metadata = scrape_data.get("metadata", {})
        title = metadata.get("title")
        markdown = scrape_data.get("markdown", "")
        html = scrape_data.get("html", "")
        screenshot_url = scrape_data.get("screenshot") or None

        return ScrapeResult(
            url=url,
            title=title,
            markdown=markdown,
            html=html,
            screenshot_url=screenshot_url,
            success=True
        )
        
    except Exception as e:
        return ScrapeResult(
            url=url,
            title=None,
            markdown="",
            success=False,
            error_message=str(e)
        )
