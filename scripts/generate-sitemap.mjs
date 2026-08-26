#!/usr/bin/env node
// Auto-generates public/sitemap.xml from the actual route files in src/routes/.
//
// WHY: the sitemap used to be hand-written, so every new marketing page meant a
// manual edit — and it silently drifted out of sync with the real routes. This
// script scans src/routes/ on every build, so a new public page is picked up
// automatically and removed pages disappear on their own.
//
// WHAT GOES IN: only public, indexable marketing pages. Private app routes
// (dashboard/cases/monitoring/clients/settings), auth flows, legacy redirects,
// dynamic ($param) routes and the request-demo redirect are excluded — plus a
// few low-value legal pages we deliberately keep out (see EXCLUDE_EXACT). Those
// excluded legal pages also carry <meta name="robots" content="noindex"> in
// their route files, which is what actually keeps them out of search results
// (a sitemap only advertises URLs; it can't hide a page that is linked to).
//
// Run: `node scripts/generate-sitemap.mjs` (wired into `npm run build` via prebuild).

import { readdirSync, statSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROUTES_DIR = join(ROOT, "src", "routes");
const OUT_FILE = join(ROOT, "public", "sitemap.xml");
const BASE_URL = "https://hakkiu.com";

// Route path prefixes that are private / never indexable → never in the sitemap.
const EXCLUDE_PREFIXES = [
  "/dashboard",
  "/cases",
  "/monitoring",
  "/clients",
  "/settings",
  "/auth",
  "/legacy",
];

// Specific public paths we deliberately keep OUT of the sitemap:
//  - /request-demo is a redirect, not a real page.
//  - the four legal pages are low-value boilerplate that also carry a `noindex`
//    meta in their route files, so they should not be advertised here either.
const EXCLUDE_EXACT = new Set([
  "/request-demo",
  "/legal/acceptable-use",
  "/legal/dpa",
  "/legal/subprocessors",
  "/legal/imprint",
]);

// Per-path SEO hints. Any included path not listed here uses DEFAULT_META.
const META = {
  "/": { changefreq: "weekly", priority: "1.0" },
  "/about": { changefreq: "monthly", priority: "0.6" },
  "/contact": { changefreq: "monthly", priority: "0.6" },
  "/solutions/brand-owners": { changefreq: "monthly", priority: "0.8" },
  "/solutions/law-firms": { changefreq: "monthly", priority: "0.8" },
  "/legal/privacy": { changefreq: "yearly", priority: "0.4" },
  "/legal/terms": { changefreq: "yearly", priority: "0.4" },
  "/legal/cookies": { changefreq: "yearly", priority: "0.3" },
  "/legal/security": { changefreq: "monthly", priority: "0.4" },
};
const DEFAULT_META = { changefreq: "monthly", priority: "0.5" };

// Convert a TanStack flat-route filename (e.g. "legal.privacy.tsx") to a URL
// path ("/legal/privacy"). Returns null for files that are not real pages.
function fileToPath(fileName) {
  if (!fileName.endsWith(".tsx")) return null;
  const base = fileName.slice(0, -4); // strip ".tsx"
  if (base.startsWith("__")) return null; // __root
  if (base.includes("$")) return null; // dynamic param route (e.g. cases.$caseId)
  if (base === "index") return "/";
  return "/" + base.split(".").join("/"); // "solutions.brand-owners" -> "/solutions/brand-owners"
}

function isExcluded(path) {
  if (EXCLUDE_EXACT.has(path)) return true;
  return EXCLUDE_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

// Last content change of a route file, from git (YYYY-MM-DD). Falls back to
// today for uncommitted/new files or when git is unavailable.
function lastModified(fileName) {
  try {
    const out = execSync(`git log -1 --format=%cs -- "src/routes/${fileName}"`, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) return out;
  } catch {
    // git not available — fall through
  }
  return new Date().toISOString().slice(0, 10);
}

const entries = [];
for (const name of readdirSync(ROUTES_DIR)) {
  if (statSync(join(ROUTES_DIR, name)).isDirectory()) continue; // e.g. legacy/
  const path = fileToPath(name);
  if (!path || isExcluded(path)) continue;
  const meta = META[path] ?? DEFAULT_META;
  entries.push({ path, lastmod: lastModified(name), ...meta });
}

// Stable, human-friendly ordering: home first, then by descending priority,
// then alphabetically — so diffs stay small when routes are added.
entries.sort((a, b) => {
  if (a.path === "/") return -1;
  if (b.path === "/") return 1;
  if (b.priority !== a.priority) return Number(b.priority) - Number(a.priority);
  return a.path.localeCompare(b.path);
});

const body = entries
  .map(
    (e) =>
      `  <url>\n` +
      `    <loc>${BASE_URL}${e.path === "/" ? "/" : e.path}</loc>\n` +
      `    <lastmod>${e.lastmod}</lastmod>\n` +
      `    <changefreq>${e.changefreq}</changefreq>\n` +
      `    <priority>${e.priority}</priority>\n` +
      `  </url>`,
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

writeFileSync(OUT_FILE, xml, "utf8");
console.log(`✓ sitemap.xml written with ${entries.length} URLs → ${OUT_FILE}`);
