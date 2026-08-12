# geo.py
# =======
# Configuration and helpers for geo-targeted scans.

# Mapping of country codes to Amazon domains/hosts
AMAZON_DOMAINS = {
    "US": "www.amazon.com",
    "GB": "www.amazon.co.uk",
    "DE": "www.amazon.de",
    "FR": "www.amazon.fr",
    "IT": "www.amazon.it",
    "ES": "www.amazon.es",
    "CA": "www.amazon.ca",
    "JP": "www.amazon.co.jp",
    "AU": "www.amazon.com.au",
    "BR": "www.amazon.com.br",
    "MX": "www.amazon.com.mx",
    "IN": "www.amazon.in",
    "SG": "www.amazon.sg",
}

# Mapping of country codes to eBay domains
EBAY_DOMAINS = {
    "US": "www.ebay.com",
    "GB": "www.ebay.co.uk",
    "DE": "www.ebay.de",
    "FR": "www.ebay.fr",
    "IT": "www.ebay.it",
    "ES": "www.ebay.es",
    "CA": "www.ebay.ca",
    "AU": "www.ebay.com.au",
    "NL": "www.ebay.nl",
    "IE": "www.ebay.ie",
    "AT": "www.ebay.at",
    "CH": "www.ebay.ch",
}

# Mapping of country codes to eBay Global IDs (for the LEGACY Finding API — retired 2025).
# Kept only for reference; the Browse API uses EBAY_MARKETPLACE_IDS below instead.
EBAY_GLOBAL_IDS = {
    "US": "EBAY-US",
    "GB": "EBAY-GB",
    "DE": "EBAY-DE",
    "FR": "EBAY-FR",
    "IT": "EBAY-IT",
    "ES": "EBAY-ES",
    "CA": "EBAY-ENCA",
    "AU": "EBAY-AU",
    "NL": "EBAY-NL",
}

# Mapping of country codes to eBay Browse API marketplace IDs, sent as the
# `X-EBAY-C-MARKETPLACE-ID` header. This drives which regional site is searched and,
# critically, the currency prices come back in (GBP for GB, EUR for DE/FR/IT/ES, ...).
# Values are eBay's MarketplaceIdEnum. Falls back to EBAY_US when a country is absent.
EBAY_MARKETPLACE_IDS = {
    "US": "EBAY_US",
    "GB": "EBAY_GB",
    "DE": "EBAY_DE",
    "FR": "EBAY_FR",
    "IT": "EBAY_IT",
    "ES": "EBAY_ES",
    "CA": "EBAY_CA",
    "AU": "EBAY_AU",
    "IE": "EBAY_IE",
    "AT": "EBAY_AT",
    "CH": "EBAY_CH",
    "NL": "EBAY_NL",
}

# Mapping of country codes to default language/locale code
COUNTRY_LANGUAGES = {
    "US": "en",
    "GB": "en",
    "CA": "en",
    "AU": "en",
    "DE": "de",
    "FR": "fr",
    "IT": "it",
    "ES": "es",
    "JP": "ja",
    "KR": "ko",
    "CN": "zh",
    "BR": "pt",
    "MX": "es",
    "IN": "en",
    "SG": "en",
    "NL": "nl",
    "SE": "sv",
    "AE": "ar",
    "ZA": "en",
    "AR": "es",
    "CO": "es",
    "CL": "es",
}

# Macro-region mappings (useful for resolving if a macro code is supplied)
MACRO_REGIONS = {
    "NA": ["US", "CA", "MX"],
    "EMEA": ["GB", "DE", "FR", "IT", "ES", "NL", "SE", "AE", "ZA"],
    "APAC": ["CN", "JP", "KR", "AU", "IN", "SG"],
    "LATAM": ["BR", "AR", "CO", "CL"],
}


def resolve_regions(regions: list[str] | None) -> list[str]:
    """
    Expands macro-region codes into individual country codes,
    maintains already-specified country codes, and removes duplicates.
    """
    if not regions:
        return ["US"]
    
    resolved = []
    for r in regions:
        r_upper = r.upper().strip()
        if r_upper in MACRO_REGIONS:
            resolved.extend(MACRO_REGIONS[r_upper])
        else:
            resolved.append(r_upper)
            
    # Deduplicate while preserving order roughly
    deduped = []
    for code in resolved:
        if code not in deduped:
            deduped.append(code)
            
    return deduped if deduped else ["US"]


def infer_country_from_url(url: str) -> str:
    """
    Reverse-lookup the URL's domain in geo maps (AMAZON_DOMAINS, EBAY_DOMAINS)
    to determine the 2-letter ISO country code. Falls back to ``"US"``.

    Examples:
        ``https://www.amazon.de/s?k=nike``   → ``"DE"``
        ``https://www.ebay.co.uk/sch/...``   → ``"GB"``
        ``https://www.example.com/``         → ``"US"``
    """
    import urllib.parse

    try:
        netloc = urllib.parse.urlparse(url).netloc.lower()
    except Exception:
        return "US"

    # Check all domain maps: value is "www.amazon.de" style
    for domain_map in (AMAZON_DOMAINS, EBAY_DOMAINS):
        for country_code, domain in domain_map.items():
            # Match exact netloc or netloc without "www."
            if netloc == domain or netloc == domain.lstrip("www."):
                return country_code

    return "US"


def firecrawl_location(country: str) -> dict:
    """
    Constructs the location payload for Firecrawl.
    """
    lang = COUNTRY_LANGUAGES.get(country.upper(), "en")
    # Return standard Firecrawl structure
    return {
        "country": country.upper(),
        "languages": [f"{lang}-{country.upper()}" if lang != "en" else "en-US"]
    }


COUNTRY_LOCATIONS = {
    "US": "United States",
    "GB": "United Kingdom",
    "CA": "Canada",
    "AU": "Australia",
    "DE": "Germany",
    "FR": "France",
    "IT": "Italy",
    "ES": "Spain",
    "JP": "Japan",
    "KR": "South Korea",
    "CN": "China",
    "BR": "Brazil",
    "MX": "Mexico",
    "IN": "India",
    "SG": "Singapore",
    "NL": "Netherlands",
    "SE": "Sweden",
    "AE": "United Arab Emirates",
    "ZA": "South Africa",
    "AR": "Argentina",
    "CO": "Colombia",
    "CL": "Chile",
}


def serpapi_geo_params(country: str) -> dict:
    """
    Constructs geoloc parameters for SerpApi / SearchCans.
    """
    c_upper = country.upper()
    return {
        "gl": c_upper.lower(),
        "hl": COUNTRY_LANGUAGES.get(c_upper, "en"),
        "location": COUNTRY_LOCATIONS.get(c_upper, "United States"),
    }
