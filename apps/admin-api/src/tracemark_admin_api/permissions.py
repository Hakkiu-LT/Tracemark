"""Permission catalog + role presets + effective-permission resolution.

This module is the SINGLE SOURCE OF TRUTH for what staff can do. The frontend mirror
lives in apps/admin/src/lib/permissions.ts — keep the two in sync.

Effective permissions for a staff member =
    ROLE_PRESETS[role]  (a template)
    then apply each staff_permissions row as an override (granted -> add / remove)
    unless is_super_admin, which grants the entire catalog.
"""
from __future__ import annotations

# --- Catalog: every permission the system understands -------------------------------
# Namespaced as "<resource>.<action>".
PERMISSIONS: dict[str, str] = {
    "customers.view": "View customer list and detail",
    "customers.create": "Create a new customer dashboard login",
    "customers.edit": "Edit customer profile / workspace type",
    "customers.delete": "Delete customers (destructive)",
    "customers.impersonate": "Log in as a customer (destructive)",
    "infringements.delete": "Delete a single copycat infringement (destructive)",
    "brands.view": "View all brands across every org",
    "brands.edit": "Edit any brand",
    "brands.delete": "Delete any brand",
    "resources.view": "System metrics (CPU/RAM) and API usage",
    "scraper_health.view": "Per-platform scraper health (success rate, latency, failures)",
    "integrations.manage": "Meta token exchange and integration keys",
    "staff.manage": "Create/edit staff and assign permissions",
    "audit.view": "Read the audit log",
    "notification_log.view": "View the notification delivery log (email/webhook dispatch attempts)",
    "leads.view": "View sales leads (Professional / Enterprise request-pricing forms)",
    "leads.edit": "Update lead status (mark contacted, close)",
    "leads.confirm": "Confirm a requested demo slot and email the customer",
    "leads.delete": "Delete sales leads (destructive)",
}

ALL_PERMISSIONS: frozenset[str] = frozenset(PERMISSIONS)

# --- Role presets: templates that seed a default set --------------------------------
# `admin` gets everything EXCEPT the two destructive customer actions, which are
# reserved for is_super_admin.
ROLE_PRESETS: dict[str, set[str]] = {
    "dev": {
        "resources.view",
        "scraper_health.view",
        "integrations.manage",
        "brands.view",
        "customers.view",
        "audit.view",
        "notification_log.view",
    },
    "sales": {
        "customers.view",
        "customers.create",
        "customers.edit",
        "brands.view",
        "leads.view",
        "leads.edit",
        "leads.confirm",
        "leads.delete",
    },
    "marketing": {
        "customers.view",
        "brands.view",
        "resources.view",
    },
    "admin": ALL_PERMISSIONS - {"customers.delete", "customers.impersonate"},
}


def resolve_effective_permissions(
    role: str,
    is_super_admin: bool,
    overrides: list[dict] | None = None,
) -> set[str]:
    """Compute the final permission set for a staff member.

    `overrides` is the list of staff_permissions rows: [{"permission": str,
    "granted": bool}, ...]. A granted=True row adds a permission; granted=False
    explicitly removes one the role would otherwise grant.
    """
    if is_super_admin:
        return set(ALL_PERMISSIONS)

    effective = set(ROLE_PRESETS.get(role, set()))
    for row in overrides or []:
        perm = row.get("permission")
        if perm not in ALL_PERMISSIONS:
            continue  # ignore stale/unknown permissions
        if row.get("granted", True):
            effective.add(perm)
        else:
            effective.discard(perm)
    return effective
