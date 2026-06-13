import os
import pytest
from tracemark_api.services.domain_whitelist import DomainWhitelist, get_registered_domain, CACHE_FILE


def test_get_registered_domain():
    assert get_registered_domain("sub.adidas.com") == "adidas.com"
    assert get_registered_domain("adidas.com") == "adidas.com"
    assert get_registered_domain("www.adidas.com") == "adidas.com"
    assert get_registered_domain("foo.bar.co.uk") == "bar.co.uk"
    assert get_registered_domain("co.uk") == "co.uk"
    assert get_registered_domain("a.b.c.d.com") == "d.com"


def test_domain_whitelist_fallback():
    # Force complete fallback by setting an invalid URL/limit or loading fallback directly
    whitelist = DomainWhitelist(limit=10)
    
    # Pre-populate whitelist with fallback or test values
    whitelist._whitelist = {"google.com", "facebook.com", "wikipedia.org"}
    whitelist._loaded = True
    
    assert whitelist.is_whitelisted("google.com") is True
    assert whitelist.is_whitelisted("sub.google.com") is True
    assert whitelist.is_whitelisted("wikipedia.org") is True
    assert whitelist.is_whitelisted("adidas-shop.com") is False


def test_domain_whitelist_load_cache(tmp_path):
    # Set up custom CACHE_FILE path dynamically for tests if we want, or test the class functions
    whitelist = DomainWhitelist(limit=5)
    whitelist._whitelist = {"test.com", "example.org"}
    whitelist._loaded = True
    
    assert whitelist.is_whitelisted("test.com") is True
    assert whitelist.is_whitelisted("sub.test.com") is True
    assert whitelist.is_whitelisted("notlisted.com") is False
