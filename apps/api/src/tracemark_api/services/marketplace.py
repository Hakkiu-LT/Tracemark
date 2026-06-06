import json
import os
import re
import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from itertools import product as iterproduct
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from tracemark_api.services.scraper import scrape_page, ScrapeResult
from tracemark_api.services.ai import Evidence, MarketplaceEvidence, DomainEvidence, AdEvidence

# Common phrases used in brand-impersonation / ad-hijacking creatives
_HIJACKING_SIGNALS = (
    "official", "authentic", "sale", "discount", "free shipping",
    "limited time", "up to", "% off", "shop now", "buy now", "clearance",
)


def _normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.lower().strip())


def _is_official_advertiser(
    advertiser: str,
    brand_name: str,
    official_advertisers: list[str] | None = None,
) -> bool:
    """True when the advertiser is the brand itself or an explicitly whitelisted account."""
    norm_adv = _normalize_name(advertiser)
    if not norm_adv:
        return False
    for name in official_advertisers or []:
        norm_official = _normalize_name(name)
        if norm_official in norm_adv or norm_adv in norm_official:
            return True
    # Default: treat pages whose name is essentially the brand as official
    brand_norm = _normalize_name(brand_name)
    if norm_adv == brand_norm:
        return True
    if norm_adv.startswith(brand_norm + " ") or norm_adv.endswith(" " + brand_norm):
        return True
    return False


def _hijacking_score(ad_text: str, advertiser: str, brand_name: str) -> int:
    """Higher score = more likely ad hijacking / brand impersonation."""
    text = f"{ad_text} {advertiser}".lower()
    brand = brand_name.lower()
    score = 0
    if brand in text:
        score += 40
    if any(signal in text for signal in _HIJACKING_SIGNALS):
        score += 20
    if brand in advertiser.lower():
        score += 30  # page name impersonating the brand
    return min(score, 100)


def filter_hijacking_ads(
    ads: list[dict],
    brand_name: str,
    official_advertisers: list[str] | None = None,
    min_score: int = 40,
) -> list[dict]:
    """
    Keep ads that likely hijack brand traffic (non-official advertisers using the brand).
    """
    hijacks: list[dict] = []
    for ad in ads:
        advertiser = ad.get("advertiser", "")
        if _is_official_advertiser(advertiser, brand_name, official_advertisers):
            continue
        ad_text = ad.get("ad_text", "")
        score = _hijacking_score(ad_text, advertiser, brand_name)
        if score >= min_score:
            hijacks.append({**ad, "hijacking_score": score})
    hijacks.sort(key=lambda a: a.get("hijacking_score", 0), reverse=True)
    return hijacks

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
    # Tier 1 ΓÇö custom scrapers
    if "amazon" in platforms:
        urls["amazon"] = f"https://www.amazon.com/s?k={encoded}"
    if "ebay" in platforms:
        urls["ebay"] = f"https://www.ebay.com/sch/i.html?_nkw={encoded}"
    if "alibaba" in platforms:
        urls["alibaba"] = f"https://www.alibaba.com/trade/search?SearchText={encoded}"
    # Tier 3 ΓÇö Firecrawl only
    if "aliexpress" in platforms:
        urls["aliexpress"] = f"https://www.aliexpress.com/wholesale?SearchText={encoded}"
    return urls


class AmazonScraper:
    """Tier 1 ΓÇö static HTML, no JS needed. Cost: $0."""

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
    """Tier 1 ΓÇö stub for Week 1. Implement in Week 2."""

    def search(self, keyword: str, max_pages: int = 3) -> list[dict]:
        return []  # TODO: implement


class AlibabaScraper:
    """Tier 1 ΓÇö stub for Week 1. Implement in Week 2."""

    def search(self, keyword: str, max_pages: int = 3) -> list[dict]:
        return []  # TODO: implement


class WhoisAPI:
    """
    Tier 2 ΓÇö Free WHOIS lookups for typosquatting detection.
    Generates brand name variations and checks which are registered.
    """

    TLDS = [".shop", ".store", ".net", ".org", ".co", ".info", ".biz", ".online"]

    def check_similar_domains(self, brand_name: str) -> list[dict]:
        """
        Generates typosquatting variations of brand_name and performs WHOIS lookup.
        Returns list of registered suspicious domains.
        Skips unregistered domains silently.
        """
        import whois
        variations = self._generate_variations(brand_name)
        results = []
        for domain in variations:
            try:
                w = whois.whois(domain)
                # Only report if the domain is actually registered
                if w and w.domain_name:
                    registrar = w.registrar or "unknown"
                    if isinstance(registrar, list):
                        registrar = registrar[0]
                    created_date = w.creation_date
                    if isinstance(created_date, list):
                        created_date = created_date[0]
                    expiry_date = w.expiration_date
                    if isinstance(expiry_date, list):
                        expiry_date = expiry_date[0]
                    name_servers = w.name_servers or []
                    if isinstance(name_servers, str):
                        name_servers = [name_servers]
                    results.append({
                        "domain": domain,
                        "registrant": registrar,
                        "created_date": str(created_date) if created_date else "unknown",
                        "expiry_date": str(expiry_date) if expiry_date else "unknown",
                        "status": "active",
                        "name_servers": list(name_servers),
                    })
                # Rate limit: avoid WHOIS server throttling
                time.sleep(0.5)
            except Exception:
                # Domain not found or WHOIS lookup failed ΓÇö not suspicious
                pass
        return results

    def _generate_variations(self, brand_name: str) -> list[str]:
        """
        Generates common typosquatting and brand-impersonation domain patterns.
        Covers: official/store/buy prefixes, misspellings, hyphenated versions.
        """
        name = brand_name.lower().replace(" ", "")
        prefixes = ["", "official-", "buy-", "get-", "real-", "authentic-", "shop-"]
        suffixes = ["", "-official", "-store", "-sale", "-outlet", "-shop", "-online"]
        # Build prefix+name+suffix combos (limit to avoid too many WHOIS calls)
        combos: set[str] = set()
        for pre, suf in iterproduct(prefixes[:4], suffixes[:4]):
            combos.add(f"{pre}{name}{suf}")
        # Add direct variations
        combos.update([name, f"{name}store", f"{name}shop", f"fake{name}", f"{name}replica"])
        return [f"{combo}{tld}" for combo in list(combos)[:20] for tld in self.TLDS[:4]]


class GoogleAdsAPI:
    """
    Tier 2 ΓÇö Google Ads Transparency Center API.
    Finds ads running for a brand keyword across Google Search + Display.
    Cost: $0 (official API, no auth required for basic queries).
    Falls back to BeautifulSoup scraping if the JSON API is unavailable.
    """

    BASE_URL = "https://adstransparency.google.com/api/public/ads"
    FALLBACK_URL = "https://adstransparency.google.com"

    def search(
        self,
        brand_keyword: str,
        region: str = "US",
        official_advertisers: list[str] | None = None,
    ) -> list[dict]:
        """
        Searches the Google Ads Transparency database for ads mentioning brand_keyword.
        Args:
            brand_keyword: The brand name to monitor
            region: ISO country code (default US)
        Returns:
            List of ad records: advertiser, ad_text, destination_url, impressions, detected_date
        """
        try:
            params = {
                "query": brand_keyword,
                "region": region,
                "format": "json",
            }
            resp = requests.get(self.BASE_URL, params=params, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    ads = self._parse_ads(data, brand_keyword, official_advertisers)
                    if ads or "ads" in data:
                        return ads
                except Exception:
                    pass
            # Fallback: scrape the Transparency Center page with BeautifulSoup
            print(f"[GoogleAdsAPI] JSON API unavailable (status {resp.status_code}), falling back to HTML scrape.")
            return self._scrape_fallback(brand_keyword, official_advertisers)
        except Exception as e:
            print(f"[GoogleAdsAPI] Error: {e}")
            return []

    def _parse_ads(
        self,
        data: dict,
        brand_keyword: str,
        official_advertisers: list[str] | None = None,
    ) -> list[dict]:
        """Parse raw API response into standardized ad records."""
        raw: list[dict] = []
        for item in data.get("ads", []):
            raw.append({
                "source": "google_ads",
                "advertiser": item.get("advertiser_name", ""),
                "ad_text": item.get("ad_text", ""),
                "destination_url": item.get("destination_url", ""),
                "impressions": item.get("impressions_range", "unknown"),
                "detected_date": item.get("first_shown_date", ""),
            })
        return filter_hijacking_ads(raw, brand_keyword, official_advertisers)

    def _scrape_fallback(
        self,
        brand_keyword: str,
        official_advertisers: list[str] | None = None,
    ) -> list[dict]:
        """Fallback when the JSON API is unavailable (Google has no public API)."""
        ads = self._scrape_html(brand_keyword, official_advertisers)
        if ads:
            return ads
        if os.environ.get("FIRECRAWL_API_KEY") and os.environ.get("GEMINI_API_KEY"):
            print("[GoogleAdsAPI] HTML scrape empty ΓÇö trying Firecrawl + Gemini extraction.")
            return self._firecrawl_extract(brand_keyword, official_advertisers)
        return []

    def _scrape_html(
        self,
        brand_keyword: str,
        official_advertisers: list[str] | None = None,
    ) -> list[dict]:
        """BS4 scrape of adstransparency.google.com search page."""
        try:
            url = f"{self.FALLBACK_URL}?query={brand_keyword.replace(' ', '+')}&region=US"
            resp = requests.get(url, headers=HEADERS, timeout=15)
            soup = BeautifulSoup(resp.text, "html.parser")
            raw: list[dict] = []
            for card in soup.select("[data-advertiser-name]"):
                advertiser = card.get("data-advertiser-name", "")
                ad_text_el = card.select_one(".ad-text, .headline, h3")
                dest_el = card.select_one("a[href]")
                raw.append({
                    "source": "google_ads",
                    "advertiser": advertiser,
                    "ad_text": ad_text_el.get_text(strip=True) if ad_text_el else "",
                    "destination_url": dest_el["href"] if dest_el else "",
                    "impressions": "unknown",
                    "detected_date": "",
                })
            return filter_hijacking_ads(raw, brand_keyword, official_advertisers)
        except Exception as e:
            print(f"[GoogleAdsAPI] HTML scrape failed: {e}")
            return []

    def _firecrawl_extract(
        self,
        brand_keyword: str,
        official_advertisers: list[str] | None = None,
    ) -> list[dict]:
        url = f"{self.FALLBACK_URL}?query={brand_keyword.replace(' ', '+')}&region=US"
        result = scrape_page(url)
        if not result.success or not result.markdown:
            return []
        return extract_ads_from_content(brand_keyword, "google_ads", result.markdown, official_advertisers)


class MetaAdsAPI:
    """
    Tier 2 ΓÇö Meta Ad Library API (Facebook/Instagram).
    Finds ads running on Facebook and Instagram using brand keywords.
    Requires META_ADS_ACCESS_TOKEN env var (free Meta developer account).
    Cost: $0.
    """

    BASE_URL = "https://graph.facebook.com/v19.0/ads_archive"

    def search(
        self,
        brand_keyword: str,
        country: str = "US",
        official_advertisers: list[str] | None = None,
    ) -> list[dict]:
        """
        Queries the Meta Ad Library for ads mentioning brand_keyword.
        Returns ads from non-official advertisers (potential hijackers).
        Skips gracefully when META_ADS_ACCESS_TOKEN is not set.
        """
        access_token = os.environ.get("META_ADS_ACCESS_TOKEN")
        if not access_token:
            print("[MetaAdsAPI] META_ADS_ACCESS_TOKEN not set ΓÇö skipping")
            return []
        try:
            params = {
                "access_token": access_token,
                "search_terms": brand_keyword,
                "ad_reached_countries": json.dumps([country]),
                "ad_type": "ALL",
                "fields": "id,ad_creative_body,page_name,ad_snapshot_url,impressions,spend",
                "limit": 50,
            }
            resp = requests.get(self.BASE_URL, params=params, timeout=15)
            if resp.status_code != 200:
                err = resp.text[:300]
                print(f"[MetaAdsAPI] Error {resp.status_code}: {err}")
                if "2332002" in err:
                    print(
                        "[MetaAdsAPI] Complete ID verification at "
                        "https://www.facebook.com/ads/library/api to enable API access."
                    )
                return []
            data = resp.json()
            return self._parse_ads(data.get("data", []), brand_keyword, official_advertisers)
        except Exception as e:
            print(f"[MetaAdsAPI] Exception: {e}")
            return []

    def _parse_ads(
        self,
        items: list,
        brand_keyword: str,
        official_advertisers: list[str] | None = None,
    ) -> list[dict]:
        raw: list[dict] = []
        for item in items:
            raw.append({
                "source": "meta_ads",
                "advertiser": item.get("page_name", ""),
                "ad_text": item.get("ad_creative_body", ""),
                "destination_url": item.get("ad_snapshot_url", ""),
                "impressions": item.get("impressions", {}).get("lower_bound", "unknown"),
                "detected_date": "",
            })
        return filter_hijacking_ads(raw, brand_keyword, official_advertisers)


# In-memory cache to avoid re-scraping same URL within 24h
_firecrawl_cache: dict[str, tuple[ScrapeResult | None, datetime]] = {}
_credit_log: list[dict] = []

class FirecrawlScraper:
    """
    Tier 3 ΓÇö fallback for JS-heavy sites (AliExpress, Facebook Marketplace, TikTok).
    Budget: 200ΓÇô400 credits/month. Use sparingly.
    """

    MONTHLY_CREDIT_BUDGET = 400

    def scrape_with_fallback(self, url: str) -> ScrapeResult | None:
        """
        Smart fallback logic:
        1. Check 24h in-memory cache ΓÇö return cached result if fresh
        2. Check remaining credit estimate ΓÇö warn if low
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
    Tier 1 (custom) ΓåÆ Tier 2 (APIs) ΓåÆ Tier 3 (Firecrawl fallback).
    """

    def __init__(self):
        self.amazon = AmazonScraper()
        self.ebay = EbayScraper()
        self.alibaba = AlibabaScraper()
        self.google_ads = GoogleAdsAPI()
        self.meta_ads = MetaAdsAPI()
        self.whois = WhoisAPI()
        self.firecrawl = FirecrawlScraper()  # Fallback only

    def scrape_all_sources(
        self,
        brand_name: str,
        platforms: list[str],
        official_advertisers: list[str] | None = None,
    ) -> dict:
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

        # --- Tier 1 ΓåÆ Tier 3 fallback for AliExpress ---
        if "aliexpress" in platforms:
            aliexpress_url = f"https://www.aliexpress.com/wholesale?SearchText={brand_name.replace(' ', '+')}"
            aliexpress_result = self.firecrawl.scrape_with_fallback(aliexpress_url)
            results["marketplaces"]["aliexpress"] = aliexpress_result.markdown if aliexpress_result else ""

        # --- Tier 2: Official APIs ---
        if "google_ads" in platforms:
            results["ads"]["google"] = self.google_ads.search(brand_name, official_advertisers=official_advertisers)
        if "meta_ads" in platforms:
            results["ads"]["meta"] = self.meta_ads.search(brand_name, official_advertisers=official_advertisers)
        # Accept either "whois" or "domains" as the platform key
        if "whois" in platforms or "domains" in platforms:
            results["domains"] = self.whois.check_similar_domains(brand_name)

        return results


class ListingList(BaseModel):
    items: list[MarketplaceEvidence]


class RawAdRecord(BaseModel):
    advertiser: str = ""
    ad_text: str = ""
    destination_url: str = ""


class RawAdList(BaseModel):
    items: list[RawAdRecord] = Field(default_factory=list)


def extract_ads_from_content(
    brand_name: str,
    source: str,
    raw_content: str,
    official_advertisers: list[str] | None = None,
) -> list[dict]:
    """Use Gemini to extract ad records from scraped Google/Meta transparency pages."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or not raw_content.strip():
        return []

    model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.0,
        google_api_key=api_key,
    )
    prompt = f"""
You are a brand protection analyst monitoring ad hijacking for brand "{brand_name}".

From the scraped ad transparency page content below, extract ads that appear to use the brand
name to steal traffic (counterfeiters, impersonators, unauthorized resellers running paid ads).

For each suspicious ad return: advertiser, ad_text, destination_url.
Skip ads clearly run by the official brand owner.

Content:
{raw_content[:8000]}

Return a JSON array. If nothing suspicious, return [].
"""
    structured_model = model.with_structured_output(RawAdList)
    result = structured_model.invoke(prompt)
    raw = [
        {"source": source, "advertiser": a.advertiser, "ad_text": a.ad_text, "destination_url": a.destination_url}
        for a in result.items
    ]
    return filter_hijacking_ads(raw, brand_name, official_advertisers)


def _ad_dict_to_evidence(ad: dict) -> AdEvidence:
    source = ad.get("source", "unknown")
    platform_label = "Google Ads" if source == "google_ads" else "Meta Ads" if source == "meta_ads" else source
    advertiser = ad.get("advertiser", "")
    ad_text = ad.get("ad_text") or ""
    score = ad.get("hijacking_score")
    copy = f"[{advertiser}] {ad_text}".strip() if advertiser else ad_text
    if score is not None:
        copy = f"(hijack score {score}) {copy}"
    return AdEvidence(
        platform=platform_label,
        ad_copy=copy,
        destination_url=ad.get("destination_url", ""),
    )


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
        model="gemini-2.5-flash",
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


def gather_evidence(
    brand_name: str,
    platforms: list[str],
    official_advertisers: list[str] | None = None,
) -> Evidence:
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
    raw = scraper.scrape_all_sources(brand_name, platforms, official_advertisers)

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

    # Map raw ad dicts ΓåÆ AdEvidence Pydantic models
    ad_evidences: list[AdEvidence] = []
    for ad in (raw["ads"].get("google", []) + raw["ads"].get("meta", [])):
        if isinstance(ad, AdEvidence):
            ad_evidences.append(ad)
        elif isinstance(ad, dict):
            ad_evidences.append(_ad_dict_to_evidence(ad))

    return Evidence(
        marketplaces=all_marketplace_evidence,
        ads=ad_evidences,
        domains=domain_evidences,
        social=[],
        timestamp=datetime.now(),
    )


def check_ads_hijacking(
    brand_name: str,
    platforms: list[str] | None = None,
    official_advertisers: list[str] | None = None,
) -> dict:
    """
    Scan Google + Meta ad libraries for hijacking ads targeting brand_name.
    Returns structured results with per-platform counts and AdEvidence records.
    """
    platforms = platforms or ["google_ads", "meta_ads"]
    scraper = MarketplaceScraper()
    raw = scraper.scrape_all_sources(brand_name, platforms, official_advertisers)
    google_ads = raw["ads"].get("google", [])
    meta_ads = raw["ads"].get("meta", [])
    all_ads = google_ads + meta_ads
    return {
        "brand_name": brand_name,
        "platforms_scanned": platforms,
        "official_advertisers": official_advertisers or [],
        "counts": {
            "google_hijacking_ads": len(google_ads),
            "meta_hijacking_ads": len(meta_ads),
            "total_hijacking_ads": len(all_ads),
        },
        "hijacking_ads": [_ad_dict_to_evidence(ad).model_dump() for ad in all_ads],
        "raw_ads": all_ads,
        "timestamp": raw["timestamp"],
    }


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
        ads=[
            AdEvidence(
                platform="Google Ads",
                ad_copy=f"Buy {brand_name} products ΓÇö Official Store",
                destination_url=f"https://mock-googleads-{brand_name.lower()}.com",
            ),
            AdEvidence(
                platform="Meta Ads",
                ad_copy=f"{brand_name} Sale ΓÇö Up to 90% off!",
                destination_url=f"https://mock-metaads-{brand_name.lower()}.net",
            ),
        ],
        domains=[
            DomainEvidence(
                domain_name=f"{brand_name.lower()}-official.shop",
                registrar="unknown",
                is_clone=True,
                similarity_score=90,
            ),
            DomainEvidence(
                domain_name=f"buy{brand_name.lower()}.store",
                registrar="mock-registrar",
                is_clone=True,
                similarity_score=85,
            ),
        ],
        social=[],
        timestamp=datetime.now(),
    )
