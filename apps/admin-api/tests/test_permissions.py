"""Tests for staff permission resolution — the core of admin-portal authorization.

Covers role presets, granular overrides (add/remove), super-admin, stale-permission
handling, and the M1 privilege-consolidation invariant (only the `admin` preset
carries `staff.manage`).
"""
from tracemark_admin_api.permissions import (
    ALL_PERMISSIONS,
    ROLE_PRESETS,
    resolve_effective_permissions,
)


def test_super_admin_gets_everything():
    perms = resolve_effective_permissions("sales", is_super_admin=True)
    assert perms == set(ALL_PERMISSIONS)


def test_super_admin_ignores_negative_overrides():
    # A super-admin can't be stripped of permissions via overrides.
    perms = resolve_effective_permissions(
        "admin", is_super_admin=True,
        overrides=[{"permission": "customers.view", "granted": False}],
    )
    assert perms == set(ALL_PERMISSIONS)


def test_role_preset_is_the_baseline():
    perms = resolve_effective_permissions("sales", is_super_admin=False)
    assert perms == set(ROLE_PRESETS["sales"])


def test_override_grants_extra_permission():
    perms = resolve_effective_permissions(
        "marketing", is_super_admin=False,
        overrides=[{"permission": "leads.view", "granted": True}],
    )
    assert "leads.view" in perms
    assert set(ROLE_PRESETS["marketing"]).issubset(perms)


def test_override_revokes_preset_permission():
    assert "customers.view" in ROLE_PRESETS["marketing"]
    perms = resolve_effective_permissions(
        "marketing", is_super_admin=False,
        overrides=[{"permission": "customers.view", "granted": False}],
    )
    assert "customers.view" not in perms


def test_stale_unknown_permission_is_ignored():
    perms = resolve_effective_permissions(
        "sales", is_super_admin=False,
        overrides=[{"permission": "totally.bogus.permission", "granted": True}],
    )
    assert "totally.bogus.permission" not in perms
    assert perms == set(ROLE_PRESETS["sales"])


def test_unknown_role_yields_empty_baseline():
    perms = resolve_effective_permissions("nonexistent", is_super_admin=False)
    assert perms == set()


def test_only_admin_preset_carries_staff_manage():
    # M1 invariant: staff.manage (which enables account self-replication) must live
    # ONLY in the admin preset, so create_staff can gate it behind super-admin.
    carriers = {r for r, p in ROLE_PRESETS.items() if "staff.manage" in p}
    assert carriers == {"admin"}


def test_admin_preset_excludes_destructive_customer_perms():
    # The admin preset deliberately omits customer delete/impersonate.
    assert "customers.delete" not in ROLE_PRESETS["admin"]
    assert "customers.impersonate" not in ROLE_PRESETS["admin"]
