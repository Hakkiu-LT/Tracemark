"""Thin client for the MAIN Tracemark API's internal service-to-service endpoints.

Authenticates with the shared secret (X-Internal-Secret). The admin-api checks staff
permissions BEFORE calling here; this module only carries the request.
"""
from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import HTTPException


def _base_url() -> str:
    # e.g. https://api.tracemark.ai/api/v1  (no trailing slash)
    return os.environ.get("MAIN_API_URL", "http://localhost:8000/api/v1").rstrip("/")


def _headers() -> dict[str, str]:
    secret = os.environ.get("INTERNAL_API_SECRET", "")
    return {"X-Internal-Secret": secret, "Content-Type": "application/json"}


def _request(method: str, path: str, *, json: dict | None = None) -> Any:
    url = f"{_base_url()}{path}"
    try:
        resp = httpx.request(method, url, headers=_headers(), json=json, timeout=30.0)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Main API unreachable: {exc}")
    if resp.status_code >= 400:
        detail = resp.text
        try:
            detail = resp.json().get("detail", detail)
        except Exception:  # noqa: BLE001
            pass
        raise HTTPException(status_code=resp.status_code, detail=f"Main API error: {detail}")
    return resp.json()


def get_resource_metrics() -> Any:
    return _request("GET", "/internal/resources/metrics")


def get_resource_status() -> Any:
    return _request("GET", "/internal/resources/status")


def get_usage_stats() -> Any:
    return _request("GET", "/internal/usage-stats")


def send_takedown_email(takedown_id: str) -> Any:
    return _request("POST", f"/internal/takedowns/{takedown_id}/send-email")


def send_document_email(document_id: str) -> Any:
    return _request("POST", f"/internal/documents/{document_id}/send-email")


# ── Brand assets (photos) ─────────────────────────────────────────────────────
def list_brand_assets(brand_id: str) -> Any:
    return _request("GET", f"/internal/brands/{brand_id}/assets")


def upload_brand_asset(brand_id: str, asset_type: str, filename: str, content_type: str, data: bytes) -> Any:
    url = f"{_base_url()}/internal/brands/{brand_id}/assets"
    try:
        resp = httpx.post(
            url,
            headers={"X-Internal-Secret": os.environ.get("INTERNAL_API_SECRET", "")},
            data={"asset_type": asset_type},
            files={"file": (filename, data, content_type)},
            timeout=60.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Main API unreachable: {exc}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=f"Main API error: {resp.text}")
    return resp.json()


def delete_brand_asset(brand_id: str, asset_id: str) -> Any:
    return _request("DELETE", f"/internal/brands/{brand_id}/assets/{asset_id}")
