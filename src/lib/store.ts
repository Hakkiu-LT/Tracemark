import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CheckBrandResponse } from "./api.types";

export type Persona = "brand_owner" | "law_firm";
export type RiskLevel = "high" | "medium" | "low";
export type Platform = "Amazon" | "Shopify" | "eBay" | "AliExpress" | "Alibaba" | "Etsy" | "Web Domain" | "Instagram" | "TikTok" | "Google" | "Meta" | "Facebook Marketplace" | "Google Shopping";
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
  { id: "m1", clientId: "c1", brandName: "Derila", registrationNumber: "US-89234112", website: "derila.com", platforms: ["Amazon", "Shopify", "Instagram"], logoColor: "oklch(0.58 0.18 255)", createdAt: "2025-02-14", lastScan: "8 min ago", status: "on_hold" },
  { id: "m6", clientId: "c1", brandName: "Matsato", registrationNumber: "US-99123456", website: "matsato.com", platforms: ["Amazon", "eBay", "Web Domain"], logoColor: "oklch(0.72 0.17 65)", createdAt: "2025-03-01", lastScan: "12 min ago", status: "on_hold" },
];

const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

const INFRINGEMENTS: Infringement[] = [];

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
            { ...m, id: `m${Date.now()}`, createdAt: new Date().toISOString().slice(0, 10), lastScan: "just now", status: "active" },
          ],
        })),
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
        set((s) => ({ infringements: s.infringements.map((i) => (i.id === id ? { ...i, status } : i)) })),
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
    }),
    {
      name: "tracemark-store-v7",
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
    if (persona === "law_firm" && activeClientId) {
      return infringements.filter((i) => i.clientId === activeClientId);
    }
    return infringements;
  }, [infringements, persona, activeClientId]);
}

export function useScopedMarks() {
  const marks = useStore((s) => s.marks);
  const persona = useStore((s) => s.persona);
  const activeClientId = useStore((s) => s.activeClientId);

  return useMemo(() => {
    if (persona === "law_firm" && activeClientId) {
      return marks.filter((m) => m.clientId === activeClientId);
    }
    return marks;
  }, [marks, persona, activeClientId]);
}
