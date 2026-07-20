"""Supabase client for the admin backend.

Staff and customers live in the SAME Supabase project (staff are distinguished by a
row in staff_accounts, not by a separate project). We use the service-role key, which
bypasses RLS — required both to read staff tables and to read/write any customer's data
across all organizations.

`admin_sb()` and `customer_sb()` are kept as separate names for readability at call
sites (staff-table access vs customer-data access), but they return the same client.
"""
from __future__ import annotations

import os

from supabase import Client, create_client

_client: Client | None = None


def _get() -> Client:
    global _client
    if _client is None:
        _client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _client


def admin_sb() -> Client:
    """Client used for staff auth + staff_accounts / staff_permissions / audit."""
    return _get()


def customer_sb() -> Client:
    """Client used for customer data (profiles, brands, subscriptions, ...)."""
    return _get()
