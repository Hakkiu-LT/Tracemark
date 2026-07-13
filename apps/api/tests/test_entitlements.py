"""Tests for plan entitlements: the math (base + add-ons) and the
downgrade/upgrade brand reconciliation."""

from unittest.mock import MagicMock, patch

from tracemark_api.services import entitlements as ent_mod
from tracemark_api.services.entitlements import (
    PLAN_ENTITLEMENTS,
    compute_entitlements,
    reconcile_brand_locks,
)


# ── compute_entitlements ──────────────────────────────────────────────────────


def test_base_plans_match_expected_brand_limits():
    assert PLAN_ENTITLEMENTS["free"].brands == 1
    assert PLAN_ENTITLEMENTS["starter"].brands == 1
    assert PLAN_ENTITLEMENTS["growth"].brands == 5
    assert PLAN_ENTITLEMENTS["pro"].brands == 20
    assert PLAN_ENTITLEMENTS["agency"].brands is None  # unlimited
    assert PLAN_ENTITLEMENTS["enterprise"].brands is None


def test_addon_brand_stacks_onto_base():
    e = compute_entitlements("starter", [{"addon_key": "addon_brand", "quantity": 2}])
    assert e.brands == 3


def test_addon_region_stacks_and_domains_reports_flip_flags():
    e = compute_entitlements(
        "growth",
        [
            {"addon_key": "addon_region", "quantity": 3},
            {"addon_key": "addon_domains", "quantity": 1},
            {"addon_key": "addon_reports", "quantity": 1},
        ],
    )
    assert e.regions == PLAN_ENTITLEMENTS["growth"].regions + 3
    assert e.domain_tracking is True
    assert e.advanced_reports is True


def test_unlimited_plan_ignores_addon_brand():
    e = compute_entitlements("agency", [{"addon_key": "addon_brand", "quantity": 5}])
    assert e.brands is None


def test_unknown_plan_falls_back_to_free():
    e = compute_entitlements("bogus", [])
    assert e.plan == "free"
    assert e.brands == 1


def test_managed_takedown_gating_by_plan():
    assert PLAN_ENTITLEMENTS["starter"].managed_takedown is False
    assert PLAN_ENTITLEMENTS["growth"].managed_takedown is False
    assert PLAN_ENTITLEMENTS["pro"].managed_takedown is True
    assert PLAN_ENTITLEMENTS["agency"].managed_takedown is True


# ── Entitlement helpers ───────────────────────────────────────────────────────


def test_limit_helpers():
    starter = PLAN_ENTITLEMENTS["starter"]
    assert starter.brand_limit_reached(1) is True
    assert starter.brand_limit_reached(0) is False
    assert starter.exceeds_platforms(4) is True
    assert starter.exceeds_platforms(3) is False
    assert PLAN_ENTITLEMENTS["agency"].brand_limit_reached(9999) is False  # unlimited


# ── reconcile_brand_locks ─────────────────────────────────────────────────────


def _mock_brands(rows):
    """Build a MagicMock get_supabase whose brands SELECT returns `rows` and
    whose UPDATE().in_() records the ids it was asked to change."""
    sb = MagicMock()
    recorded = {"locked": None, "unlocked": None, "status": []}

    select_exec = sb.table.return_value.select.return_value.eq.return_value.order.return_value.execute
    select_exec.return_value.data = rows

    def _update(payload):
        status = payload.get("status")
        recorded["status"].append(status)
        in_mock = MagicMock()

        def _in(_col, ids):
            if status == "locked":
                recorded["locked"] = list(ids)
            elif status == "active":
                recorded["unlocked"] = list(ids)
            return MagicMock()

        in_mock.in_.side_effect = _in
        return in_mock

    sb.table.return_value.update.side_effect = _update
    return sb, recorded


def _patch_ent(plan_ent):
    return patch.object(
        ent_mod, "resolve_entitlements_for_org", return_value=(plan_ent.plan, plan_ent)
    )


def test_reconcile_locks_oldest_excess_on_downgrade():
    # 3 active brands but starter allows 1 → lock the 2 oldest (b1, b2).
    rows = [
        {"id": "b1", "status": "active", "created_at": "2026-01-01"},
        {"id": "b2", "status": "active", "created_at": "2026-02-01"},
        {"id": "b3", "status": "active", "created_at": "2026-03-01"},
    ]
    sb, rec = _mock_brands(rows)
    with (
        _patch_ent(PLAN_ENTITLEMENTS["starter"]),
        patch.object(ent_mod, "get_supabase", return_value=sb),
    ):
        out = reconcile_brand_locks("org-1")
    assert set(out["locked"]) == {"b1", "b2"}
    assert rec["locked"] == out["locked"]


def test_reconcile_unlocks_newest_on_upgrade():
    # 1 active + 2 locked, pro allows 20 → both locked get unlocked (newest first).
    rows = [
        {"id": "b1", "status": "active", "created_at": "2026-01-01"},
        {"id": "b2", "status": "locked", "created_at": "2026-02-01"},
        {"id": "b3", "status": "locked", "created_at": "2026-03-01"},
    ]
    sb, rec = _mock_brands(rows)
    with (
        _patch_ent(PLAN_ENTITLEMENTS["pro"]),
        patch.object(ent_mod, "get_supabase", return_value=sb),
    ):
        out = reconcile_brand_locks("org-1")
    assert set(out["unlocked"]) == {"b2", "b3"}


def test_reconcile_unlimited_unlocks_everything():
    rows = [
        {"id": "b1", "status": "locked", "created_at": "2026-01-01"},
        {"id": "b2", "status": "active", "created_at": "2026-02-01"},
    ]
    sb, rec = _mock_brands(rows)
    with (
        _patch_ent(PLAN_ENTITLEMENTS["agency"]),
        patch.object(ent_mod, "get_supabase", return_value=sb),
    ):
        out = reconcile_brand_locks("org-1")
    assert out["unlocked"] == ["b1"]
    assert out["locked"] == []


def test_reconcile_noop_when_within_limit():
    rows = [
        {"id": "b1", "status": "active", "created_at": "2026-01-01"},
        {"id": "b2", "status": "active", "created_at": "2026-02-01"},
    ]
    sb, rec = _mock_brands(rows)
    with (
        _patch_ent(PLAN_ENTITLEMENTS["growth"]),
        patch.object(ent_mod, "get_supabase", return_value=sb),
    ):
        out = reconcile_brand_locks("org-1")
    assert out == {"locked": [], "unlocked": []}
