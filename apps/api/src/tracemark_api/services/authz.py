"""Shared authorization helpers for enforcing tenant (org/user) isolation
at the application layer.

Why this exists: the backend talks to Supabase with the *service-role* key
(see ``services.database.get_supabase``), which **bypasses Row-Level Security**.
That means Postgres does NOT isolate one tenant's rows from another for us — the
only thing standing between user A and user B's data is whether each route
explicitly scopes its queries to the caller's organization (or to the caller's
``user_id`` when they belong to no organization).

Every helper here takes an already-constructed Supabase client ``sb`` as its
first argument, rather than calling ``get_supabase()`` itself. This keeps the
caller in control of which client is used and — importantly — means unit tests
that patch a route module's ``get_supabase`` continue to exercise these helpers
against the same mock.

Ownership checks are expressed as **database filters** (chained ``.eq(...)``)
rather than Python-side comparisons, so isolation is enforced by Postgres and
the check degrades safely (returns "no access") if a row is missing.
"""
from __future__ import annotations


def get_user_org_id(sb, user_id: str) -> str | None:
    """Return the caller's ``organization_id`` from ``profiles``, or ``None``.

    ``None`` means the user has no organization; callers should then scope by
    ``user_id`` instead.
    """
    try:
        res = (
            sb.table("profiles")
            .select("organization_id")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        return res.data.get("organization_id") if res.data else None
    except Exception:
        return None


def user_can_access_case(sb, user_id: str, case_id: str | None) -> bool:
    """True when ``case_id`` belongs to the caller's org (or to the caller
    directly when they have no org).

    Implemented as a scoped SELECT so the isolation is enforced by the database
    filter, not by comparing values in Python.
    """
    if not case_id:
        return False
    org_id = get_user_org_id(sb, user_id)
    try:
        q = sb.table("cases").select("id").eq("id", case_id)
        if org_id:
            q = q.eq("organization_id", org_id)
        else:
            q = q.eq("user_id", user_id)
        res = q.limit(1).execute()
        return bool(res.data)
    except Exception:
        return False


def user_can_access_infringement(sb, user_id: str, infringement_id: str | None) -> bool:
    """True when the infringement's parent case belongs to the caller.

    Uses a single scoped SELECT with an inner join on ``cases`` (the same embed
    ``list_infringements`` relies on), so isolation is a database filter.
    """
    if not infringement_id:
        return False
    org_id = get_user_org_id(sb, user_id)
    try:
        q = (
            sb.table("infringements")
            .select("id, cases!inner(organization_id, user_id)")
            .eq("id", infringement_id)
        )
        if org_id:
            q = q.eq("cases.organization_id", org_id)
        else:
            q = q.eq("cases.user_id", user_id)
        res = q.limit(1).execute()
        return bool(res.data)
    except Exception:
        return False
