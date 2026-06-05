import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from tracemark_api.services.scraper import scrape_page, ScrapeResult
from tracemark_api.services.ai import Evidence, MarketplaceEvidence, DomainEvidence

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

def build_search_urls(brand_name: str, platforms: list[str]) -> dict[str, str]:
    urls = {}
    encoded = brand_name.replace(" ", "+")
    # Tier 1 — custom scrapers
    if "amazon" in platforms:
        urls["amazon"] = f"https://www.amazon.com/s?k={encoded}"
    if "ebay" in platforms:
        urls["ebay"] = f"https://www.ebay.com/sch/i.html?_nkw={encoded}"
    if "alibaba" in platforms:
        urls["alibaba"] = f"https://www.alibaba.com/trade/search?SearchText={encoded}"
    # Tier 3 — Firecrawl only
    if "aliexpress" in platforms:
        urls["aliexpress"] = f"https://www.aliexpress.com/wholesale?SearchText={encoded}"
    return urls


class AmazonScraper:
    """Tier 1 — static HTML, no JS needed. Cost: $0."""

    def search(self, keyword: str, max_pages: int = 3) -> list[dict]:
        """
        Scrape Amazon search results pages.
        Args:
            keyword: Brand name to search
            max_pages: Number of result pages to crawl
        Returns:
            List of listing dicts: title, price, seller, url, rating, reviews, ship_from
        """
        listings = []
        encoded = keyword.replace(" ", "+")
        for page in range(1, max_pages + 1):
            url = f"https://www.amazon.com/s?k={encoded}&page={page}"
            try:
                resp = requests.get(url, headers=HEADERS, timeout=10)
                soup = BeautifulSoup(resp.text, "html.parser")
                for item in soup.select("[data-component-type='s-search-result']"):
                    listing = self.extract_listing_data(item)
                    if listing:
                        listings.append(listing)
            except Exception as e:
                print(f"[AmazonScraper] Page {page} failed: {e}")
                break
        return listings

    def extract_listing_data(self, element) -> dict | None:
        """
        Parse a single product card element from Amazon's HTML.
        Returns dict with: title, price, seller, url, rating, reviews, ship_from
        """
        try:
            title = element.select_one("h2 span")
            price = element.select_one(".a-price .a-offscreen")
            seller = element.select_one(".a-size-small .a-color-secondary")
            link = element.select_one("h2 a")
            rating = element.select_one(".a-icon-alt")
            reviews = element.select_one(".a-size-small .a-link-normal")
            return {
                "title": title.text.strip() if title else None,
                "price": price.text.strip() if price else None,
                "seller": seller.text.strip() if seller else None,
                "url": f"https://amazon.com{link['href']}" if link and 'href' in link.attrs else None,
                "rating": rating.text.split(" ")[0] if rating else None,
                "reviews": reviews.text.strip() if reviews else None,
                "ship_from": "N/A",
            }
        except Exception:
            return None


class EbayScraper:
    """Tier 1 — stub for Week 1. Implement in Week 2."""

    def search(self, keyword: str, max_pages: int = 3) -> list[dict]:
        return []  # TODO: implement


class AlibabaScraper:
    """Tier 1 — stub for Week 1. Implement in Week 2."""

    def search(self, keyword: str, max_pages: int = 3) -> list[dict]:
        return []  # TODO: implement


class WhoisAPI:
    """
    Tier 2 — WHOIS lookups for typosquatting detection.
    Uses python-whois (free). Cost: $0.
    """

    def check_similar_domains(self, brand_name: str) -> list[dict]:
        """
        Generates typosquatting variations of brand_name and checks WHOIS.
        Returns list of registered suspicious domains with registrant + creation date.
        """
        import whois
        variations = self._generate_variations(brand_name)
        results = []
        for domain in variations:
            try:
                w = whois.whois(domain)
                if w.domain_name:
                    # w.registrar is typically a string, w.creation_date can be a list or a datetime or None
                    registrar = w.registrar or "unknown"
                    if isinstance(registrar, list):
                        registrar = registrar[0]
                    created_date = w.creation_date
                    if isinstance(created_date, list):
                        created_date = created_date[0]
                    created_date_str = str(created_date) if created_date else "unknown"

                    results.append({
                        "domain": domain,
                        "registrant": registrar,
                        "created_date": created_date_str,
                        "status": "active",
                    })
            except Exception:
                pass
        return results

    def _generate_variations(self, brand_name: str) -> list[str]:
        """Generate common typosquatting patterns for a brand."""
        name = brand_name.lower().replace(" ", "")
        tlds = [".shop", ".store", ".net", ".org", ".co"]
        patterns = [
            f"{name}-official",
            f"{name}-store",
            f"official-{name}",
            f"buy{name}",
            f"{name}sale",
        ]
        return [f"{p}{tld}" for p in patterns for tld in tlds]


class GoogleAdsAPI:
    """
    Tier 2 — Google Ads Transparency API.
    Cost: $0. Stub for Week 1 — implement in Week 2.
    """

    def search(self, brand_keyword: str) -> list[dict]:
        return []  # TODO: implement with Google Ads Transparency Center API


class MetaAdsAPI:
    """
    Tier 2 — Meta Ad Library API (Facebook/Instagram).
    Cost: $0. Stub for Week 1 — implement in Week 2.
    """

    def search(self, brand_keyword: str) -> list[dict]:
        return []  # TODO: implement with Meta Ad Library API


# In-memory cache to avoid re-scraping same URL within 24h
_firecrawl_cache: dict[str, tuple[ScrapeResult | None, datetime]] = {}
_credit_log: list[dict] = []

class FirecrawlScraper:
    """
    Tier 3 — fallback for JS-heavy sites (AliExpress, Facebook Marketplace, TikTok).
    Budget: 200–400 credits/month. Use sparingly.
    """

    MONTHLY_CREDIT_BUDGET = 400

    def scrape_with_fallback(self, url: str) -> ScrapeResult | None:
        """
        Smart fallback logic:
        1. Check 24h in-memory cache — return cached result if fresh
        2. Check remaining credit estimate — warn if low
        3. Only then call Firecrawl
        4. Log credit usage per URL
        Never retry a failed URL on the same calendar day.
        """
        # 1. Check cache
        if url in _firecrawl_cache:
            cached_result, cached_at = _firecrawl_cache[url]
            if datetime.now() - cached_at < timedelta(hours=24):
                return cached_result

        # 2. Check credit budget
        credits_used_this_month = sum(entry["credits"] for entry in _credit_log)
        if credits_used_this_month >= self.MONTHLY_CREDIT_BUDGET:
            print(f"[FirecrawlScraper] Monthly budget exhausted. Skipping {url}")
            return None
        if credits_used_this_month > self.MONTHLY_CREDIT_BUDGET * 0.8:
            print(f"[FirecrawlScraper] WARNING: 80% of monthly budget used.")

        # 3. Call Firecrawl
        try:
            result = scrape_page(url)
            if result.success:
                _firecrawl_cache[url] = (result, datetime.now())
                _credit_log.append({
                    "url": url,
                    "timestamp": datetime.now().isoformat(),
                    "credits": 10,  # Estimate; update when Firecrawl returns actual usage
                })
                return result
            else:
                _firecrawl_cache[url] = (None, datetime.now())
                return None
        except Exception as e:
            print(f"[FirecrawlScraper] Failed for {url}: {e}")
            _firecrawl_cache[url] = (None, datetime.now())
            return None


class MarketplaceScraper:
    """
    Main aggregator. Routes each platform to the correct scraping tier.
    Tier 1 (custom) → Tier 2 (APIs) → Tier 3 (Firecrawl fallback).
    """

    def __init__(self):
        self.amazon = AmazonScraper()
        self.ebay = EbayScraper()
        self.alibaba = AlibabaScraper()
        self.google_ads = GoogleAdsAPI()
        self.meta_ads = MetaAdsAPI()
        self.whois = WhoisAPI()
        self.firecrawl = FirecrawlScraper()  # Fallback only

    def scrape_all_sources(self, brand_name: str, platforms: list[str]) -> dict:
        """
        Coordinates all tiers and returns a raw results dict.
        Only queries platforms that are in the requested platforms list.
        """
        results = {
            "marketplaces": {},
            "ads": {},
            "domains": [],
            "timestamp": datetime.now().isoformat(),
        }

        # --- Tier 1: Custom scrapers ---
        if "amazon" in platforms:
            results["marketplaces"]["amazon"] = self.amazon.search(brand_name)
        if "ebay" in platforms:
            results["marketplaces"]["ebay"] = self.ebay.search(brand_name)
        if "alibaba" in platforms:
            results["marketplaces"]["alibaba"] = self.alibaba.search(brand_name)

        # --- Tier 1 → Tier 3 fallback for AliExpress ---
        if "aliexpress" in platforms:
            aliexpress_url = f"https://www.aliexpress.com/wholesale?SearchText={brand_name.replace(' ', '+')}"
            aliexpress_result = self.firecrawl.scrape_with_fallback(aliexpress_url)
            results["marketplaces"]["aliexpress"] = aliexpress_result.markdown if aliexpress_result else ""

        # --- Tier 2: Official APIs ---
        if "google_ads" in platforms:
            results["ads"]["google"] = self.google_ads.search(brand_name)
        if "meta_ads" in platforms:
            results["ads"]["meta"] = self.meta_ads.search(brand_name)
        if "whois" in platforms:
            results["domains"] = self.whois.check_similar_domains(brand_name)

        return results


class ListingList(BaseModel):
    items: list[MarketplaceEvidence]


def extract_marketplace_evidence(
    brand_name: str,
    platform: str,
    raw_content: str,  # Markdown (Tier 3) or pre-serialized listing JSON (Tier 1)
) -> list[MarketplaceEvidence]:
    """
    Uses Gemini to analyze raw scraped content and extract suspicious listings.
    Returns an empty list if no API key is set or content is empty.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or not raw_content.strip():
        return []

    model = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        temperature=0.0,
        google_api_key=api_key,
    )

    prompt = f"""
You are a brand protection analyst. Below is scraped content from a {platform} search for brand "{brand_name}".

Identify every listing that appears to be counterfeit, unauthorized resale, or suspicious brand use.
For each, return: platform, seller_name, listing_url, price.

Content:
{raw_content[:6000]}

Return a JSON array. Fields: platform, seller_name, listing_url, price.
If nothing suspicious, return [].
"""
    structured_model = model.with_structured_output(ListingList)
    result = structured_model.invoke(prompt)
    return result.items


def gather_evidence(brand_name: str, platforms: list[str]) -> Evidence:
    """
    Main entrypoint. Runs the 3-tier scraping pipeline and returns
    a fully populated Evidence object.

    Tier 1 (custom) handles Amazon/eBay/Alibaba at $0 cost.
    Tier 2 (APIs) handles ads and domain monitoring at $0 cost.
    Tier 3 (Firecrawl) handles JS-heavy sites only, within credit budget.
    """
    # --- Mock mode: no API keys set ---
    if not os.environ.get("FIRECRAWL_API_KEY") and not os.environ.get("GEMINI_API_KEY"):
        return _mock_evidence(brand_name)

    scraper = MarketplaceScraper()
    raw = scraper.scrape_all_sources(brand_name, platforms)

    all_marketplace_evidence = []

    # Process Tier 1 + Tier 3 marketplace results through Gemini
    for platform, content in raw["marketplaces"].items():
        if isinstance(content, list):
            content_str = str(content)  # Tier 1 returns list of dicts
        else:
            content_str = content or ""  # Tier 3 returns markdown string
        listings = extract_marketplace_evidence(brand_name, platform, content_str)
        all_marketplace_evidence.extend(listings)

    # Convert WHOIS dicts to Pydantic DomainEvidence models
    domain_evidences = []
    for d in raw.get("domains", []):
        domain_evidences.append(
            DomainEvidence(
                domain_name=d["domain"],
                registrar=d.get("registrant") or "unknown",
                is_clone=True,
                similarity_score=90,
            )
        )

    # Process ads (Google / Meta API lists)
    ad_evidences = []
    # Currently stubs, but let's handle if they return data in the future
    for ad in (raw["ads"].get("google", []) + raw["ads"].get("meta", [])):
        # If they are dicts, map them to AdEvidence, else use them directly
        if isinstance(ad, dict):
            # map keys if needed
            ad_evidences.append(ad)
        else:
            ad_evidences.append(ad)

    return Evidence(
        marketplaces=all_marketplace_evidence,
        ads=ad_evidences,
        domains=domain_evidences,
        social=[],
        timestamp=datetime.now(),
    )


def _mock_evidence(brand_name: str) -> Evidence:
    """Returns deterministic mock data when no env vars are set."""
    return Evidence(
        marketplaces=[
            MarketplaceEvidence(
                platform="amazon",
                seller_name="MockSeller_XYZ",
                listing_url="https://amazon.com/dp/MOCK123",
                price="$19.99",
            )
        ],
        ads=[],
        domains=[
            DomainEvidence(
                domain_name=f"{brand_name.lower()}-official.shop",
                registrar="unknown",
                is_clone=True,
                similarity_score=90,
            )
        ],
        social=[],
        timestamp=datetime.now(),
    )
