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

# Mapping of country codes to eBay Global IDs (for API usage)
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


def serpapi_geo_params(country: str) -> dict:
    """
    Constructs geoloc parameters for SerpApi / SearchCans.
    """
    c_upper = country.upper()
    return {
        "gl": c_upper.lower(),
        "hl": COUNTRY_LANGUAGES.get(c_upper, "en")
    }
