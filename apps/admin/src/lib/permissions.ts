// Mirror of apps/admin-api/.../permissions.py. Keep the two in sync.
// The frontend uses these only to show/hide nav + buttons; the backend re-checks
// every action, so this is UX, never security.

export const PERMISSIONS = {
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
  "notification_log.delete": "Delete rows from the notification delivery log (destructive)",
  "leads.view": "View sales leads (Professional / Enterprise request-pricing forms)",
  "leads.edit": "Update lead status (mark contacted, close)",
  "leads.confirm": "Confirm a requested demo slot and email the customer",
  "leads.delete": "Delete sales leads (destructive)",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export type Role = "dev" | "sales" | "marketing" | "admin";

export const ROLE_PRESETS: Record<Role, Permission[]> = {
  dev: ["resources.view", "scraper_health.view", "integrations.manage", "brands.view", "customers.view", "audit.view", "notification_log.view"],
  sales: ["customers.view", "customers.create", "customers.edit", "brands.view", "leads.view", "leads.edit", "leads.confirm", "leads.delete"],
  marketing: ["customers.view", "brands.view", "resources.view"],
  admin: ALL_PERMISSIONS.filter(
    (p) => p !== "customers.delete" && p !== "customers.impersonate",
  ),
};

export function hasPermission(perms: Set<string>, key: Permission): boolean {
  return perms.has(key);
}
