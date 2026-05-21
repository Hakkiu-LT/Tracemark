from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class ScrapeResult:
    url: str
    title: str | None
    html: str


def scrape_page(url: str) -> ScrapeResult:
    raise NotImplementedError("Wire up scraping here when the backend integration starts.")
