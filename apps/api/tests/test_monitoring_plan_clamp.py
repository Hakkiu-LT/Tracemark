"""Tests for `_clamp_scan_to_plan`.

A scan must only ever run in the marketplaces/regions the org's plan allows. The helper
reads the plan whitelists from org_entitlement_overrides and INTERSECTS them with whatever
the client asked to scan. NULL/empty whitelist = unrestricted; an empty intersection falls
back to the full allowed list (so we scan what's allowed rather than nothing)."""
from unittest.mock import MagicMock, patch

from tracemark_api.routes.monitoring import _clamp_scan_to_plan


def _mock_sb(allowed_platforms, allowed_regions):
    sb = MagicMock()
    (
        sb.table.return_value.select.return_value.eq.return_value
        .maybe_single.return_value.execute.return_value
    ).data = {
        "allowed_platforms": allowed_platforms,
        "allowed_regions": allowed_regions,
    }
    return sb


def test_clamp_filters_to_allowed_platforms_and_regions():
    sb = _mock_sb(allowed_platforms=["amazon"], allowed_regions=["US"])
    with patch("tracemark_api.routes.monitoring.get_supabase", return_value=sb):
        platforms, regions = _clamp_scan_to_plan(
            "org-1",
            platforms=["amazon", "ebay", "etsy"],
            target_regions=["US", "DE", "FR"],
        )
    assert platforms == ["amazon"]
    assert regions == ["US"]


def test_clamp_unrestricted_when_no_whitelist():
    sb = _mock_sb(allowed_platforms=None, allowed_regions=None)
    with patch("tracemark_api.routes.monitoring.get_supabase", return_value=sb):
        platforms, regions = _clamp_scan_to_plan(
            "org-1",
            platforms=["amazon", "ebay"],
            target_regions=["US", "DE"],
        )
    assert platforms == ["amazon", "ebay"]
    assert regions == ["US", "DE"]


def test_clamp_falls_back_to_allowed_when_intersection_empty():
    # Client asked only for disallowed values → fall back to the full allowed list,
    # so monitoring still runs (within plan) instead of scanning nothing.
    sb = _mock_sb(allowed_platforms=["amazon"], allowed_regions=["US"])
    with patch("tracemark_api.routes.monitoring.get_supabase", return_value=sb):
        platforms, regions = _clamp_scan_to_plan(
            "org-1",
            platforms=["ebay"],
            target_regions=["DE"],
        )
    assert platforms == ["amazon"]
    assert regions == ["US"]


def test_clamp_region_compare_is_case_insensitive():
    sb = _mock_sb(allowed_platforms=None, allowed_regions=["US", "CA"])
    with patch("tracemark_api.routes.monitoring.get_supabase", return_value=sb):
        _, regions = _clamp_scan_to_plan(
            "org-1", platforms=["amazon"], target_regions=["us", "ca", "de"]
        )
    assert regions == ["us", "ca"]


def test_clamp_noop_without_org():
    platforms, regions = _clamp_scan_to_plan(None, ["amazon"], ["US"])
    assert platforms == ["amazon"]
    assert regions == ["US"]
