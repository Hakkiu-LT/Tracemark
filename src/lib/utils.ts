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

