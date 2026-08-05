import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CheckBrandResponse } from "./api.types";
import type { BrandRecord } from "./api";
import { PLATFORMS } from "./platforms";

export type Persona = "brand_owner" | "law_firm";
export type RiskLevel = "high" | "medium" | "low";
export type Platform = "Amazon" | "Shopify" | "eBay" | "AliExpress" | "Alibaba" | "Etsy" | "Web Domain" | "Instagram" | "TikTok" | "Google" | "Meta" | "Facebook Marketplace";
export type CaseStatus = "active" | "takedown_sent" | "resolved" | "escalated" | "safe" | "analyzing";

export interface Client {
  id: string;
  name: string;
  industry: string;
  plan: "Starter" | "Pro" | "Enterprise";
  mrr: number;
  contact: string;
}

export interface Mark {
  id: string;
  serverId?: string;
  clientId: string;
  brandName: string;
  registrationNumber: string;
  website: string;
  platforms: Platform[];
  logoColor: string;
  createdAt: string;
  lastScan: string;
  status?: "active" | "on_hold";
  repeatCycle?: number;
  targetRegions?: string[];
  officialDomains?: string[];
  officialAdvertisers?: string[];
}

export interface Infringement {
  id: string;
  markId: string;
  clientId: string;
  brandName: string;
  risk: RiskLevel;
  platform: Platform;
  status: CaseStatus;
  detectedAt: string;
  infringer: {
    seller: string;
    storeUrl: string;
    country: string;
    contact: string;
    ip: string;
  };
  evidence: {
    url: string;
    timestamp: string;
    userAgent: string;
    method: string;
    screenshot_url?: string;
  };
  analysis: {
    confidence: number;
    logoMatch: number;
    nameMatch: number;
    category: string;
    rationale: string;
  };
  thumbnail: string;
  title: string;
  price: string;
}

const CLIENTS: Client[] = [
  { id: "c1", name: "Orbio", industry: "Consumer Goods", plan: "Pro", mrr: 899, contact: "legal@orbio.co" },
];

const MARKS: Mark[] = [
  { id: "m1", clientId: "c1", brandName: "Derila", registrationNumber: "US-89234112", website: "derila.com", platforms: ["Amazon", "Shopify", "Instagram"], logoColor: "oklch(0.58 0.18 255)", createdAt: "2025-02-14", lastScan: "8 min ago", status: "on_hold", targetRegions: ["US", "CA", "DE", "FR"] },
  { id: "m6", clientId: "c1", brandName: "Matsato", registrationNumber: "US-99123456", website: "matsato.com", platforms: ["Amazon", "eBay", "Web Domain"], logoColor: "oklch(0.72 0.17 65)", createdAt: "2025-03-01", lastScan: "12 min ago", status: "on_hold", targetRegions: ["US", "JP", "SG"] },
];

const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

const INFRINGEMENTS: Infringement[] = [];

// Server brands store platforms as apiKeys ("amazon"); the UI store uses the
// display Platform labels ("Amazon"). Convert one to the other so brands created
// elsewhere (e.g. the admin portal) map cleanly into the local marks list.
function apiKeysToPlatforms(keys: string[] | null | undefined): Platform[] {
  const out: Platform[] = [];
  for (const k of keys || []) {
    const match = PLATFORMS.find((p) => p.apiKey === k || p.id === (k as Platform));
    if (match && !out.includes(match.id)) out.push(match.id);
  }
  return out;
}

// A brand "locked" by plan limits or explicitly held is shown as on_hold in the UI.
function serverStatusToMark(status: string | null | undefined): "active" | "on_hold" {
  return status === "on_hold" || status === "locked" ? "on_hold" : "active";
}

interface State {
  hydrated: boolean;
  persona: Persona;
  activeClientId: string | null;
  clients: Client[];
  marks: Mark[];
  infringements: Infringement[];
  scanResults: Record<string, CheckBrandResponse>;
  setHydrated: (hydrated: boolean) => void;
  setPersona: (p: Persona) => void;
  setActiveClient: (id: string | null) => void;
  addMark: (mark: Omit<Mark, "id" | "createdAt" | "lastScan">) => void;
  syncServerBrands: (brands: BrandRecord[]) => void;
  toggleMarkStatus: (id: string) => void;
  updateMark: (id: string, updates: Partial<Omit<Mark, "id" | "createdAt" | "lastScan">>) => void;
  removeMark: (id: string) => void;
  restoreMark: (mark: Mark, infringements: Infringement[]) => void;
  addClient: (c: Omit<Client, "id">) => void;
  removeClient: (id: string) => void;
  updateCaseStatus: (id: string, status: CaseStatus) => void;
  setScanResult: (caseId: string, result: CheckBrandResponse) => void;
  addInfringement: (i: Omit<Infringement, "id" | "detectedAt">) => void;
  removeInfringement: (id: string) => void;
  /** Wipe all org-scoped local data before switching to another company, so the previous
   *  org's marks/cases/scan results can't bleed into the new org. The monitoring page then
   *  repopulates from the server (syncServerBrands) for the newly-active org. */
  resetOrgScopedData: () => void;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      hydrated: false,
      persona: "brand_owner",
      activeClientId: null,
      clients: CLIENTS,
      marks: MARKS,
      infringements: INFRINGEMENTS,
      scanResults: {},
      setHydrated: (hydrated) => set({ hydrated }),
      setPersona: (persona) => set({ persona, activeClientId: persona === "brand_owner" ? null : "c1" }),
      setActiveClient: (activeClientId) => set({ activeClientId }),
      addMark: (m) =>
        set((s) => ({
          marks: [
            ...s.marks,
            { ...m, id: `m${Date.now()}`, createdAt: new Date().toISOString().slice(0, 10), lastScan: "never" },
          ],
        })),
      // Reconcile the local marks list against the server `brands` table, which is the SINGLE
      // source of truth. A brand is the same entity whether it was created via the customer
      // "Add asset" form or the admin portal's "Add brand" — same table, same fields — so the
      // monitoring page must show exactly what the server has for this org (no local-only ghosts,
      // no stale entries). We only preserve the LOCAL monitoring controls (status/repeatCycle/id)
      // by matching an existing mark; everything else comes from the server.
      syncServerBrands: (brands) =>
        set((s) => {
          const serverIds = new Set(brands.map((b) => b.id));
          const serverNames = new Set(brands.map((b) => b.brand_name.trim().toLowerCase()));
          let marks = [...s.marks];

          // 1) Upsert every server brand: match by serverId, else adopt a same-named local mark
          //    (e.g. one just created via "Add asset" that hasn't learned its serverId yet).
          for (const b of brands) {
            const descriptive = {
              serverId: b.id,
              clientId: b.client_id ?? "",
              brandName: b.brand_name,
              registrationNumber: b.registration_number ?? "",
              website: (b.website ?? "").replace(/^https?:\/\//, ""),
              platforms: apiKeysToPlatforms(b.platforms),
              logoColor: b.logo_color ?? "oklch(0.58 0.18 255)",
              targetRegions: b.target_regions ?? [],
              officialDomains: b.official_domains ?? [],
              officialAdvertisers: b.official_advertisers ?? [],
            };
            let idx = marks.findIndex((m) => m.serverId && m.serverId === b.id);
            if (idx === -1) {
              idx = marks.findIndex(
                (m) =>
                  !m.serverId &&
                  m.brandName.trim().toLowerCase() === b.brand_name.trim().toLowerCase(),
              );
            }
            if (idx === -1) {
              marks.push({
                ...descriptive,
                id: `srv-${b.id}`,
                createdAt: (b.created_at ?? "").slice(0, 10),
                lastScan: b.last_scan_at ? new Date(b.last_scan_at).toLocaleString() : "never",
                status: serverStatusToMark(b.status),
              });
            } else {
              // Keep this mark's id/status/repeatCycle; refresh the descriptive fields.
              marks[idx] = { ...marks[idx], ...descriptive };
            }
          }

          // 2) Server is authoritative for real brands. Drop:
          //    - a mark whose serverId is gone from the server (brand deleted elsewhere), and
          //    - a local-only brand-owner mark that was never persisted (a ghost).
          //    Client-scoped demo marks (the seeded law-firm sample, clientId "c1") are kept.
          marks = marks.filter((m) => {
            if (m.serverId) return serverIds.has(m.serverId);
            if (m.clientId && m.clientId !== "") return true;
            return serverNames.has(m.brandName.trim().toLowerCase());
          });

          return { marks };
        }),
      toggleMarkStatus: (id) =>
        set((s) => ({
          marks: s.marks.map((m) =>
            m.id === id ? { ...m, status: m.status === "on_hold" ? "active" : "on_hold" } : m
          ),
        })),
      updateMark: (id, updates) =>
        set((s) => ({
          marks: s.marks.map((m) => (m.id === id ? { ...m, ...updates } : m)),
          infringements: s.infringements.map((i) =>
            i.markId === id && updates.brandName ? { ...i, brandName: updates.brandName } : i
          ),
        })),
      removeMark: (id) =>
        set((s) => ({
          marks: s.marks.filter((m) => m.id !== id),
          infringements: s.infringements.filter((i) => i.markId !== id),
        })),
      restoreMark: (mark, infringements) =>
        set((s) => ({
          marks: [...s.marks, mark],
          infringements: [...s.infringements, ...infringements],
        })),
      addClient: (c) => set((s) => ({ clients: [...s.clients, { ...c, id: `c${Date.now()}` }] })),
      removeClient: (id) => set((s) => ({ clients: s.clients.filter((c) => c.id !== id) })),
      updateCaseStatus: (id, status) =>
        set((s) => ({
          infringements: s.infringements.map((i) =>
            i.id === id ? { ...i, status, case_updated_at: new Date().toISOString() } : i
          ),
        })),
      setScanResult: (caseId, result) =>
        set((s) => ({ scanResults: { ...s.scanResults, [caseId]: result } })),
      addInfringement: (i) =>
        set((s) => ({
          infringements: [
            {
              ...i,
              id: `i${Date.now()}`,
              detectedAt: new Date().toISOString(),
            },
            ...s.infringements,
          ],
        })),
      removeInfringement: (id) =>
        set((s) => ({
          infringements: s.infringements.filter((i) => i.id !== id),
        })),
      resetOrgScopedData: () => set({ marks: [], infringements: [], scanResults: {} }),
    }),
    {
      name: "tracemark-store-v8",
      partialize: (state) => ({
        persona: state.persona,
        activeClientId: state.activeClientId,
        clients: state.clients,
        marks: state.marks,
        infringements: state.infringements,
        scanResults: state.scanResults,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.marks = state.marks.map((m) =>
            m.brandName.toLowerCase() === "derila" || m.brandName.toLowerCase() === "matsato"
              ? { ...m, status: "on_hold" }
              : m
          );
          state.infringements = state.infringements.filter(
            (i) =>
              i.brandName.toLowerCase() !== "derila" &&
              i.brandName.toLowerCase() !== "matsato" &&
              i.id !== "i2" &&
              i.id !== "i6" &&
              i.id !== "i8"
          );
          state.setHydrated(true);
        }
      },
    }
  )
);

export function useScopedInfringements() {
  const infringements = useStore((s) => s.infringements);
  const persona = useStore((s) => s.persona);
  const activeClientId = useStore((s) => s.activeClientId);

  return useMemo(() => {
    if (persona === "law_firm") {
      if (activeClientId) {
        return infringements.filter((i) => i.clientId === activeClientId);
      }
      return infringements.filter((i) => i.clientId !== "");
    }
    // brand_owner: only show infringements with empty/missing client ID
    return infringements.filter((i) => !i.clientId || i.clientId === "");
  }, [infringements, persona, activeClientId]);
}

export function useScopedMarks() {
  const marks = useStore((s) => s.marks);
  const persona = useStore((s) => s.persona);
  const activeClientId = useStore((s) => s.activeClientId);

  return useMemo(() => {
    if (persona === "law_firm") {
      if (activeClientId) {
        return marks.filter((m) => m.clientId === activeClientId);
      }
      return marks.filter((m) => m.clientId !== "");
    }
    // brand_owner: only show marks with empty/missing client ID
    return marks.filter((m) => !m.clientId || m.clientId === "");
  }, [marks, persona, activeClientId]);
}
