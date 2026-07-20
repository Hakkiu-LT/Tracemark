"""Audit logging for every mutating admin action.

Writes an append-only row to admin_audit_log (same Supabase project as everything else).

An audit-write failure must NEVER block the action it records (same defensive posture
as reconcile_brand_locks in the main billing route) — we swallow and print instead.
"""
from __future__ import annotations

from typing import Any

from tracemark_admin_api.clients import admin_sb
from tracemark_admin_api.dependencies import StaffPrincipal


def write_audit_log(
    staff: StaffPrincipal,
    action: str,
    *,
    target_type: str | None = None,
    target_id: str | None = None,
    target_org_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    ip: str | None = None,
) -> None:
    """Record an admin action. Best-effort: never raises."""
    try:
        admin_sb().table("admin_audit_log").insert(
            {
                "staff_id": staff.id,
                "staff_email": staff.email,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "target_org_id": target_org_id,
                "metadata": metadata,
                "ip": ip,
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001 - audit must not break the action
        print(f"[audit] failed to write admin_audit_log for {action}: {exc}")
