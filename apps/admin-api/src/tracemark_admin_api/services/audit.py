"""Audit logging for every mutating admin action.

Writes an append-only row to admin_audit_log (same Supabase project as everything else).

Two modes:
  * default (``critical=False``) — best-effort: a write failure is logged at ERROR
    level (so a SOC/alerting pipeline can see it) but does NOT block the action.
  * ``critical=True`` — the action is high-sensitivity (impersonation, account
    deletion, staff/permission changes). Here the caller must invoke this BEFORE
    performing the mutation; on failure we RAISE so the mutation never happens
    without an audit record (fail-closed / non-repudiation).

DB-level append-only enforcement (REVOKE UPDATE/DELETE + trigger) lives in the
migration 20260731000001_admin_audit_log_append_only.sql — this module only writes.
"""
from __future__ import annotations

import logging
from typing import Any

from tracemark_admin_api.clients import admin_sb
from tracemark_admin_api.dependencies import StaffPrincipal

logger = logging.getLogger("tracemark_admin_api.audit")


def write_audit_log(
    staff: StaffPrincipal,
    action: str,
    *,
    target_type: str | None = None,
    target_id: str | None = None,
    target_org_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    ip: str | None = None,
    critical: bool = False,
) -> None:
    """Record an admin action.

    Best-effort by default. When ``critical=True`` the write is fail-closed:
    the exception propagates so the caller can abort the mutation (call this
    BEFORE mutating for true non-repudiation).
    """
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
    except Exception as exc:  # noqa: BLE001
        logger.error("failed to write admin_audit_log for %s: %s", action, exc)
        if critical:
            # Non-repudiation: refuse to let a sensitive action proceed unaudited.
            raise
