import io
import os
import re
import csv
import zipfile
import urllib.parse
import logging
from datetime import datetime, timedelta
import requests

logger = logging.getLogger(__name__)

# Cache file local path inside the services directory
CACHE_FILE = os.path.join(os.path.dirname(__file__), "tranco_top_100k.txt")
TRANCO_URL = "https://tranco-list.eu/top-1m.csv.zip"
DEFAULT_LIMIT = 100000  # Whitelist the top 100,000 domains

# Hardcoded fallback list in case download fails entirely
FALLBACK_WHITELIST = {
    "google.com", "google.co.uk", "google.com.br", "youtube.com", "wikipedia.org",
    "facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com",
    "pinterest.com", "reddit.com", "amazon.com", "ebay.com", "aliexpress.com",
    "alibaba.com", "walmart.com", "target.com", "etsy.com", "tiktok.com",
    "medium.com", "github.com", "quora.com", "glassdoor.com", "indeed.com",
    "nytimes.com", "cnn.com", "forbes.com", "bloomberg.com", "reuters.com",
    "yahoo.com", "bing.com", "duckduckgo.com", "apple.com", "microsoft.com",
    "netflix.com", "zoom.us", "spotify.com", "salesforce.com", "cloudflare.com"
}


def get_registered_domain(domain: str) -> str:
    """
    Extracts the main registered domain (e.g., 'sub.adidas.com' -> 'adidas.com', 'foo.bar.co.uk' -> 'bar.co.uk').
    """
    domain = domain.lower().strip()
    if domain.startswith("www."):
        domain = domain[4:]
    parts = domain.split(".")
    if len(parts) <= 2:
        return domain
    
    # Heuristic check for common multi-part public suffixes (e.g. .co.uk, .com.br, .org.nz)
    tld = parts[-1]
    sld = parts[-2]
    if len(tld) == 2 and sld in {"co", "com", "org", "net", "gov", "edu", "ac"}:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


class DomainWhitelist:
    def __init__(self, limit: int = DEFAULT_LIMIT):
        self.limit = limit
        self._whitelist = set()
        self._loaded = False

    def load_whitelist(self) -> None:
        """
        Loads the whitelist from local cache. If the cache is missing or stale,
        it attempts to download and extract the latest Tranco list.
        """
        if self._loaded:
            return

        # 1. Check if cache file exists and is recent (less than 7 days old)
        if os.path.exists(CACHE_FILE):
            mtime = datetime.fromtimestamp(os.path.getmtime(CACHE_FILE))
            if datetime.now() - mtime < timedelta(days=7):
                try:
                    self._load_from_cache()
                    logger.info(f"Loaded {len(self._whitelist)} domains from cache: {CACHE_FILE}")
                    self._loaded = True
                    return
                except Exception as e:
                    logger.warning(f"Failed to read from cache file: {e}. Attempting download.")

        # 2. Try downloading and caching from Tranco
        try:
            logger.info(f"Downloading latest Tranco top domains from {TRANCO_URL}")
            resp = requests.get(TRANCO_URL, timeout=30)
            if resp.status_code == 200:
                with zipfile.ZipFile(io.BytesIO(resp.content)) as zip_ref:
                    # Tranco ZIP contains a single CSV file, e.g. top-1m.csv
                    csv_filename = zip_ref.namelist()[0]
                    with zip_ref.open(csv_filename) as csv_file:
                        text_file = io.TextIOWrapper(csv_file, encoding='utf-8')
                        reader = csv.reader(text_file)
                        
                        domains = []
                        for row in reader:
                            if len(row) >= 2:
                                rank = int(row[0])
                                domain = row[1].strip().lower()
                                domains.append(domain)
                                if len(domains) >= self.limit:
                                    break
                                    
                        # Save domains to the local cache file
                        with open(CACHE_FILE, "w", encoding="utf-8") as f:
                            for d in domains:
                                f.write(d + "\n")
                                
                        self._whitelist = set(domains)
                        self._loaded = True
                        logger.info(f"Successfully downloaded and cached {len(self._whitelist)} domains from Tranco")
                        return
            else:
                logger.warning(f"Failed to download Tranco list (HTTP status {resp.status_code})")
        except Exception as e:
            logger.warning(f"Error downloading or processing Tranco list: {e}")

        # 3. Fallback if both cache read and download fail
        if os.path.exists(CACHE_FILE):
            # Try to load whatever stale cache is present as fallback
            try:
                self._load_from_cache()
                logger.info(f"Loaded stale cache fallback containing {len(self._whitelist)} domains")
                self._loaded = True
                return
            except Exception:
                pass

        # Complete fallback
        self._whitelist = set(FALLBACK_WHITELIST)
        self._loaded = True
        logger.warning(f"Failed all cache/download attempts. Loaded fallback list of {len(self._whitelist)} domains")

    def _load_from_cache(self) -> None:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            domains = [line.strip().lower() for line in f if line.strip()]
        self._whitelist = set(domains[:self.limit])

    def is_whitelisted(self, domain: str) -> bool:
        """
        Returns True if the domain (or its registered base domain) is whitelisted.
        """
        if not self._loaded:
            self.load_whitelist()

        domain = domain.lower().strip()
        if domain.startswith("www."):
            domain = domain[4:]

        # Check full domain first
        if domain in self._whitelist:
            return True

        # Check base registered domain
        base_domain = get_registered_domain(domain)
        if base_domain in self._whitelist:
            return True

        return False


# Global singleton instance for service-wide usage
whitelist_service = DomainWhitelist()
