import pytest
from tracemark_api.services.geo import (
    resolve_regions,
    firecrawl_location,
    serpapi_geo_params,
    AMAZON_DOMAINS,
    EBAY_DOMAINS,
)


def test_resolve_regions_default():
    assert resolve_regions(None) == ["US"]
    assert resolve_regions([]) == ["US"]


def test_resolve_regions_macro():
    res = resolve_regions(["NA"])
    assert "US" in res
    assert "CA" in res
    assert "MX" in res
    assert len(res) == 3


def test_resolve_regions_mixed_dedup():
    res = resolve_regions(["US", "NA"])
    assert res == ["US", "CA", "MX"]  # deduplicated, NA expands but US was already first


def test_firecrawl_location():
    loc = firecrawl_location("DE")
    assert loc == {
        "country": "DE",
        "languages": ["de-DE"]
    }
    
    loc_us = firecrawl_location("US")
    assert loc_us == {
        "country": "US",
        "languages": ["en-US"]
    }


def test_serpapi_geo_params():
    params = serpapi_geo_params("DE")
    assert params == {
        "gl": "de",
        "hl": "de",
        "location": "Germany",
    }


def test_domains_mapping():
    assert AMAZON_DOMAINS["US"] == "www.amazon.com"
    assert AMAZON_DOMAINS["DE"] == "www.amazon.de"
    assert EBAY_DOMAINS["GB"] == "www.ebay.co.uk"
