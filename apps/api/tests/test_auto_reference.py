"""
Tests for ensure_official_site_reference — the auto-fetch logic that
fetches the brand's official website(s), embeds the text, and caches it
as a brand_assets row for Tier 1 text similarity.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest


def _make_supabase_mock(brand_row=None, existing_assets=None, inserted_row=None):
    """Build a mock supabase client that returns the given brand row and assets."""
    sb = MagicMock()

    brands_chain = MagicMock()
    brands_chain.select.return_value = brands_chain
    brands_chain.eq.return_value = brands_chain
    brands_chain.maybe_single.return_value = brands_chain
    brands_chain.execute.return_value = MagicMock(data=brand_row)
    brands_chain.insert.return_value = brands_chain
    brands_chain.delete.return_value = brands_chain

    assets_chain = MagicMock()
    assets_chain.select.return_value = assets_chain
    assets_chain.eq.return_value = assets_chain
    assets_chain.execute.return_value = MagicMock(data=existing_assets or [])
    assets_chain.insert.return_value = assets_chain
    assets_chain.delete.return_value = assets_chain
    if inserted_row is not None:
        assets_chain.execute.return_value = MagicMock(data=[inserted_row])

    def table_side_effect(name):
        if name == "brands":
            return brands_chain
        if name == "brand_assets":
            return assets_chain
        return MagicMock()

    sb.table.side_effect = table_side_effect
    return sb


def test_no_brand_record_returns_none():
    from tracemark_api.services.embedding_helper import ensure_official_site_reference

    sb = _make_supabase_mock(brand_row=None)
    with patch("tracemark_api.services.database.get_supabase", return_value=sb):
        result = ensure_official_site_reference("fake-uuid")
    assert result is None


def test_brand_without_website_or_official_domains_returns_none():
    from tracemark_api.services.embedding_helper import ensure_official_site_reference

    sb = _make_supabase_mock(brand_row={"id": "b1", "website": None, "official_domains": []})
    with patch("tracemark_api.services.database.get_supabase", return_value=sb):
        result = ensure_official_site_reference("b1")
    assert result is None


def test_fresh_cache_returns_existing_embedding():
    from tracemark_api.services.embedding_helper import ensure_official_site_reference

    fresh_ts = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    existing_embedding = [0.1] * 768
    sb = _make_supabase_mock(
        brand_row={"id": "b1", "website": "derila.com", "official_domains": []},
        existing_assets=[{
            "id": "asset-1",
            "asset_type": "reference_content",
            "embedding": str(existing_embedding),
            "metadata": {"auto_generated": True, "last_fetched": fresh_ts},
        }],
    )
    with patch("tracemark_api.services.database.get_supabase", return_value=sb):
        result = ensure_official_site_reference("b1")
    assert result == existing_embedding


def test_stale_cache_triggers_refetch(monkeypatch):
    from tracemark_api.services import embedding_helper

    stale_ts = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    sb = _make_supabase_mock(
        brand_row={"id": "b1", "website": "derila.com", "official_domains": []},
        existing_assets=[{
            "id": "old-asset",
            "asset_type": "reference_content",
            "embedding": str([0.0] * 768),
            "metadata": {"auto_generated": True, "last_fetched": stale_ts},
        }],
    )
    monkeypatch.setattr("tracemark_api.services.database.get_supabase", lambda: sb)
    monkeypatch.setattr("tracemark_api.services.embedding_helper.embed_text", lambda _text: [0.5] * 768)
    monkeypatch.setattr("tracemark_api.services.embedding_helper._fetch_page_text", lambda _url: "Derila memory foam pillow")

    result = embedding_helper.ensure_official_site_reference("b1")
    assert result is not None
    assert len(result) == 768


def test_non_auto_ref_rows_are_ignored():
    from tracemark_api.services.embedding_helper import ensure_official_site_reference

    fresh_ts = datetime.now(timezone.utc).isoformat()
    sb = _make_supabase_mock(
        brand_row={"id": "b1", "website": "derila.com", "official_domains": []},
        existing_assets=[{
            "id": "user-uploaded",
            "asset_type": "reference_content",
            "embedding": str([0.1] * 768),
            "metadata": {"filename": "myfile.txt", "auto_generated": False},
        }],
    )
    with patch("tracemark_api.services.database.get_supabase", return_value=sb), \
         patch("tracemark_api.services.embedding_helper.embed_text", return_value=[0.9] * 768) as mock_embed, \
         patch("tracemark_api.services.embedding_helper._fetch_page_text", return_value="some text"):
        result = ensure_official_site_reference("b1")
    mock_embed.assert_called_once()
    assert result is not None
