import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const _SAFE_URL_RE = /^https?:\/\//i;
const _DANGEROUS_SCHEMES = /^(javascript|data|vbscript|file|blob):/i;

export function ensureAbsoluteUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (_DANGEROUS_SCHEMES.test(trimmed)) return "";
  if (_SAFE_URL_RE.test(trimmed)) return trimmed;
  const withScheme = `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (!_SAFE_URL_RE.test(parsed.href)) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

export const ACTION_LABELS: Record<string, string> = {
  "billing.cancel": "Subscription cancelled",
  "billing.plan_change": "Plan changed",
  "billing.resume": "Subscription resumed",
  "brands.asset_add": "Brand photo uploaded",
  "brands.asset_delete": "Brand photo removed",
  "brands.delete": "Brand deleted",
  "brands.edit": "Brand edited",
  "cases.bulk_edit": "Bulk-updated cases",
  "cases.delete": "Case deleted",
  "cases.edit": "Case edited",
  "customers.delete": "Customer deleted",
  "customers.edit": "Customer edited",
  "customers.impersonate": "Customer impersonated",
  "decisions.edit": "AI decision edited",
  "documents.send_email": "Document emailed",
  "evidence.edit": "Evidence edited",
  "infringements.edit": "Infringement edited",
  "integrations.meta_token_exchange": "Meta token exchanged",
  "organizations.add_member": "Member added",
  "organizations.edit": "Company edited",
  "organizations.remove_member": "Member removed",
  "organizations.update_member": "Member role updated",
  "staff.create": "Staff created",
  "staff.delete": "Staff deleted",
  "staff.set_permissions": "Permissions changed",
  "staff.update": "Staff updated",
  "takedowns.edit": "Takedown edited",
  "takedowns.send_email": "Takedown emailed",
};
