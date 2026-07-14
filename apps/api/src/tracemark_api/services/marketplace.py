import asyncio
import json
import os
import re
import time
import requests
import urllib.parse
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from tracemark_api.services.firecrawl_client import scrape_page, ScrapeResult
from tracemark_api.services.domain_whitelist import whitelist_service
from dotenv import find_dotenv
from tracemark_api.services.ai import Evidence, MarketplaceEvidence, DomainEvidence, AdEvidence, SocialEvidence
from tracemark_api.services.geo import (
    AMAZON_DOMAINS,
    EBAY_DOMAINS,
    EBAY_GLOBAL_IDS,
    firecrawl_location,
    serpapi_geo_params,
)

# Import usage tracker components
from tracemark_api.services.api_usage_tracker import tracker, call_with_tracking, ApiLimitError

# Import unified scraper
from tracemark_api.services.unified_scraper import UnifiedScraper, UnifiedScrapeResult, SCRAPE_STATIC, SCRAPE_JS

# In-memory screenshot cache: url -> permanent_supabase_url
# Prevents re-screenshotting the same URL within the same server process.
_screenshot_cache: dict[str, str | None] = {}

# Common phrases used in brand-impersonation / ad-hijacking creatives
_HIJACKING_SIGNALS = (
    "official", "authentic", "sale", "discount", "free shipping",
    "limited time", "up to", "% off", "shop now", "buy now", "clearance",
)


class DomainEvaluation(BaseModel):
    domain_name: str = Field(description="The domain name being evaluated.")
    is_clone: bool = Field(description="True if this domain is an unauthorized clone, brand copycat, typo-squat, or brand-targeting storefront.")
    similarity_score: int = Field(description="A similarity score from 0 to 100 representing how closely the domain matches the brand name or impersonates the brand.")
    reasoning: str = Field(description="A brief explanation of why this domain was flagged or dismissed.")


class DomainEvaluationList(BaseModel):
    items: list[DomainEvaluation]


def _strip_token(url: str | None) -> str | None:
    """Remove access_token query param from Meta snapshot URLs before storing."""
    if not url:
        return None
    parsed = urllib.parse.urlparse(url)
    params = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    params.pop("access_token", None)
    clean_query = urllib.parse.urlencode(params, doseq=True)
    return urllib.parse.urlunparse(parsed._replace(query=clean_query))


def _cached_screenshot(url: str, prefix: str) -> str | None:
    """
    Return a permanent screenshot URL for the given URL, using cache to avoid
    re-screenshotting the same URL twice.

    Order: in-memory cache → Supabase DB → Firecrawl (new screenshot).
    """
    if url in _screenshot_cache:
        return _screenshot_cache[url]

    # Check DB for an existing screenshot of this URL
    try:
        from tracemark_api.services.database import get_supabase
        sb = get_supabase()
        row = (
            sb.table("infringements")
            .select("screenshot_url")
            .eq("source_url", url)
            .not_.is_("screenshot_url", "null")
            .limit(1)
            .execute()
        )
        if row.data:
            existing = row.data[0]["screenshot_url"]
            _screenshot_cache[url] = existing
            return existing
    except Exception:
        pass

    # No cache hit — take a new screenshot
    from tracemark_api.services.unified_scraper import DomainRegistry, SCRAPE_JS
    site_type = DomainRegistry.classify(url)

    if site_type == SCRAPE_JS:
        # Firecrawl is enough to use their normal screenshot for JS-heavy pages
        try:
            from tracemark_api.services.firecrawl_client import screenshot_page
            from tracemark_api.services.storage import upload_screenshot
            temp_url = screenshot_page(url)
            if temp_url:
                permanent = upload_screenshot(temp_url, prefix=prefix)
                if permanent:
                    _screenshot_cache[url] = permanent
                    return permanent
        except Exception as e:
            print(f"[Screenshot] Firecrawl screenshot failed for JS-heavy {url}: {e}")
    else:
        # Use local Playwright for static/normal domains
        try:
            from tracemark_api.services.playwright_client import take_local_screenshot
            from tracemark_api.services.storage import upload_screenshot_bytes
            
            screenshot_bytes = take_local_screenshot(url)
            if screenshot_bytes:
                permanent = upload_screenshot_bytes(screenshot_bytes, prefix=prefix)
                if permanent:
                    _screenshot_cache[url] = permanent
                    return permanent
        except Exception as e:
            print(f"[Screenshot] Local Playwright screenshot failed: {e}")

        # Fallback to Firecrawl
        try:
            from tracemark_api.services.firecrawl_client import screenshot_page
            from tracemark_api.services.storage import upload_screenshot
            temp_url = screenshot_page(url)
            if temp_url:
                permanent = upload_screenshot(temp_url, prefix=prefix)
                if permanent:
                    _screenshot_cache[url] = permanent
                    return permanent
        except Exception as e:
            print(f"[Screenshot] Firecrawl fallback failed: {e}")

    _screenshot_cache[url] = None
    return None


def _screenshot_listing(listing_url: str | None) -> str | None:
    """
    Screenshot a marketplace listing URL via Firecrawl and upload to Supabase Storage.
    Returns a permanent public URL or None on failure (bot detection, timeout, etc.).
    """
    if not listing_url:
        return None
    return _cached_screenshot(listing_url, prefix="marketplace")


def _meta_screenshot(snapshot_url: str | None) -> str | None:
    """
    Screenshot a Meta ad snapshot URL via Firecrawl, then upload to Supabase Storage.
    The token-bearing URL is used transiently — only the permanent Supabase URL is stored.
    Falls back to the token-stripped URL if Firecrawl or Storage is unavailable.
    """
    if not snapshot_url:
        return None
    # Use stripped URL as cache key so token rotation doesn't cause re-screenshots
    cache_key = _strip_token(snapshot_url) or snapshot_url
    if cache_key in _screenshot_cache:
        return _screenshot_cache[cache_key]

    from tracemark_api.services.firecrawl_client import screenshot_page
    from tracemark_api.services.storage import upload_screenshot
    temp_url = screenshot_page(snapshot_url)
    if temp_url:
        permanent_url = upload_screenshot(temp_url, prefix="meta")
        if permanent_url:
            _screenshot_cache[cache_key] = permanent_url
            return permanent_url

    fallback = _strip_token(snapshot_url)
    _screenshot_cache[cache_key] = fallback
    return fallback


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
    encoded_url = urllib.parse.quote_plus(brand_name)
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
    if "etsy" in platforms:
        urls["etsy"] = f"https://www.etsy.com/search?q={encoded_url}"
    if "shopify" in platforms:
        urls["shopify"] = f"https://www.google.com/search?q=site:*.myshopify.com+{encoded}"
    if "facebook_marketplace" in platforms:
        urls["facebook_marketplace"] = f"https://www.facebook.com/marketplace/search/?query={encoded_url}"
    if "tiktok" in platforms:
        urls["tiktok"] = f"https://www.tiktok.com/search?q={encoded_url}"
    if "instagram" in platforms:
        urls["instagram"] = f"https://www.instagram.com/explore/tags/{brand_name.lower().replace(' ', '')}/"
    if "google_shopping" in platforms:
        urls["google_shopping"] = f"https://www.google.com/search?tbm=shop&q={encoded}"
    return urls


class AmazonScraper:
    """
    Amazon-specific scraper using the UnifiedScraper for HTTP requests.
    Amazon serves full HTML without JS — routes to static tier automatically.
    Cost: $0 (runs on local resources, tracked under 'html_scraper').
    """

    def __init__(self):
        self._scraper = UnifiedScraper()
    def search(
        self, keyword: str, max_pages: int = 3, caller_id: str = "system", country: str = "US"
    ) -> list[dict]:
        """
        Scrape Amazon search results pages.
        """
        listings = []
        encoded = keyword.replace(" ", "+")
        domain = AMAZON_DOMAINS.get(country.upper(), "www.amazon.com")
        for page in range(1, max_pages + 1):
            url = f"https://{domain}/s?k={encoded}&page={page}"
            try:
                result = self._scraper.scrape(url, caller_id=caller_id)
                if not result.success or not result.html:
                    print(f"[AmazonScraper] Page {page} returned no HTML content.")
                    break
                soup = BeautifulSoup(result.html, "html.parser")
                for item in soup.select("[data-component-type='s-search-result']"):
                    listing = self.extract_listing_data(item, country=country)
                    if listing:
                        listings.append(listing)
            except ApiLimitError:
                raise
            except Exception as e:
                print(f"[AmazonScraper] Page {page} failed: {e}")
                break
        return listings

    def extract_listing_data(self, element, country: str = "US") -> dict | None:
        """
        Parse a single product card element from Amazon's HTML.
        """
        try:
            title = element.select_one("h2 span")
            price = element.select_one(".a-price .a-offscreen")
            seller = element.select_one(".a-size-small .a-color-secondary")
            link = element.select_one("h2 a")
            rating = element.select_one(".a-icon-alt")
            reviews = element.select_one(".a-size-small .a-link-normal")
            domain = AMAZON_DOMAINS.get(country.upper(), "www.amazon.com")
            url_domain = domain.removeprefix("www.")
            return {
                "title": title.text.strip() if title else None,
                "price": price.text.strip() if price else None,
                "seller": seller.text.strip() if seller else None,
                "url": f"https://{url_domain}{link['href']}" if link and 'href' in link.attrs else None,
                "rating": rating.text.split(" ")[0] if rating else None,
                "reviews": reviews.text.strip() if reviews else None,
                "ship_from": "N/A",
            }
        except Exception:
            return None


class EbayScraper:
    """
    eBay scraper using UnifiedScraper (static HTML, no JS required).
    Parses eBay search result cards to extract listing data.
    Cost: $0 (local resources, tracked under 'html_scraper').
    """

    def __init__(self):
        self._scraper = UnifiedScraper()

    def _search_via_api(
        self, keyword: str, max_pages: int = 2, caller_id: str = "system", country: str = "US"
    ) -> list[dict] | None:
        app_id = os.environ.get("EBAY_APP_ID")
        if not app_id:
            return None

        listings = []
        try:
            for page in range(1, max_pages + 1):
                url = "https://svcs.ebay.com/services/search/FindingService/v1"
                params = {
                    "OPERATION-NAME": "findItemsByKeywords",
                    "SERVICE-VERSION": "1.0.0",
                    "SECURITY-APPNAME": app_id,
                    "RESPONSE-DATA-FORMAT": "JSON",
                    "keywords": keyword,
                    "paginationInput.entriesPerPage": 20,
                    "paginationInput.pageNumber": page,
                    "GLOBAL-ID": EBAY_GLOBAL_IDS.get(country.upper(), "EBAY-US"),
                }
                resp = call_with_tracking(
                    "ebay_api", caller_id, "/findItems",
                    lambda: requests.get(url, params=params, timeout=10)
                )
                if resp.status_code != 200:
                    print(f"[EbayScraper] API status {resp.status_code}: {resp.text[:200]}")
                    break
                data = resp.json()
                response_obj = data.get("findItemsByKeywordsResponse", [{}])[0]
                if response_obj.get("ack", ["Failure"])[0] == "Success":
                    search_result = response_obj.get("searchResult", [{}])[0]
                    items = search_result.get("item", [])
                    for item in items:
                        title = item.get("title", [None])[0]
                        listing_url = item.get("viewItemURL", [None])[0]
                        price_container = item.get("sellingStatus", [{}])[0].get("currentPrice", [{}])[0]
                        price_val = price_container.get("__value__", None)
                        price = f"${price_val}" if price_val else None
                        
                        image = item.get("galleryURL", [None])[0]
                        seller = item.get("sellerInfo", [{}])[0].get("sellerUserName", [None])[0]
                        
                        listings.append({
                            "title": title,
                            "price": price,
                            "seller": seller,
                            "url": listing_url,
                            "image": image,
                        })
                else:
                    break
            return listings
        except Exception as e:
            print(f"[EbayScraper] API search failed: {e}")
            return None

    def search(
        self, keyword: str, max_pages: int = 2, caller_id: str = "system", country: str = "US"
    ) -> list[dict]:
        """
        Scrape eBay search results pages and extract structured listing data.
        """
        api_results = self._search_via_api(keyword, max_pages, caller_id, country=country)
        if api_results is not None:
            return api_results

        listings = []
        encoded = keyword.replace(" ", "+")
        domain = EBAY_DOMAINS.get(country.upper(), "www.ebay.com")
        for page in range(1, max_pages + 1):
            url = f"https://{domain}/sch/i.html?_nkw={encoded}&_pgn={page}"
            try:
                result = self._scraper.scrape(url, caller_id=caller_id)
                if not result.success or not result.html:
                    print(f"[EbayScraper] Page {page} returned no HTML content.")
                    break
                soup = BeautifulSoup(result.html, "html.parser")
                for item in soup.select(".s-item"):
                    listing = self._extract_listing(item)
                    if listing:
                        listings.append(listing)
            except ApiLimitError:
                raise
            except Exception as e:
                print(f"[EbayScraper] Page {page} failed: {e}")
                break
        return listings

    def _extract_listing(self, element) -> dict | None:
        """Parse a single eBay product card."""
        try:
            title_el = element.select_one(".s-item__title")
            # Skip the "Shop on eBay" / "Results matching fewer words" cards
            if not title_el:
                return None
            title = title_el.get_text(strip=True)
            if title.lower() in ("shop on ebay", ""):
                return None

            price_el = element.select_one(".s-item__price")
            link_el = element.select_one(".s-item__link")
            image_el = element.select_one(".s-item__image-img")
            seller_el = element.select_one(".s-item__seller-info-text")
            subtitle_el = element.select_one(".s-item__subtitle")

            url = link_el["href"] if link_el and "href" in link_el.attrs else None
            # Strip eBay tracking parameters
            if url and "?" in url:
                url = url.split("?")[0]

            return {
                "title": title,
                "price": price_el.get_text(strip=True) if price_el else None,
                "seller": seller_el.get_text(strip=True) if seller_el else None,
                "url": url,
                "image": image_el.get("src") if image_el else None,
                "subtitle": subtitle_el.get_text(strip=True) if subtitle_el else None,
            }
        except Exception:
            return None


class AlibabaScraper:
    """
    Alibaba scraper using UnifiedScraper (static HTML, no JS required).
    Cost: $0 (local resources, tracked under 'html_scraper').
    """

    def __init__(self):
        self._scraper = UnifiedScraper()

    def _search_via_api(self, keyword: str, max_pages: int = 2, caller_id: str = "system") -> list[dict] | None:
        app_key = os.environ.get("ALIBABA_APP_KEY")
        app_secret = os.environ.get("ALIBABA_APP_SECRET")
        if not app_key or not app_secret:
            return None

        import hashlib
        import time

        listings = []
        try:
            for page in range(1, max_pages + 1):
                params = {
                    "method": "alibaba.icbu.product.search",
                    "app_key": app_key,
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
                    "format": "json",
                    "v": "2.0",
                    "sign_method": "md5",
                    "subject": keyword,
                    "page_size": "20",
                    "current_page": str(page),
                }
                # Sign parameters
                sorted_keys = sorted(params.keys())
                sign_str = app_secret
                for k in sorted_keys:
                    sign_str += f"{k}{params[k]}"
                sign_str += app_secret
                params["sign"] = hashlib.md5(sign_str.encode("utf-8")).hexdigest().upper()

                url = "https://api.alibaba.com/router/rest"
                resp = call_with_tracking(
                    "alibaba_api", caller_id, "/search",
                    lambda: requests.get(url, params=params, timeout=10)
                )
                if resp.status_code != 200:
                    print(f"[AlibabaScraper] API status {resp.status_code}: {resp.text[:200]}")
                    break
                
                data = resp.json()
                if "error_response" in data:
                    print(f"[AlibabaScraper] API Error: {data['error_response'].get('sub_msg')}")
                    break

                response_obj = data.get("alibaba_icbu_product_search_response", {})
                results_container = response_obj.get("products", {})
                products = results_container.get("product", [])
                for p in products:
                    title = p.get("subject")
                    pid = p.get("product_id")
                    price_val = p.get("price")
                    url = f"https://www.alibaba.com/product-detail/{pid}.html" if pid else None
                    listings.append({
                        "title": title,
                        "price": price_val,
                        "url": url,
                    })
            return listings
        except Exception as e:
            print(f"[AlibabaScraper] API search failed: {e}")
            return None

    def search(self, keyword: str, max_pages: int = 2, caller_id: str = "system", country: str = "US") -> list[dict]:
        api_results = self._search_via_api(keyword, max_pages, caller_id)
        if api_results is not None:
            return api_results

        listings = []
        encoded = keyword.replace(" ", "+")
        for page in range(1, max_pages + 1):
            url = f"https://www.alibaba.com/trade/search?SearchText={encoded}&page={page}"
            try:
                result = self._scraper.scrape(url, caller_id=caller_id)
                if not result.success or not result.html:
                    break
                soup = BeautifulSoup(result.html, "html.parser")
                for item in soup.select(".organic-list-offer-outter, .J-offer-wrapper, [data-content='productItem']"):
                    title_el = item.select_one(".elements-title-normal__content, h2 a")
                    price_el = item.select_one(".elements-offer-price-normal__price")
                    link_el = item.select_one("a[href]")
                    if title_el:
                        href = link_el["href"] if link_el and "href" in link_el.attrs else None
                        if href and not href.startswith("http"):
                            href = f"https:{href}" if href.startswith("//") else f"https://www.alibaba.com{href}"
                        listings.append({
                            "title": title_el.get_text(strip=True),
                            "price": price_el.get_text(strip=True) if price_el else None,
                            "url": href,
                        })
            except ApiLimitError:
                raise
            except Exception as e:
                print(f"[AlibabaScraper] Page {page} failed: {e}")
                break
        return listings


class EtsyScraper:
    """
    Etsy scraper using UnifiedScraper (static HTML, no JS required).
    Parses search result listing cards.
    Cost: $0 (local resources, tracked under 'html_scraper').
    """

    def __init__(self):
        self._scraper = UnifiedScraper()

    def search(self, keyword: str, max_pages: int = 2, caller_id: str = "system", country: str = "US") -> list[dict]:
        listings = []
        encoded = urllib.parse.quote_plus(keyword)
        for page in range(1, max_pages + 1):
            url = f"https://www.etsy.com/search?q={encoded}&page={page}"
            try:
                result = self._scraper.scrape(url, caller_id=caller_id)
                if not result.success or not result.html:
                    print(f"[EtsyScraper] Page {page} returned no HTML content.")
                    break
                soup = BeautifulSoup(result.html, "html.parser")
                # Etsy listing cards
                for item in soup.select(".v2-listing-card, [data-listing-id]"):
                    listing = self._extract_listing(item)
                    if listing:
                        listings.append(listing)
            except ApiLimitError:
                raise
            except Exception as e:
                print(f"[EtsyScraper] Page {page} failed: {e}")
                break
        return listings

    def _extract_listing(self, element) -> dict | None:
        try:
            title_el = element.select_one(".v2-listing-card__info h3, .v2-listing-card__title")
            price_el = element.select_one(".currency-value, .lc-price span.currency-value")
            link_el = element.select_one("a.listing-link, a[href*='/listing/']")
            shop_el = element.select_one(".v2-listing-card__shop, .shop-name")
            image_el = element.select_one("img")

            title = title_el.get_text(strip=True) if title_el else None
            if not title:
                return None

            href = link_el["href"] if link_el and "href" in link_el.attrs else None

            return {
                "title": title,
                "price": price_el.get_text(strip=True) if price_el else None,
                "seller": shop_el.get_text(strip=True) if shop_el else None,
                "url": href,
                "image": image_el.get("src") if image_el else None,
            }
        except Exception:
            return None


class AliExpressScraper:
    """
    AliExpress scraper using UnifiedScraper (JS-heavy, routed to Firecrawl).
    Uses Gemini AI to extract structured listings from rendered markdown.
    Cost: 10 Firecrawl credits per call.
    """

    def __init__(self):
        self._scraper = UnifiedScraper()

    def _search_via_api(self, keyword: str, caller_id: str = "system") -> str | None:
        app_key = os.environ.get("ALIEXPRESS_APP_KEY")
        app_secret = os.environ.get("ALIEXPRESS_APP_SECRET")
        if not app_key or not app_secret:
            return None

        import hashlib
        import time

        try:
            params = {
                "method": "aliexpress.affiliate.product.query",
                "app_key": app_key,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
                "format": "json",
                "v": "2.0",
                "sign_method": "md5",
                "keywords": keyword,
                "page_size": "20",
            }
            # Sign parameters
            sorted_keys = sorted(params.keys())
            sign_str = app_secret
            for k in sorted_keys:
                sign_str += f"{k}{params[k]}"
            sign_str += app_secret
            params["sign"] = hashlib.md5(sign_str.encode("utf-8")).hexdigest().upper()

            url = "https://api.alibaba.com/router/rest"
            resp = call_with_tracking(
                "aliexpress_api", caller_id, "/query",
                lambda: requests.get(url, params=params, timeout=10)
            )
            if resp.status_code != 200:
                print(f"[AliExpressScraper] API status {resp.status_code}: {resp.text[:200]}")
                return None
            
            data = resp.json()
            if "error_response" in data:
                print(f"[AliExpressScraper] API Error: {data['error_response'].get('sub_msg')}")
                return None

            response_obj = data.get("aliexpress_affiliate_product_query_response", {})
            resp_result = response_obj.get("resp_result", {})
            result_list = resp_result.get("result", {}).get("products", {}).get("product", [])
            
            formatted_listings = []
            for p in result_list:
                title = p.get("product_title")
                url = p.get("product_detail_url")
                price = p.get("target_original_price")
                seller = p.get("shop_info", {}).get("shop_name", "Unknown")
                formatted_listings.append({
                    "title": title,
                    "url": url,
                    "price": price,
                    "seller": seller
                })
            # Return serialized JSON string which the Gemini extractor can parse
            return json.dumps(formatted_listings)
        except Exception as e:
            print(f"[AliExpressScraper] API search failed: {e}")
            return None

    def search(self, keyword: str, caller_id: str = "system", country: str = "US") -> str:
        """
        Scrape AliExpress search results via Firecrawl and return raw markdown.
        Structured extraction is handled downstream by Gemini in extract_marketplace_evidence().
        """
        api_result = self._search_via_api(keyword, caller_id)
        if api_result is not None:
            return api_result

        encoded = keyword.replace(" ", "+")
        url = f"https://www.aliexpress.com/wholesale?SearchText={encoded}"
        try:
            result = self._scraper.scrape(url, caller_id=caller_id, location=firecrawl_location(country))
            return result.markdown if result and result.success else ""
        except ApiLimitError:
            raise
        except Exception as e:
            print(f"[AliExpressScraper] Search failed: {e}")
            return ""


class ShopifyScraper:
    """
    Shopify network scraper.
    Strategy:
      1. Google SERP to discover Shopify stores selling the brand
      2. For each discovered store, attempt /products.json (Shopify public API)
    Cost: $0 for HTML + /products.json; SERP uses existing Google SERP quota.
    """

    def __init__(self):
        self._scraper = UnifiedScraper()

    def search(self, keyword: str, caller_id: str = "system", country: str = "US") -> list[dict]:
        listings = []
        encoded = keyword.replace(" ", "+")
        # Step 1: Discover Shopify stores via Google SERP
        search_url = f"https://www.google.com/search?q=site:*.myshopify.com+{encoded}&gl={country.lower()}"
        try:
            result = self._scraper.scrape(search_url, caller_id=caller_id)
            if not result.success or not result.html:
                print("[ShopifyScraper] Google SERP returned no HTML.")
                return []
            soup = BeautifulSoup(result.html, "html.parser")
            store_urls = set()
            for link in soup.select("a[href]"):
                href = link.get("href", "")
                # Extract myshopify.com URLs from Google redirect links
                if "myshopify.com" in href:
                    match = re.search(r'(https?://[\w.-]+\.myshopify\.com)', href)
                    if match:
                        store_urls.add(match.group(1))
            # Step 2: Probe each store's /products.json
            for store_url in list(store_urls)[:5]:  # Cap at 5 stores
                try:
                    products_url = f"{store_url}/products.json?limit=20"
                    resp = call_with_tracking(
                        "html_scraper", caller_id, "/shopify-products",
                        lambda: requests.get(products_url, headers=HEADERS, timeout=10, allow_redirects=True)
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        for p in data.get("products", []):
                            price = None
                            variants = p.get("variants", [])
                            if variants:
                                price = variants[0].get("price")
                            images = p.get("images", [])
                            image_url = images[0].get("src") if images else None
                            listings.append({
                                "title": p.get("title"),
                                "price": f"${price}" if price else None,
                                "seller": p.get("vendor") or store_url,
                                "url": f"{store_url}/products/{p.get('handle')}",
                                "image": image_url,
                            })
                except Exception as e:
                    print(f"[ShopifyScraper] Failed to fetch {store_url}/products.json: {e}")
        except ApiLimitError:
            raise
        except Exception as e:
            print(f"[ShopifyScraper] SERP discovery failed: {e}")
        return listings


class FacebookMarketplaceScraper:
    """
    Facebook Marketplace scraper using Firecrawl JS rendering.
    Facebook aggressively blocks scrapers, so this returns empty gracefully.
    Cost: 10 Firecrawl credits per call.
    """

    def __init__(self):
        self._scraper = UnifiedScraper()

    def search(self, keyword: str, caller_id: str = "system", country: str = "US") -> str:
        encoded = urllib.parse.quote_plus(keyword)
        url = f"https://www.facebook.com/marketplace/search/?query={encoded}"
        try:
            result = self._scraper.scrape(url, caller_id=caller_id, location=firecrawl_location(country))
            if result and result.success and len(result.markdown) > 100:
                return result.markdown
            print("[FacebookMarketplaceScraper] Scrape returned insufficient content (likely blocked).")
            return ""
        except ApiLimitError:
            raise
        except Exception as e:
            print(f"[FacebookMarketplaceScraper] Search failed: {e}")
            return ""


class TikTokScraper:
    """
    TikTok scraper using Firecrawl JS rendering.
    Extracts video metadata from TikTok search results.
    Cost: 10 Firecrawl credits per call.
    """

    def __init__(self):
        self._scraper = UnifiedScraper()

    def search(self, keyword: str, caller_id: str = "system", country: str = "US") -> str:
        encoded = urllib.parse.quote_plus(keyword)
        url = f"https://www.tiktok.com/search?q={encoded}"
        try:
            result = self._scraper.scrape(url, caller_id=caller_id, location=firecrawl_location(country))
            return result.markdown if result and result.success else ""
        except ApiLimitError:
            raise
        except Exception as e:
            print(f"[TikTokScraper] Search failed: {e}")
            return ""


class InstagramScraper:
    """
    Instagram scraper using Firecrawl JS rendering.
    Scrapes hashtag explore pages for brand mentions.
    Cost: 10 Firecrawl credits per call.
    """

    def __init__(self):
        self._scraper = UnifiedScraper()

    def search(self, keyword: str, caller_id: str = "system", country: str = "US") -> str:
        tag = keyword.lower().replace(" ", "")
        url = f"https://www.instagram.com/explore/tags/{tag}/"
        try:
            result = self._scraper.scrape(url, caller_id=caller_id, location=firecrawl_location(country))
            return result.markdown if result and result.success else ""
        except ApiLimitError:
            raise
        except Exception as e:
            print(f"[InstagramScraper] Search failed: {e}")
            return ""


class GoogleShoppingScraper:
    """
    Google Shopping scraper using static HTML (Google serves server-rendered HTML).
    Parses shopping result cards from Google's shopping tab.
    Cost: $0 (local resources, tracked under 'html_scraper').
    """

    def __init__(self):
        self._scraper = UnifiedScraper()

    def search(self, keyword: str, caller_id: str = "system", country: str = "US") -> list[dict]:
        listings = []
        encoded = keyword.replace(" ", "+")
        url = f"https://www.google.com/search?tbm=shop&q={encoded}&gl={country.lower()}"
        try:
            result = self._scraper.scrape(url, caller_id=caller_id)
            if not result.success or not result.html:
                print("[GoogleShoppingScraper] No HTML content returned.")
                return []
            soup = BeautifulSoup(result.html, "html.parser")
            # Google Shopping product cards
            for item in soup.select(".sh-dgr__gr-auto, .sh-dlr__list-result, [data-docid]"):
                listing = self._extract_listing(item)
                if listing:
                    listings.append(listing)
            # Fallback: if no structured cards found, use link-based extraction
            if not listings:
                for link in soup.select("a[href]"):
                    href = link.get("href", "")
                    title_el = link.select_one("h3, h4, .tAxDx, .Xjkr3b")
                    if title_el and "/shopping/product/" in href:
                        listings.append({
                            "title": title_el.get_text(strip=True),
                            "url": f"https://www.google.com{href}" if href.startswith("/") else href,
                            "price": None,
                            "seller": None,
                        })
        except ApiLimitError:
            raise
        except Exception as e:
            print(f"[GoogleShoppingScraper] Search failed: {e}")
        return listings

    def _extract_listing(self, element) -> dict | None:
        try:
            title_el = element.select_one("h3, h4, .tAxDx, .Xjkr3b")
            price_el = element.select_one(".a8Pemb, .HRLxBb, .kHxwFf")
            merchant_el = element.select_one(".aULzUe, .IuHnof, .E5ocAb")
            link_el = element.select_one("a[href]")

            title = title_el.get_text(strip=True) if title_el else None
            if not title:
                return None

            href = link_el["href"] if link_el and "href" in link_el.attrs else None
            if href and href.startswith("/"):
                href = f"https://www.google.com{href}"

            return {
                "title": title,
                "price": price_el.get_text(strip=True) if price_el else None,
                "seller": merchant_el.get_text(strip=True) if merchant_el else None,
                "url": href,
            }
        except Exception:
            return None


class GoogleSERPAPI:
    """
    Tier 2 — Scrapes Google Search organic listings to identify ranking domains 
    and checks them for brand infringement/cloning.
    """
    def __init__(self):
        self._last_search_failed = False

    def search(
        self, brand_name: str, max_pages: int = 2, caller_id: str = "system", country: str = "US"
    ) -> list[str]:
        """
        Scrapes google search pages, queries SerpApi, or queries SearchCans for brand_name,
        extracts URLs and returns domains.
        """
        domains = set()
        query = brand_name.replace(" ", "+")
        brand_domain = brand_name.lower().replace(" ", "")
        official_domains = {
            f"{brand_domain}.com",
            f"{brand_domain}.net",
            f"{brand_domain}.org",
        }
        
        self._last_search_failed = False
        google_serp_api_key = os.environ.get("GOOGLE_SERP_API")
        searchcans_api_key = os.environ.get("SEARCHCANS_API")
        
        # 1. Attempt Google SERP API (SerpApi)
        use_serp_api = bool(google_serp_api_key)
        if use_serp_api:
            from tracemark_api.services.api_usage_tracker import tracker
            if tracker.is_blocked("google_serp"):
                print("[GoogleSERPAPI] google_serp API limit reached. Checking fallback.")
                use_serp_api = False

        if use_serp_api:
            try:
                for page in range(max_pages):
                    start = page * 10
                    serp_url = "https://serpapi.com/search.json"
                    params = {
                        "q": brand_name,
                        "api_key": google_serp_api_key,
                        "engine": "google",
                        "start": start
                    }
                    params.update(serpapi_geo_params(country))
                    resp = call_with_tracking(
                        "google_serp", caller_id, "/check-brand",
                        lambda: requests.get(serp_url, params=params, headers=HEADERS, timeout=10)
                    )
                    if resp.status_code != 200:
                        print(f"[GoogleSERPAPI] SerpApi failed with status {resp.status_code}")
                        self._last_search_failed = True
                        break
                    
                    data = resp.json()
                    for item in data.get("organic_results", []):
                        link = item.get("link")
                        if link:
                            self._add_link_to_domains(link, official_domains, domains, brand_name)
                    time.sleep(0.5)
                return list(domains)
            except ApiLimitError:
                print("[GoogleSERPAPI] SerpApi hit rate limit during scan. Falling back.")
                self._last_search_failed = True
            except Exception as e:
                print(f"[GoogleSERPAPI] SerpApi failed with exception: {e}. Falling back.")
                self._last_search_failed = True

        # 2. Attempt SearchCans API fallback
        use_searchcans = bool(searchcans_api_key)
        if use_searchcans:
            from tracemark_api.services.api_usage_tracker import tracker
            if tracker.is_blocked("searchcans"):
                print("[GoogleSERPAPI] SearchCans API limit reached. Checking next fallback.")
                use_searchcans = False

        if use_searchcans:
            try:
                for page in range(max_pages):
                    payload = {
                        "t": "google",
                        "s": brand_name,
                        "p": page + 1
                    }
                    headers = {
                        "Authorization": f"Bearer {searchcans_api_key}",
                        "Content-Type": "application/json"
                    }
                    resp = call_with_tracking(
                        "searchcans", caller_id, "/check-brand",
                        lambda: requests.post(
                            "https://www.searchcans.com/api/v1/search",
                            json=payload,
                            headers=headers,
                            timeout=15
                        )
                    )
                    if resp.status_code != 200:
                        print(f"[GoogleSERPAPI] SearchCans failed with status {resp.status_code}")
                        self._last_search_failed = True
                        break
                    
                    data = resp.json()
                    organic = data.get("data", {}).get("organic", [])
                    for item in organic:
                        link = item.get("link")
                        if link:
                            self._add_link_to_domains(link, official_domains, domains, brand_name)
                    time.sleep(0.5)
                return list(domains)
            except ApiLimitError:
                print("[GoogleSERPAPI] SearchCans hit rate limit during scan. Falling back.")
                self._last_search_failed = True
            except Exception as e:
                print(f"[GoogleSERPAPI] SearchCans failed with exception: {e}. Falling back.")
                self._last_search_failed = True

        # 3. Fallback to HTML Google Scraper (local requests)
        try:
            for page in range(max_pages):
                start = page * 10
                url = f"https://www.google.com/search?q={query}&start={start}&gl={country.lower()}"
                resp = call_with_tracking(
                    "google_serp", caller_id, "/check-brand",
                    lambda: requests.get(url, headers=HEADERS, timeout=10)
                )
                if resp.status_code != 200:
                    print(f"[GoogleSERPAPI] Static HTML search failed with status {resp.status_code}")
                    self._last_search_failed = True
                    break
                
                soup = BeautifulSoup(resp.text, "html.parser")
                for item in soup.select("a[href]"):
                    href = item["href"]
                    if href.startswith("/url?q="):
                        match = re.search(r"/url\?q=(https?://[^&]+)", href)
                        if match:
                            href = urllib.parse.unquote(match.group(1))
                    if href.startswith("http"):
                        self._add_link_to_domains(href, official_domains, domains, brand_name)
                time.sleep(1.0)
        except ApiLimitError as e:
            self._last_search_failed = True
            raise e
        except Exception as e:
            print(f"[GoogleSERPAPI] Static search failed: {e}")
            self._last_search_failed = True
            
        return list(domains)

    def _add_link_to_domains(
        self,
        link: str,
        official_domains: set[str],
        domains: set[str],
        brand_name: str | None = None,
    ) -> None:
        try:
            parsed = urllib.parse.urlparse(link)
            netloc = parsed.netloc.lower()
            if netloc.startswith("www."):
                netloc = netloc[4:]
            if netloc:
                if netloc in official_domains or any(netloc.endswith("." + od) for od in official_domains):
                    return
                if whitelist_service.is_whitelisted(netloc):
                    return
                # Brand-relevance pre-filter: reject domains whose name
                # has no textual similarity to the brand.  This prevents
                # unrelated sites that merely appear in SERP results
                # (e.g. njctl.org when monitoring "derila") from being
                # forwarded to the expensive WHOIS + Gemini pipeline.
                if brand_name:
                    from rapidfuzz import fuzz
                    from tracemark_api.services.domain_whitelist import get_registered_domain
                    base = get_registered_domain(netloc)
                    # Strip TLD to get the meaningful part (e.g. "njctl" from "njctl.org")
                    domain_label = base.rsplit(".", 1)[0] if "." in base else base
                    # Expand hyphens/dots into spaces for fair comparison
                    domain_label_spaced = domain_label.replace("-", " ").replace(".", " ")
                    brand_lower = brand_name.lower().strip()
                    score = fuzz.partial_ratio(brand_lower, domain_label_spaced) / 100.0
                    if score < 0.60:
                        return
                domains.add(netloc)
        except Exception:
            pass

    def check_serp_domains(self, brand_name: str, caller_id: str = "system", country: str = "US") -> list[dict]:
        import whois
        domains = self.search(brand_name, max_pages=5, caller_id=caller_id, country=country)
        
        # Fallback if Google blocked us and we got no domains:
        if not domains:
            if self._last_search_failed:
                print("[GoogleSERPAPI] Google search query failed or was blocked.")
            else:
                print("[GoogleSERPAPI] No suspicious domains found in Google search results.")
            domains = []
            
        results = []
        for domain in list(domains):
            try:
                w = call_with_tracking(
                    "whois", caller_id, "/check-brand",
                    lambda: whois.whois(domain, quiet=True, timeout=2)
                )
                registrar = "unknown"
                created_date = "unknown"
                expiry_date = "unknown"
                name_servers = []
                org = "unknown"
                country_val = "unknown"
                emails = "unknown"
                if w:
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
                    org = w.get("org") or w.get("organization") or "unknown"
                    if isinstance(org, list):
                        org = org[0]
                    country_val = w.get("country") or "unknown"
                    if isinstance(country_val, list):
                        country_val = country_val[0]
                    emails = w.get("emails") or w.get("email") or "unknown"
                    if isinstance(emails, list):
                        emails = emails[0]
                results.append({
                    "domain": domain,
                    "registrant": registrar,
                    "created_date": str(created_date) if created_date else "unknown",
                    "expiry_date": str(expiry_date) if expiry_date else "unknown",
                    "status": "active",
                    "name_servers": list(name_servers),
                    "registrant_organization": org,
                    "registrant_country": country_val,
                    "registrant_email": emails,
                    "country": country,
                })
                time.sleep(0.5)
            except ApiLimitError:
                raise
            except Exception:
                results.append({
                    "domain": domain,
                    "registrant": "unknown",
                    "created_date": "unknown",
                    "expiry_date": "unknown",
                    "status": "active",
                    "name_servers": [],
                    "registrant_organization": "unknown",
                    "registrant_country": "unknown",
                    "registrant_email": "unknown",
                    "country": country,
                })
        return results


class GoogleAdsAPI:
    """
    Tier 2 — Google Ads Transparency Center API.
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
        caller_id: str = "system",
        country: str = "US",
    ) -> list[dict]:
        """
        Searches the Google Ads Transparency database for ads mentioning brand_keyword.
        """
        # Map region to country parameter if provided
        reg = region if region != "US" else country
        try:
            params = {
                "query": brand_keyword,
                "region": reg,
                "format": "json",
            }
            resp = call_with_tracking(
                "google_ads", caller_id, "/check-ads",
                lambda: requests.get(self.BASE_URL, params=params, headers=HEADERS, timeout=10)
            )
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
            return self._scrape_fallback(brand_keyword, official_advertisers, caller_id=caller_id, region=reg)
        except ApiLimitError:
            raise
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
        caller_id: str = "system",
        region: str = "US",
    ) -> list[dict]:
        """Fallback when the JSON API is unavailable."""
        ads = self._scrape_html(brand_keyword, official_advertisers, caller_id=caller_id, region=region)
        if ads:
            return ads
        if os.environ.get("FIRECRAWL_API_KEY") and os.environ.get("GEMINI_API_KEY"):
            print("[GoogleAdsAPI] HTML scrape empty — trying Firecrawl + Gemini extraction.")
            return self._firecrawl_extract(brand_keyword, official_advertisers, caller_id=caller_id, region=region)
        return []

    def _scrape_html(
        self,
        brand_keyword: str,
        official_advertisers: list[str] | None = None,
        caller_id: str = "system",
        region: str = "US",
    ) -> list[dict]:
        """BS4 scrape of adstransparency.google.com search page."""
        try:
            url = f"{self.FALLBACK_URL}?query={brand_keyword.replace(' ', '+')}&region={region}"
            resp = call_with_tracking(
                "google_ads", caller_id, "/check-ads",
                lambda: requests.get(url, headers=HEADERS, timeout=15)
            )
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
        except ApiLimitError:
            raise
        except Exception as e:
            print(f"[GoogleAdsAPI] HTML scrape failed: {e}")
            return []

    def _firecrawl_extract(
        self,
        brand_keyword: str,
        official_advertisers: list[str] | None = None,
        caller_id: str = "system",
        region: str = "US",
    ) -> list[dict]:
        url = f"{self.FALLBACK_URL}?query={brand_keyword.replace(' ', '+')}&region={region}"
        result = call_with_tracking(
            "firecrawl", caller_id, "/google-ads-extract",
            lambda: scrape_page(url),
            credits_used=10
        )
        if not result or not result.success or not result.markdown:
            return []
        return extract_ads_from_content(brand_keyword, "google_ads", result.markdown, official_advertisers, caller_id=caller_id)


class MetaAdsAPI:
    """
    Tier 2 — Meta Ad Library API (Facebook/Instagram).
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
        caller_id: str = "system",
    ) -> list[dict]:
        """
        Queries the Meta Ad Library for ads mentioning brand_keyword.
        """
        access_token = os.environ.get("META_ADS_ACCESS_TOKEN")
        if not access_token:
            print("[MetaAdsAPI] META_ADS_ACCESS_TOKEN not set — skipping")
            return []
        try:
            params = {
                "access_token": access_token,
                "search_terms": brand_keyword,
                "ad_reached_countries": json.dumps([country]),
                "ad_type": "ALL",
                "fields": "id,ad_creative_bodies,page_name,ad_snapshot_url,impressions,spend",
                "limit": 50,
            }
            resp = call_with_tracking(
                "meta_ads", caller_id, "/check-ads",
                lambda: requests.get(self.BASE_URL, params=params, timeout=15)
            )
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
        except ApiLimitError:
            raise
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
            bodies = item.get("ad_creative_bodies") or []
            ad_text = " ".join(bodies) if isinstance(bodies, list) else str(bodies)
            ad_id = item.get("id", "")
            clean_url = (
                f"https://www.facebook.com/ads/library/?id={ad_id}"
                if ad_id
                else item.get("ad_snapshot_url", "")
            )
            raw.append({
                "source": "meta_ads",
                "advertiser": item.get("page_name", ""),
                "ad_text": ad_text,
                "destination_url": clean_url,
                "screenshot_url": _meta_screenshot(item.get("ad_snapshot_url")),
                "impressions": item.get("impressions", {}).get("lower_bound", "unknown"),
                "detected_date": "",
            })
        return filter_hijacking_ads(raw, brand_keyword, official_advertisers)


# Note: FirecrawlScraper has been replaced by UnifiedScraper.
# JS-heavy sites (AliExpress, TikTok, etc.) are handled by
# UnifiedScraper._scrape_js() which delegates to Firecrawl internally.
# The 24-hour cache is also managed inside UnifiedScraper.


class MarketplaceScraper:
    """
    Main aggregator. Routes each platform to the correct scraping tier via UnifiedScraper.

    Routing:
      - Amazon, eBay, Alibaba, Etsy, Google Shopping → static HTML (local resources)
      - AliExpress, TikTok, Instagram, Facebook, Shopify → JS-heavy (Firecrawl)
      - Unknown domains → UnifiedScraper heuristic probe + static-first fallback
    """

    def __init__(self):
        self.amazon = AmazonScraper()
        self.ebay = EbayScraper()
        self.alibaba = AlibabaScraper()
        self.etsy = EtsyScraper()
        self.aliexpress = AliExpressScraper()
        self.shopify = ShopifyScraper()
        self.facebook_marketplace = FacebookMarketplaceScraper()
        self.tiktok = TikTokScraper()
        self.instagram = InstagramScraper()
        self.google_shopping = GoogleShoppingScraper()
        self.google_ads = GoogleAdsAPI()
        self.meta_ads = MetaAdsAPI()
        self.serp = GoogleSERPAPI()
        self.unified = UnifiedScraper()  # General-purpose scraper for all other URLs

    def scrape_all_sources(
        self,
        brand_name: str,
        platforms: list[str],
        official_advertisers: list[str] | None = None,
        caller_id: str = "system",
    ) -> tuple[dict, list[str]]:
        """
        Coordinates all tiers and returns a raw results dict and a list of blocked API keys.
        Only queries platforms that are in the requested platforms list.
        """
        results = {
            "marketplaces": {},
            "ads": {},
            "social": {},
            "domains": [],
            "timestamp": datetime.now().isoformat(),
        }
        blocked_apis = []

        # --- Tier 1: Static HTML scrapers (free, local resources) ---
        if "amazon" in platforms:
            try:
                results["marketplaces"]["amazon"] = self.amazon.search(brand_name, caller_id=caller_id)
            except ApiLimitError as e:
                print(f"[MarketplaceScraper] Amazon rate limit reached: {e}")
                blocked_apis.append("amazon_scraper")
            except Exception as e:
                print(f"[MarketplaceScraper] Amazon search failed: {e}")
        if "ebay" in platforms:
            try:
                results["marketplaces"]["ebay"] = self.ebay.search(brand_name, caller_id=caller_id)
            except ApiLimitError as e:
                print(f"[MarketplaceScraper] eBay rate limit reached: {e}")
                blocked_apis.append("ebay_scraper")
            except Exception as e:
                print(f"[MarketplaceScraper] eBay search failed: {e}")
        if "alibaba" in platforms:
            try:
                results["marketplaces"]["alibaba"] = self.alibaba.search(brand_name, caller_id=caller_id)
            except Exception as e:
                print(f"[MarketplaceScraper] Alibaba search failed: {e}")
        if "etsy" in platforms:
            try:
                results["marketplaces"]["etsy"] = self.etsy.search(brand_name, caller_id=caller_id)
            except ApiLimitError as e:
                print(f"[MarketplaceScraper] Etsy rate limit reached: {e}")
                blocked_apis.append("etsy_scraper")
            except Exception as e:
                print(f"[MarketplaceScraper] Etsy search failed: {e}")
        if "google_shopping" in platforms:
            try:
                results["marketplaces"]["google_shopping"] = self.google_shopping.search(brand_name, caller_id=caller_id)
            except ApiLimitError as e:
                print(f"[MarketplaceScraper] Google Shopping rate limit reached: {e}")
                blocked_apis.append("google_shopping_scraper")
            except Exception as e:
                print(f"[MarketplaceScraper] Google Shopping search failed: {e}")

        # --- Tier 2: JS-heavy / Firecrawl scrapers ---
        if "aliexpress" in platforms:
            try:
                results["marketplaces"]["aliexpress"] = self.aliexpress.search(brand_name, caller_id=caller_id)
            except ApiLimitError as e:
                print(f"[MarketplaceScraper] AliExpress rate limit reached: {e}")
                blocked_apis.append(e.api_key if hasattr(e, 'api_key') else "firecrawl")
            except Exception as e:
                print(f"[MarketplaceScraper] AliExpress search failed: {e}")
        if "shopify" in platforms:
            try:
                results["marketplaces"]["shopify"] = self.shopify.search(brand_name, caller_id=caller_id)
            except ApiLimitError as e:
                print(f"[MarketplaceScraper] Shopify rate limit reached: {e}")
                blocked_apis.append("shopify_scraper")
            except Exception as e:
                print(f"[MarketplaceScraper] Shopify search failed: {e}")
        if "facebook_marketplace" in platforms:
            try:
                results["marketplaces"]["facebook_marketplace"] = self.facebook_marketplace.search(brand_name, caller_id=caller_id)
            except ApiLimitError as e:
                print(f"[MarketplaceScraper] Facebook Marketplace rate limit reached: {e}")
                blocked_apis.append(e.api_key if hasattr(e, 'api_key') else "firecrawl")
            except Exception as e:
                print(f"[MarketplaceScraper] Facebook Marketplace search failed: {e}")

        # --- Social media scrapers (results go into 'social' key) ---
        if "tiktok" in platforms:
            try:
                results["social"]["tiktok"] = self.tiktok.search(brand_name, caller_id=caller_id)
            except ApiLimitError as e:
                print(f"[MarketplaceScraper] TikTok rate limit reached: {e}")
                blocked_apis.append(e.api_key if hasattr(e, 'api_key') else "firecrawl")
            except Exception as e:
                print(f"[MarketplaceScraper] TikTok search failed: {e}")
        if "instagram" in platforms:
            try:
                results["social"]["instagram"] = self.instagram.search(brand_name, caller_id=caller_id)
            except ApiLimitError as e:
                print(f"[MarketplaceScraper] Instagram rate limit reached: {e}")
                blocked_apis.append(e.api_key if hasattr(e, 'api_key') else "firecrawl")
            except Exception as e:
                print(f"[MarketplaceScraper] Instagram search failed: {e}")

        # --- Tier 3: Official APIs ---
        if "google_ads" in platforms:
            try:
                results["ads"]["google"] = self.google_ads.search(brand_name, official_advertisers=official_advertisers, caller_id=caller_id)
            except ApiLimitError as e:
                print(f"[MarketplaceScraper] Google Ads rate limit reached: {e}")
                blocked_apis.append("google_ads")
            except Exception as e:
                print(f"[MarketplaceScraper] Google Ads search failed: {e}")
        if "meta_ads" in platforms:
            try:
                results["ads"]["meta"] = self.meta_ads.search(brand_name, official_advertisers=official_advertisers, caller_id=caller_id)
            except ApiLimitError as e:
                print(f"[MarketplaceScraper] Meta Ads rate limit reached: {e}")
                blocked_apis.append("meta_ads")
            except Exception as e:
                print(f"[MarketplaceScraper] Meta Ads search failed: {e}")
        if "whois" in platforms or "domains" in platforms or "serp" in platforms:
            try:
                results["domains"] = self.serp.check_serp_domains(brand_name, caller_id=caller_id)
            except ApiLimitError as e:
                print(f"[MarketplaceScraper] Google SERP/WHOIS rate limit reached: {e}")
                blocked_apis.append(e.api_key)
            except Exception as e:
                print(f"[MarketplaceScraper] Domain search failed: {e}")

        return results, blocked_apis

    async def batch_detect(
        self,
        brand_name: str,
        platforms: list[str],
        official_advertisers: list[str] | None = None,
        caller_id: str = "system",
        countries: list[str] = ["US"],
    ) -> tuple[dict, list[str]]:
        """
        Runs scraping tasks concurrently using asyncio.gather and asyncio.to_thread.
        """
        results = {
            "marketplaces": {},
            "ads": {},
            "social": {},
            "domains": [],
            "timestamp": datetime.now().isoformat(),
        }
        blocked_apis = []
        tasks = []

        # Initialize results structure
        for p in platforms:
            if p in ["amazon", "ebay", "alibaba", "etsy", "google_shopping", "aliexpress", "shopify", "facebook_marketplace"]:
                results["marketplaces"][p] = {}
            elif p in ["google_ads", "meta_ads"]:
                pass  # handled individually
            elif p in ["tiktok", "instagram"]:
                results["social"][p] = {}

        # Amazon
        if "amazon" in platforms:
            for country in countries:
                async def wrap_amazon(c=country):
                    try:
                        res = await asyncio.to_thread(self.amazon.search, brand_name, caller_id=caller_id, country=c)
                        results["marketplaces"]["amazon"][c] = res
                    except ApiLimitError as e:
                        print(f"[MarketplaceScraper] Amazon rate limit reached for {c}: {e}")
                        blocked_apis.append("amazon_scraper")
                    except Exception as e:
                        print(f"[MarketplaceScraper] Amazon search failed for {c}: {e}")
                tasks.append(wrap_amazon())

        # eBay
        if "ebay" in platforms:
            for country in countries:
                async def wrap_ebay(c=country):
                    try:
                        res = await asyncio.to_thread(self.ebay.search, brand_name, caller_id=caller_id, country=c)
                        results["marketplaces"]["ebay"][c] = res
                    except ApiLimitError as e:
                        print(f"[MarketplaceScraper] eBay rate limit reached for {c}: {e}")
                        blocked_apis.append("ebay_scraper")
                    except Exception as e:
                        print(f"[MarketplaceScraper] eBay search failed for {c}: {e}")
                tasks.append(wrap_ebay())

        # Alibaba
        if "alibaba" in platforms:
            for country in countries:
                async def wrap_alibaba(c=country):
                    try:
                        res = await asyncio.to_thread(self.alibaba.search, brand_name, caller_id=caller_id, country=c)
                        results["marketplaces"]["alibaba"][c] = res
                    except Exception as e:
                        print(f"[MarketplaceScraper] Alibaba search failed for {c}: {e}")
                tasks.append(wrap_alibaba())

        # Etsy
        if "etsy" in platforms:
            for country in countries:
                async def wrap_etsy(c=country):
                    try:
                        res = await asyncio.to_thread(self.etsy.search, brand_name, caller_id=caller_id, country=c)
                        results["marketplaces"]["etsy"][c] = res
                    except ApiLimitError as e:
                        print(f"[MarketplaceScraper] Etsy rate limit reached for {c}: {e}")
                        blocked_apis.append("etsy_scraper")
                    except Exception as e:
                        print(f"[MarketplaceScraper] Etsy search failed for {c}: {e}")
                tasks.append(wrap_etsy())

        # Google Shopping
        if "google_shopping" in platforms:
            for country in countries:
                async def wrap_google_shopping(c=country):
                    try:
                        res = await asyncio.to_thread(self.google_shopping.search, brand_name, caller_id=caller_id, country=c)
                        results["marketplaces"]["google_shopping"][c] = res
                    except ApiLimitError as e:
                        print(f"[MarketplaceScraper] Google Shopping rate limit reached for {c}: {e}")
                        blocked_apis.append("google_shopping_scraper")
                    except Exception as e:
                        print(f"[MarketplaceScraper] Google Shopping search failed for {c}: {e}")
                tasks.append(wrap_google_shopping())

        # AliExpress
        if "aliexpress" in platforms:
            for country in countries:
                async def wrap_aliexpress(c=country):
                    try:
                        res = await asyncio.to_thread(self.aliexpress.search, brand_name, caller_id=caller_id, country=c)
                        results["marketplaces"]["aliexpress"][c] = res
                    except ApiLimitError as e:
                        print(f"[MarketplaceScraper] AliExpress rate limit reached for {c}: {e}")
                        blocked_apis.append(e.api_key if hasattr(e, 'api_key') else "firecrawl")
                    except Exception as e:
                        print(f"[MarketplaceScraper] AliExpress search failed for {c}: {e}")
                tasks.append(wrap_aliexpress())

        # Shopify
        if "shopify" in platforms:
            for country in countries:
                async def wrap_shopify(c=country):
                    try:
                        res = await asyncio.to_thread(self.shopify.search, brand_name, caller_id=caller_id, country=c)
                        results["marketplaces"]["shopify"][c] = res
                    except ApiLimitError as e:
                        print(f"[MarketplaceScraper] Shopify rate limit reached for {c}: {e}")
                        blocked_apis.append("shopify_scraper")
                    except Exception as e:
                        print(f"[MarketplaceScraper] Shopify search failed for {c}: {e}")
                tasks.append(wrap_shopify())

        # Facebook Marketplace
        if "facebook_marketplace" in platforms:
            for country in countries:
                async def wrap_facebook_marketplace(c=country):
                    try:
                        res = await asyncio.to_thread(self.facebook_marketplace.search, brand_name, caller_id=caller_id, country=c)
                        results["marketplaces"]["facebook_marketplace"][c] = res
                    except ApiLimitError as e:
                        print(f"[MarketplaceScraper] Facebook Marketplace rate limit reached for {c}: {e}")
                        blocked_apis.append(e.api_key if hasattr(e, 'api_key') else "firecrawl")
                    except Exception as e:
                        print(f"[MarketplaceScraper] Facebook Marketplace search failed for {c}: {e}")
                tasks.append(wrap_facebook_marketplace())

        # TikTok
        if "tiktok" in platforms:
            for country in countries:
                async def wrap_tiktok(c=country):
                    try:
                        res = await asyncio.to_thread(self.tiktok.search, brand_name, caller_id=caller_id, country=c)
                        results["social"]["tiktok"][c] = res
                    except ApiLimitError as e:
                        print(f"[MarketplaceScraper] TikTok rate limit reached for {c}: {e}")
                        blocked_apis.append(e.api_key if hasattr(e, 'api_key') else "firecrawl")
                    except Exception as e:
                        print(f"[MarketplaceScraper] TikTok search failed for {c}: {e}")
                tasks.append(wrap_tiktok())

        # Instagram
        if "instagram" in platforms:
            for country in countries:
                async def wrap_instagram(c=country):
                    try:
                        res = await asyncio.to_thread(self.instagram.search, brand_name, caller_id=caller_id, country=c)
                        results["social"]["instagram"][c] = res
                    except ApiLimitError as e:
                        print(f"[MarketplaceScraper] Instagram rate limit reached for {c}: {e}")
                        blocked_apis.append(e.api_key if hasattr(e, 'api_key') else "firecrawl")
                    except Exception as e:
                        print(f"[MarketplaceScraper] Instagram search failed for {c}: {e}")
                tasks.append(wrap_instagram())

        # Google Ads
        if "google_ads" in platforms:
            results["ads"]["google"] = {}
            for country in countries:
                async def wrap_google_ads(c=country):
                    try:
                        res = await asyncio.to_thread(self.google_ads.search, brand_name, official_advertisers=official_advertisers, caller_id=caller_id, country=c)
                        results["ads"]["google"][c] = res
                    except ApiLimitError as e:
                        print(f"[MarketplaceScraper] Google Ads rate limit reached for {c}: {e}")
                        blocked_apis.append("google_ads")
                    except Exception as e:
                        print(f"[MarketplaceScraper] Google Ads search failed for {c}: {e}")
                tasks.append(wrap_google_ads())

        # Meta Ads
        if "meta_ads" in platforms:
            results["ads"]["meta"] = {}
            for country in countries:
                async def wrap_meta_ads(c=country):
                    try:
                        res = await asyncio.to_thread(self.meta_ads.search, brand_name, official_advertisers=official_advertisers, caller_id=caller_id, country=c)
                        results["ads"]["meta"][c] = res
                    except ApiLimitError as e:
                        print(f"[MarketplaceScraper] Meta Ads rate limit reached for {c}: {e}")
                        blocked_apis.append("meta_ads")
                    except Exception as e:
                        print(f"[MarketplaceScraper] Meta Ads search failed for {c}: {e}")
                tasks.append(wrap_meta_ads())

        # Domains
        if "whois" in platforms or "domains" in platforms or "serp" in platforms:
            for country in countries:
                async def wrap_domains(c=country):
                    try:
                        res = await asyncio.to_thread(self.serp.check_serp_domains, brand_name, caller_id=caller_id, country=c)
                        results["domains"].extend(res)
                    except ApiLimitError as e:
                        print(f"[MarketplaceScraper] Google SERP/WHOIS rate limit reached for {c}: {e}")
                        blocked_apis.append(e.api_key if hasattr(e, 'api_key') else "google_serp")
                    except Exception as e:
                        print(f"[MarketplaceScraper] Domain search failed for {c}: {e}")
                tasks.append(wrap_domains())

        if tasks:
            await asyncio.gather(*tasks)

        return results, blocked_apis


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
    caller_id: str = "system",
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
    result = call_with_tracking(
        "gemini_flash", caller_id, "/extract-ads",
        lambda: structured_model.invoke(prompt)
    )
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
        screenshot_url=ad.get("screenshot_url") or None,
    )


def extract_marketplace_evidence(
    brand_name: str,
    platform: str,
    raw_content: str,  # Markdown (Tier 3) or pre-serialized listing JSON (Tier 1)
    caller_id: str = "system",
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
    result = call_with_tracking(
        "gemini_flash", caller_id, "/extract-marketplace-evidence",
        lambda: structured_model.invoke(prompt)
    )
    return result.items


class SocialEvidenceList(BaseModel):
    items: list[SocialEvidence] = Field(default_factory=list)


def extract_social_evidence(
    brand_name: str,
    platform: str,
    raw_content: str,
    caller_id: str = "system",
) -> list[SocialEvidence]:
    """
    Uses Gemini to analyze scraped social media content (TikTok, Instagram)
    and extract suspicious accounts/posts that may be infringing on the brand.
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
You are a brand protection analyst. Below is scraped content from {platform} for brand "{brand_name}".

Identify social media accounts or posts that appear to be selling counterfeit products,
impersonating the brand, or using the brand name without authorization.

For each suspicious account/post, return:
- platform: "{platform}"
- handle: the account username/handle
- post_url: direct URL to the post (if available, otherwise null)
- follower_count: follower count (if visible, otherwise null)

Content:
{raw_content[:6000]}

Return a JSON array. If nothing suspicious, return [].
"""
    structured_model = model.with_structured_output(SocialEvidenceList)
    result = call_with_tracking(
        "gemini_flash", caller_id, f"/extract-social-evidence-{platform}",
        lambda: structured_model.invoke(prompt)
    )
    return result.items


def extract_domain_evaluations_with_ai(
    brand_name: str,
    domains_data: list[dict],
    caller_id: str = "system",
) -> list[DomainEvaluation]:
    """
    Uses Gemini to analyze discovered domains and their WHOIS registration data
    to determine if they are copycats, clones, or typosquats, and assigns similarity scores.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or not domains_data:
        return []

    try:
        model = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.0,
            google_api_key=api_key,
        )

        prompt = f"""
You are a brand protection legal analyst. Below is a list of suspicious domains discovered in search results for the brand "{brand_name}", along with their WHOIS registration data.

Evaluate each domain to determine if it is a brand copycat, clone, typosquat, or unauthorized store using the brand name.
For each domain, return:
- domain_name: the domain name evaluated
- is_clone: boolean indicating if it is a clone/infringement
- similarity_score: integer from 0 to 100 representing how close the domain name or branding is to "{brand_name}". Typosquats (e.g. drila.com for derila) or subdomains/variants (e.g. buyderila.com) should have high scores (80-100). Completely unrelated domains (e.g. njctl.org) should have low scores (<30) and is_clone=False.
- reasoning: brief reason for your decision

Suspicious Domains Data:
{json.dumps(domains_data, indent=2)}

Return a JSON array of items matching the requested structure.
"""
        structured_model = model.with_structured_output(DomainEvaluationList)
        result = call_with_tracking(
            "gemini_flash", caller_id, "/extract-domain-evaluation",
            lambda: structured_model.invoke(prompt)
        )
        return result.items
    except Exception as e:
        print(f"[extract_domain_evaluations_with_ai] Gemini call failed: {e}. Falling back to default scoring.")
        fallback = []
        brand = brand_name.lower().strip()
        for d in domains_data:
            domain_name = d.get("domain", "")
            parts = domain_name.lower().split('.')
            domain_part = parts[-2] if len(parts) > 1 else parts[0]
            if brand in domain_part:
                similarity = 90
                is_clone = True
            else:
                similarity = 30
                is_clone = False
            fallback.append(DomainEvaluation(
                domain_name=domain_name,
                is_clone=is_clone,
                similarity_score=similarity,
                reasoning=f"Fallback scoring due to AI failure: {e}"
            ))
        return fallback


async def gather_evidence(
    brand_name: str,
    platforms: list[str],
    official_advertisers: list[str] | None = None,
    caller_id: str = "system",
    countries: list[str] = ["US"],
) -> Evidence:
    """
    Main entrypoint. Runs the 3-tier scraping pipeline and returns
    a fully populated Evidence object.
    """
    # --- Mock mode: no API keys set ---
    if not os.environ.get("FIRECRAWL_API_KEY") and not os.environ.get("GEMINI_API_KEY"):
        return _mock_evidence(brand_name)

    scraper = MarketplaceScraper()
    raw, blocked_apis = await scraper.batch_detect(brand_name, platforms, official_advertisers, caller_id, countries=countries)

    all_marketplace_evidence = []

    # Process Tier 1 + Tier 3 marketplace results through Gemini
    for platform, country_dict in raw["marketplaces"].items():
        for country, content in country_dict.items():
            if isinstance(content, list):
                content_str = str(content)  # Tier 1 returns list of dicts
            else:
                content_str = content or ""  # Tier 3 returns markdown string
            try:
                listings = extract_marketplace_evidence(brand_name, platform, content_str, caller_id)
                for listing in listings:
                    listing.detection_region = country
                    if listing.listing_url and not listing.screenshot_url:
                        listing.screenshot_url = _screenshot_listing(listing.listing_url)
                all_marketplace_evidence.extend(listings)
            except ApiLimitError as e:
                print(f"[gather_evidence] Gemini rate limit reached: {e}")
                if "gemini_flash" not in blocked_apis:
                    blocked_apis.append("gemini_flash")
            except Exception as e:
                print(f"[gather_evidence] Gemini extraction failed for {platform} ({country}): {e}")

    # Convert WHOIS dicts to Pydantic DomainEvidence models
    evaluations = extract_domain_evaluations_with_ai(brand_name, raw.get("domains", []), caller_id=caller_id)
    eval_map = {e.domain_name.lower().strip(): e for e in evaluations}

    domain_evidences = []
    for d in raw.get("domains", []):
        domain_name = d["domain"]
        domain_url = f"https://{domain_name}"
        
        eval_item = eval_map.get(domain_name.lower().strip())
        is_clone = eval_item.is_clone if eval_item else True
        similarity_score = eval_item.similarity_score if eval_item else 90

        # Post-filter: skip domains that the AI evaluator determined
        # are NOT clones/infringements.  This prevents benign domains
        # (e.g. njctl.org) from polluting the evidence output.
        if not is_clone:
            continue

        domain_evidences.append(
            DomainEvidence(
                domain_name=domain_name,
                registrar=d.get("registrant") or "unknown",
                is_clone=is_clone,
                similarity_score=similarity_score,
                screenshot_url=_screenshot_listing(domain_url),
                creation_date=d.get("created_date"),
                expiry_date=d.get("expiry_date"),
                name_servers=d.get("name_servers"),
                registrant_organization=d.get("registrant_organization"),
                registrant_country=d.get("registrant_country"),
                registrant_email=d.get("registrant_email"),
                detection_region=d.get("country", "US"),
            )
        )

    # Map raw ad dicts → AdEvidence Pydantic models
    ad_evidences: list[AdEvidence] = []
    for source in ["google", "meta"]:
        source_dict = raw["ads"].get(source, {})
        for country, ads_list in source_dict.items():
            for ad in ads_list:
                if isinstance(ad, AdEvidence):
                    ad.detection_region = country
                    ad_evidences.append(ad)
                elif isinstance(ad, dict):
                    evidence_item = _ad_dict_to_evidence(ad)
                    evidence_item.detection_region = country
                    ad_evidences.append(evidence_item)

    # Extract social media evidence from TikTok/Instagram raw content
    social_evidences: list[SocialEvidence] = []
    for platform, country_dict in raw.get("social", {}).items():
        for country, content in country_dict.items():
            if isinstance(content, str) and content.strip():
                try:
                    social_items = extract_social_evidence(brand_name, platform, content, caller_id)
                    for item in social_items:
                        item.detection_region = country
                    social_evidences.extend(social_items)
                except ApiLimitError as e:
                    print(f"[gather_evidence] Gemini rate limit reached for {platform} social: {e}")
                    if "gemini_flash" not in blocked_apis:
                        blocked_apis.append("gemini_flash")
                except Exception as e:
                    print(f"[gather_evidence] Gemini social extraction failed for {platform} ({country}): {e}")

    return Evidence(
        marketplaces=all_marketplace_evidence,
        ads=ad_evidences,
        domains=domain_evidences,
        social=social_evidences,
        blocked_apis=blocked_apis,
        scanned_platforms=platforms,
        timestamp=datetime.now(),
    )


async def check_ads_hijacking(
    brand_name: str,
    platforms: list[str] | None = None,
    official_advertisers: list[str] | None = None,
    caller_id: str = "system",
    countries: list[str] = ["US"],
) -> dict:
    """
    Scan Google + Meta ad libraries for hijacking ads targeting brand_name.
    Returns structured results with per-platform counts and AdEvidence records.
    """
    platforms = platforms or ["google_ads", "meta_ads"]
    scraper = MarketplaceScraper()
    raw, blocked_apis = await scraper.batch_detect(brand_name, platforms, official_advertisers, caller_id, countries=countries)
    
    google_ads = []
    for country, ads in raw["ads"].get("google", {}).items():
        for ad in ads:
            if isinstance(ad, dict):
                ad["country"] = country
            google_ads.append(ad)

    meta_ads = []
    for country, ads in raw["ads"].get("meta", {}).items():
        for ad in ads:
            if isinstance(ad, dict):
                ad["country"] = country
            meta_ads.append(ad)
            
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
        "hijacking_ads": [
            (ad.model_dump() if isinstance(ad, AdEvidence) else _ad_dict_to_evidence(ad).model_dump())
            for ad in all_ads
        ],
        "raw_ads": all_ads,
        "blocked_apis": blocked_apis,
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
                screenshot_url="https://placehold.co/1280x800/1a1a2e/ffffff?text=Mock+Evidence+Screenshot",
            )
        ],
        ads=[
            AdEvidence(
                platform="Google Ads",
                ad_copy=f"Buy {brand_name} products — Official Store",
                destination_url=f"https://mock-googleads-{brand_name.lower()}.com",
            ),
            AdEvidence(
                platform="Meta Ads",
                ad_copy=f"{brand_name} Sale — Up to 90% off!",
                destination_url=f"https://mock-metaads-{brand_name.lower()}.net",
                screenshot_url="https://placehold.co/1280x800/1a1a2e/ffffff?text=Mock+Meta+Ad+Screenshot",
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
        blocked_apis=[],
        scanned_platforms=["amazon", "google_ads", "meta_ads", "domains"],
        timestamp=datetime.now(),
    )


def exchange_short_lived_meta_token(short_lived_token: str) -> dict:
    """
    Exchanges a short-lived user access token for a long-lived user access token.
    """
    app_id = os.environ.get("META_APP_ID")
    app_secret = os.environ.get("META_APP_SECRET")
    if not app_id or not app_secret:
        raise ValueError(
            "META_APP_ID and META_APP_SECRET must be configured in environment variables to exchange tokens."
        )

    url = "https://graph.facebook.com/v19.0/oauth/access_token"
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": short_lived_token,
    }

    try:
        resp = requests.get(url, params=params, timeout=15)
        if resp.status_code != 200:
            raise ValueError(f"Meta Graph API error (Status {resp.status_code}): {resp.text}")
        return resp.json()
    except Exception as e:
        if not isinstance(e, ValueError):
            raise ValueError(f"Failed to communicate with Meta Graph API: {e}") from e
        raise


def update_env_meta_token(new_token: str) -> None:
    """
    Helper function to write the updated META_ADS_ACCESS_TOKEN back to the local .env file.
    """
    env_file = find_dotenv()
    if not env_file:
        print("[MetaAuth] No .env file found to update.")
        return

    with open(env_file, "r", encoding="utf-8") as f:
        lines = f.readlines()

    updated = False
    new_lines = []
    for line in lines:
        if line.strip().startswith("META_ADS_ACCESS_TOKEN="):
            new_lines.append(f"META_ADS_ACCESS_TOKEN={new_token}\n")
            updated = True
        else:
            new_lines.append(line)

    if not updated:
        new_lines.append(f"\nMETA_ADS_ACCESS_TOKEN={new_token}\n")

    with open(env_file, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    os.environ["META_ADS_ACCESS_TOKEN"] = new_token
    print(f"[MetaAuth] Successfully updated META_ADS_ACCESS_TOKEN in {env_file}")
