import { createClient } from "@supabase/supabase-js";
import type {
  CheckBrandResponse,
  DecisionResponse,
  EvidenceResponse,
  RecommendedAction,
  RiskLevel,
  TakedownReport,
} from "./api.types";

const supabaseUrl =
  typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_URL : undefined;
const supabaseKey =
  typeof import.meta !== "undefined"
    ? import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY
    : undefined;

/**
 * Frontend Supabase client using the publishable (anon) key.
 *
 * Used for two things: (1) Supabase Auth — sign-in/sign-up, session persistence,
 * and reading the current user's profile; (2) READ-ONLY access to case history /
 * case detail. All case/decision/takedown writes still go through the FastAPI
 * backend, which uses the service-role key.
 */
const isValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
};

export const supabase =
  isValidUrl(supabaseUrl) && supabaseKey ? createClient(supabaseUrl!, supabaseKey) : null;

/** A row from the `profiles` table — extra user metadata beyond auth.users. */
export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  organization_id: string | null;
  plan: "free" | "starter" | "pro" | "firm" | "enterprise";
}

/**
 * Fetch the current user's profile row. Returns `null` if the client is
 * unconfigured or no row exists yet (e.g. the sign-up trigger hasn't run).
 */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, organization_id, plan")
    .eq("id", userId)
    .maybeSingle<Profile>();

  if (error || !data) return null;
  return data;
}

// --- Row shapes as returned by PostgREST (snake_case, joined arrays) ---

interface DecisionRow {
  risk_level: DecisionResponse["risk_level"];
  recommended_action: DecisionResponse["recommended_action"];
  case_summary: string;
  confidence_score: number;
  evidence_quality: DecisionResponse["evidence_quality"] | null;
  key_findings: string[] | null;
  created_at: string;
}

interface EvidenceRow {
  marketplaces: EvidenceResponse["marketplaces"] | null;
  ads: EvidenceResponse["ads"] | null;
  domains: EvidenceResponse["domains"] | null;
  social: EvidenceResponse["social"] | null;
  created_at: string;
}

interface TakedownRow {
  id: string;
  platform: string;
  platform_category: TakedownReport["platform_category"];
  infringing_url: string;
  submission_url: string | null;
  submission_method: TakedownReport["submission_method"];
  submission_email: string | null;
  notice_text: string;
  status: string;
}

interface CaseRow {
  id: string;
  brand_name: string;
  status: string;
  created_at: string;
  decisions: DecisionRow[] | null;
  evidence: EvidenceRow[] | null;
  takedown_reports: TakedownRow[] | null;
}

function mapDecision(row: DecisionRow): DecisionResponse {
  return {
    risk_level: row.risk_level,
    recommended_action: row.recommended_action,
    case_summary: row.case_summary,
    confidence_score: row.confidence_score,
    evidence_quality: row.evidence_quality ?? "MODERATE",
    key_findings: row.key_findings ?? [],
  };
}

function mapEvidence(row: EvidenceRow | undefined): EvidenceResponse {
  return {
    marketplaces: row?.marketplaces ?? [],
    ads: row?.ads ?? [],
    domains: row?.domains ?? [],
    social: row?.social ?? [],
    timestamp: row?.created_at ?? new Date().toISOString(),
  };
}

function mapTakedown(row: TakedownRow): TakedownReport {
  return {
    id: row.id,
    platform: row.platform,
    platform_category: row.platform_category,
    infringing_url: row.infringing_url,
    submission_url: row.submission_url,
    submission_method: row.submission_method,
    submission_email: row.submission_email,
    notice_text: row.notice_text,
    status: row.status,
  };
}

/** Lightweight row for the case list — one row per brand check. */
export interface CaseSummary {
  id: string;
  brand_name: string;
  status: string;
  created_at: string;
  risk_level: RiskLevel | null;
  recommended_action: RecommendedAction | null;
  confidence_score: number | null;
}

interface CaseListRow {
  id: string;
  brand_name: string;
  status: string;
  created_at: string;
  decisions:
    | {
        risk_level: RiskLevel;
        recommended_action: RecommendedAction;
        confidence_score: number;
      }[]
    | null;
}

/**
 * Fetch the most recent cases from Supabase for the case list view.
 * Returns `[]` if the client is unconfigured or the query fails.
 */
export async function fetchCaseHistory(
  limit = 50,
  persona = "brand_owner",
  activeClientId: string | null = null
): Promise<CaseSummary[]> {
  if (!supabase) return [];

  let query = supabase
    .from("cases")
    .select("id, brand_name, status, created_at, decisions(risk_level, recommended_action, confidence_score)");

  if (persona === "law_firm") {
    if (activeClientId) {
      query = query.eq("client_id", activeClientId);
    } else {
      query = query.not("client_id", "is", null);
    }
  } else {
    query = query.is("client_id", null);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<CaseListRow[]>();

  if (error || !data) return [];

  return data.map((row) => {
    const decision = row.decisions?.[0];
    return {
      id: row.id,
      brand_name: row.brand_name,
      status: row.status,
      created_at: row.created_at,
      risk_level: decision?.risk_level ?? null,
      recommended_action: decision?.recommended_action ?? null,
      confidence_score: decision?.confidence_score ?? null,
    };
  });
}

/**
 * Fetch a single case from Supabase by id and map it to the same
 * `CheckBrandResponse` shape the case-detail UI already renders.
 *
 * Returns `null` if the client is unconfigured, the case is missing, or it has
 * no decision yet (still pending/analyzing).
 */
export async function fetchCaseFromSupabase(
  caseId: string
): Promise<CheckBrandResponse | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("cases")
    .select("id, brand_name, status, created_at, detection_region, decisions(*), evidence(*), takedown_reports(*)")
    .eq("id", caseId)
    .maybeSingle<CaseRow & { detection_region: string | null }>();

  if (error || !data) return null;

  const decisionRow = data.decisions?.[0];
  if (!decisionRow) return null;

  return {
    case_id: data.id,
    decision: mapDecision(decisionRow),
    evidence: mapEvidence(data.evidence?.[0]),
    takedown_reports: (data.takedown_reports ?? []).map(mapTakedown),
    detection_region: data.detection_region || null,
  };
}

/**
 * Delete a case and its related records from Supabase by id, including associated screenshots.
 */
export async function deleteCaseFromSupabase(caseId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    // 1. Fetch all evidence rows for the case
    const { data: evidenceRows } = await supabase
      .from("evidence")
      .select("marketplaces, ads, domains, social")
      .eq("case_id", caseId);

    // 2. Fetch all infringements for the case
    const { data: infringementRows } = await supabase
      .from("infringements")
      .select("screenshot_url")
      .eq("case_id", caseId);

    // 3. Extract all screenshot URLs
    const urlsToClean = new Set<string>();

    if (evidenceRows) {
      evidenceRows.forEach((row) => {
        const categories = [row.marketplaces, row.ads, row.domains, row.social];
        categories.forEach((cat) => {
          if (Array.isArray(cat)) {
            cat.forEach((item: any) => {
              if (item?.screenshot_url) {
                urlsToClean.add(item.screenshot_url);
              }
            });
          }
        });
      });
    }

    if (infringementRows) {
      infringementRows.forEach((row) => {
        if (row.screenshot_url) {
          urlsToClean.add(row.screenshot_url);
        }
      });
    }

    // 4. Parse relative paths (relative to evidence-screenshots bucket)
    const pathsToDelete: string[] = [];
    urlsToClean.forEach((url) => {
      const marker = "/evidence-screenshots/";
      const idx = url.indexOf(marker);
      if (idx !== -1) {
        const path = url.slice(idx + marker.length);
        if (path) {
          pathsToDelete.push(path);
        }
      }
    });

    // 5. Delete files from storage
    if (pathsToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("evidence-screenshots")
        .remove(pathsToDelete);
      if (storageError) {
        console.error("[Storage Cleanup] Failed to delete screenshots from storage:", storageError);
      }
    }
  } catch (cleanupErr) {
    console.error("[Storage Cleanup] Error gathering or deleting case screenshots:", cleanupErr);
  }

  // 6. Delete infringements associated with the case
  await supabase.from("infringements").delete().eq("case_id", caseId);

  // 7. Delete case itself (cascades database-wise to evidence, decisions, takedowns)
  const { error } = await supabase.from("cases").delete().eq("id", caseId);
  return !error;
}

