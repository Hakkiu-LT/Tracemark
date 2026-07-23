"""Seed the first super-admin into the Supabase project.

Run ONCE, manually, after the staff migrations are applied. Because staff are never
self-registered, this bootstrap script is the only way to create the first account;
every subsequent staff member is created through the admin API by a super-admin.

Usage (from apps/admin-api/):
    SUPABASE_URL=... \
    SUPABASE_SERVICE_ROLE_KEY=... \
    SEED_ADMIN_EMAIL=you@company.com \
    SEED_ADMIN_PASSWORD='a-strong-password' \
    uv run python scripts/seed_super_admin.py
"""
from __future__ import annotations

import os
import sys

from dotenv import load_dotenv, find_dotenv
from supabase import create_client

load_dotenv(find_dotenv())


def main() -> int:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    email = os.environ.get("SEED_ADMIN_EMAIL")
    password = os.environ.get("SEED_ADMIN_PASSWORD")
    full_name = os.environ.get("SEED_ADMIN_NAME", "Super Admin")

    missing = [
        name
        for name, val in [
            ("SUPABASE_URL", url),
            ("SUPABASE_SERVICE_ROLE_KEY", key),
            ("SEED_ADMIN_EMAIL", email),
            ("SEED_ADMIN_PASSWORD", password),
        ]
        if not val
    ]
    if missing:
        print(f"Missing required env vars: {', '.join(missing)}")
        return 1

    sb = create_client(url, key)

    # 1. Create (or find) the auth user.
    try:
        created = sb.auth.admin.create_user(
            {"email": email, "password": password, "email_confirm": True}
        )
        user_id = created.user.id
        print(f"Created auth user {email} -> {user_id}")
    except Exception as exc:  # noqa: BLE001 - most likely already exists
        print(f"create_user failed ({exc}); trying to find existing user by email...")
        user_id = None
        for u in sb.auth.admin.list_users():
            if (u.email or "").lower() == email.lower():
                user_id = u.id
                break
        if not user_id:
            print("Could not create or find the auth user. Aborting.")
            return 1
        print(f"Found existing auth user {email} -> {user_id}")

    # 2. Upsert the staff_accounts row as a super-admin.
    sb.table("staff_accounts").upsert(
        {
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "role": "admin",
            "is_super_admin": True,
            "is_active": True,
        }
    ).execute()
    print(f"Seeded super-admin staff account for {email}. Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
