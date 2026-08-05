"""Shared helpers for reading Supabase Auth users (auth.users) from the admin backend.

Centralises the auth-admin access that used to be copy-pasted (and, in organizations.py,
BUGGY — unpaginated) across routes. Two access shapes:

* ``email_map`` / ``list_all_auth_users`` — page through ALL users. Use only where a whole
  map is genuinely needed (e.g. the customer LIST page).
* ``emails_for_ids`` — resolve emails for a KNOWN, small set of ids via targeted
  ``get_user_by_id``. Use on detail pages so we don't list every user just to render a
  handful of members.
"""
from __future__ import annotations

_PER_PAGE = 1000


def list_all_auth_users(sb) -> list:
    """Return every auth user, paging until a short page (never truncates at 50/1000)."""
    out: list = []
    page = 1
    while True:
        batch = sb.auth.admin.list_users(page=page, per_page=_PER_PAGE)
        if not batch:
            break
        out.extend(batch)
        if len(batch) < _PER_PAGE:
            break
        page += 1
    return out


def email_map(sb) -> dict[str, str]:
    """id -> email for ALL users. Paginated (fixes the old page-1-only bug)."""
    return {u.id: (u.email or "") for u in list_all_auth_users(sb)}


def emails_for_ids(sb, ids) -> dict[str, str]:
    """id -> email for a specific small set of ids, via targeted get_user_by_id.

    Cheaper than listing every user when we only need a few members' emails.
    """
    out: dict[str, str] = {}
    for uid in {i for i in ids if i}:
        try:
            resp = sb.auth.admin.get_user_by_id(uid)
            user = getattr(resp, "user", None) or resp
            out[uid] = getattr(user, "email", "") or ""
        except Exception:  # noqa: BLE001 — a missing/invalid id shouldn't break the page
            out[uid] = ""
    return out


def users_for_ids(sb, ids) -> dict[str, dict]:
    """id -> {email, last_sign_in_at} for a specific small set of ids (targeted lookups).

    last_sign_in_at is None for a login that has never been used — the admin UI shows a
    "never signed in" badge so staff can tell an invited-but-not-activated account apart
    from an active one.
    """
    out: dict[str, dict] = {}
    for uid in {i for i in ids if i}:
        try:
            resp = sb.auth.admin.get_user_by_id(uid)
            user = getattr(resp, "user", None) or resp
            # last_sign_in_at comes back as a datetime (or None). Member types it as str|None,
            # so coerce to an ISO string here — a raw datetime would fail response validation.
            lsi = getattr(user, "last_sign_in_at", None)
            out[uid] = {
                "email": getattr(user, "email", "") or "",
                "last_sign_in_at": lsi.isoformat() if hasattr(lsi, "isoformat") else (str(lsi) if lsi else None),
            }
        except Exception:  # noqa: BLE001
            out[uid] = {"email": "", "last_sign_in_at": None}
    return out


def get_email(sb, user_id: str) -> str | None:
    """Single user's email, or None if not found."""
    try:
        resp = sb.auth.admin.get_user_by_id(user_id)
        user = getattr(resp, "user", None) or resp
        return getattr(user, "email", None)
    except Exception:  # noqa: BLE001
        return None


def find_auth_user_by_email(sb, email: str):
    """Return the auth user whose email matches (case-insensitive), or None. Paginated."""
    target = email.strip().lower()
    for u in list_all_auth_users(sb):
        if (u.email or "").strip().lower() == target:
            return u
    return None


def is_orphan_auth_user(sb, user_id: str) -> bool:
    """True when an auth user has NO profile row and NO org memberships.

    Such a login is invisible in the admin UI yet still occupies its email in auth.users,
    blocking re-creation with a confusing "already registered" error. Safe to hard-delete.
    """
    prof = sb.table("profiles").select("id").eq("id", user_id).maybe_single().execute()
    if prof and prof.data:
        return False
    members = (
        sb.table("organization_members").select("user_id").eq("user_id", user_id).limit(1).execute()
    )
    return not (members.data or [])
