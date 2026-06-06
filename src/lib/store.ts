import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CheckBrandResponse } from "./api.types";

export type Persona = "brand_owner" | "law_firm";
export type RiskLevel = "high" | "medium" | "low";
export type Platform = "Amazon" | "Shopify" | "eBay" | "AliExpress" | "Web Domain" | "Instagram" | "TikTok" | "Google" | "Meta";
export type CaseStatus = "active" | "takedown_sent" | "resolved" | "escalated" | "safe";

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
  { id: "c1", name: "Aurora Athletics", industry: "Apparel", plan: "Pro", mrr: 899, contact: "legal@aurora.co" },
  { id: "c2", name: "Helix Audio", industry: "Consumer Electronics", plan: "Enterprise", mrr: 2400, contact: "ip@helixaudio.com" },
  { id: "c3", name: "Northwind Coffee", industry: "F&B", plan: "Starter", mrr: 299, contact: "founder@northwind.coffee" },
  { id: "c4", name: "Vector SaaS", industry: "Software", plan: "Pro", mrr: 899, contact: "trust@vector.dev" },
];

const MARKS: Mark[] = [
  { id: "m1", clientId: "c1", brandName: "Aurora Athletics", registrationNumber: "US-89234112", website: "aurora.co", platforms: ["Amazon", "Shopify", "Instagram"], logoColor: "oklch(0.58 0.18 255)", createdAt: "2025-02-14", lastScan: "8 min ago" },
  { id: "m2", clientId: "c2", brandName: "Helix Audio", registrationNumber: "EU-018822991", website: "helixaudio.com", platforms: ["Amazon", "eBay", "AliExpress", "Web Domain"], logoColor: "oklch(0.62 0.15 155)", createdAt: "2024-11-03", lastScan: "2 min ago" },
  { id: "m3", clientId: "c2", brandName: "Helix Pulse Pro", registrationNumber: "US-91022774", website: "helixaudio.com/pulse", platforms: ["Amazon", "AliExpress"], logoColor: "oklch(0.45 0.12 280)", createdAt: "2025-01-22", lastScan: "21 min ago" },
  { id: "m4", clientId: "c3", brandName: "Northwind Roast", registrationNumber: "US-77654321", website: "northwind.coffee", platforms: ["Shopify", "Instagram", "TikTok"], logoColor: "oklch(0.72 0.17 65)", createdAt: "2025-03-09", lastScan: "1 hr ago" },
  { id: "m5", clientId: "c4", brandName: "Vector", registrationNumber: "US-66112299", website: "vector.dev", platforms: ["Web Domain"], logoColor: "oklch(0.58 0.22 27)", createdAt: "2024-09-30", lastScan: "44 min ago" },
];

const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

const INFRINGEMENTS: Infringement[] = [
  {
    id: "i1", markId: "m2", clientId: "c2", brandName: "Helix Audio",
    risk: "high", platform: "AliExpress", status: "active", detectedAt: ago(7),
    infringer: { seller: "ShenzhenAudioMax", storeUrl: "aliexpress.com/store/4422991", country: "CN", contact: "audiomax@qq.com", ip: "118.24.55.201" },
    evidence: { url: "aliexpress.com/item/1005006622991.html", timestamp: ago(7), userAgent: "Mozilla/5.0 TracemarkBot/2.1", method: "Image Hash + OCR" },
    analysis: { confidence: 96, logoMatch: 94, nameMatch: 100, category: "Counterfeit Product", rationale: "Listing uses identical 'Helix Audio' wordmark, official product imagery has been re-uploaded with watermark removed, and the listed model number 'HX-Pulse' matches a registered product line. Price is 78% below MSRP — classic counterfeit signal." },
    thumbnail: "oklch(0.58 0.22 27)", title: "Helix Audio Pulse Pro Wireless Earbuds", price: "$4.86",
  },
  {
    id: "i2", markId: "m1", clientId: "c1", brandName: "Aurora Athletics",
    risk: "high", platform: "Amazon", status: "active", detectedAt: ago(34),
    infringer: { seller: "FitGearDirect", storeUrl: "amazon.com/sp?seller=A1FITGEAR", country: "US", contact: "support@fitgeardirect.com", ip: "54.231.18.44" },
    evidence: { url: "amazon.com/dp/B0CXY9921", timestamp: ago(34), userAgent: "Mozilla/5.0 TracemarkBot/2.1", method: "Logo Similarity" },
    analysis: { confidence: 89, logoMatch: 91, nameMatch: 72, category: "Trademark Infringement", rationale: "Product packaging uses a near-identical aurora-arc logomark with the same color gradient. Brand name 'Aurora Athletix' is a confusingly similar variant of the registered 'Aurora Athletics' mark." },
    thumbnail: "oklch(0.58 0.18 255)", title: "Aurora Athletix Performance Leggings", price: "$18.99",
  },
  {
    id: "i3", markId: "m4", clientId: "c3", brandName: "Northwind Roast",
    risk: "medium", platform: "Shopify", status: "active", detectedAt: ago(96),
    infringer: { seller: "northwind-coffee-shop.myshopify.com", storeUrl: "northwind-coffee-shop.myshopify.com", country: "VN", contact: "—", ip: "203.118.44.9" },
    evidence: { url: "northwind-coffee-shop.myshopify.com/products/dark-roast", timestamp: ago(96), userAgent: "Mozilla/5.0 TracemarkBot/2.1", method: "Domain Squat Detection" },
    analysis: { confidence: 74, logoMatch: 33, nameMatch: 98, category: "Domain Impersonation", rationale: "Shopify storefront uses the registered brand name in its handle and product titles. No logo reuse detected, but the store is positioned to capture brand search traffic." },
    thumbnail: "oklch(0.72 0.17 65)", title: "Northwind Dark Roast — Single Origin 12oz", price: "$11.20",
  },
  {
    id: "i4", markId: "m5", clientId: "c4", brandName: "Vector",
    risk: "high", platform: "Web Domain", status: "active", detectedAt: ago(180),
    infringer: { seller: "vector-app.io", storeUrl: "vector-app.io", country: "RU", contact: "whois-private", ip: "194.58.112.77" },
    evidence: { url: "vector-app.io", timestamp: ago(180), userAgent: "Mozilla/5.0 TracemarkBot/2.1", method: "Domain + Content Clone" },
    analysis: { confidence: 98, logoMatch: 99, nameMatch: 100, category: "Phishing / Brand Clone", rationale: "Pixel-for-pixel clone of vector.dev landing page. Hosts a login form posting credentials to an attacker-controlled endpoint. Immediate registrar takedown recommended." },
    thumbnail: "oklch(0.58 0.22 27)", title: "vector-app.io — cloned landing page", price: "—",
  },
  {
    id: "i5", markId: "m3", clientId: "c2", brandName: "Helix Pulse Pro",
    risk: "low", platform: "Instagram", status: "active", detectedAt: ago(240),
    infringer: { seller: "@helixpulse.deals", storeUrl: "instagram.com/helixpulse.deals", country: "PH", contact: "DM only", ip: "—" },
    evidence: { url: "instagram.com/p/CzZ1pulse", timestamp: ago(240), userAgent: "Mozilla/5.0 TracemarkBot/2.1", method: "Username + Image Match" },
    analysis: { confidence: 61, logoMatch: 55, nameMatch: 88, category: "Unauthorized Reseller", rationale: "Account uses brand imagery to advertise discounted product. May be a grey-market reseller rather than counterfeit — review before action." },
    thumbnail: "oklch(0.45 0.12 280)", title: "Pulse Pro 50% off — DM to order", price: "$59.00",
  },
  {
    id: "i6", markId: "m1", clientId: "c1", brandName: "Aurora Athletics",
    risk: "medium", platform: "eBay", status: "takedown_sent", detectedAt: ago(60 * 26),
    infringer: { seller: "sportsoutlet_us", storeUrl: "ebay.com/usr/sportsoutlet_us", country: "US", contact: "via eBay", ip: "—" },
    evidence: { url: "ebay.com/itm/2848822991", timestamp: ago(60 * 26), userAgent: "Mozilla/5.0 TracemarkBot/2.1", method: "Logo Similarity" },
    analysis: { confidence: 82, logoMatch: 85, nameMatch: 92, category: "Trademark Infringement", rationale: "Listing uses brand logo without authorization." },
    thumbnail: "oklch(0.72 0.17 65)", title: "Aurora Athletics Hoodie - Authentic", price: "$34.99",
  },
  {
    id: "i7", markId: "m2", clientId: "c2", brandName: "Helix Audio",
    risk: "low", platform: "Amazon", status: "resolved", detectedAt: ago(60 * 48),
    infringer: { seller: "AudioDeals", storeUrl: "amazon.com/sp?seller=AUDIODEALS", country: "US", contact: "—", ip: "—" },
    evidence: { url: "amazon.com/dp/B0AUDIO22", timestamp: ago(60 * 48), userAgent: "Mozilla/5.0 TracemarkBot/2.1", method: "Image Hash" },
    analysis: { confidence: 70, logoMatch: 70, nameMatch: 80, category: "Resolved", rationale: "Listing removed by platform." },
    thumbnail: "oklch(0.62 0.15 155)", title: "Helix Audio Earbuds (Refurb)", price: "—",
  },
];

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
  removeMark: (id: string) => void;
  restoreMark: (mark: Mark, infringements: Infringement[]) => void;
  addClient: (c: Omit<Client, "id">) => void;
  removeClient: (id: string) => void;
  updateCaseStatus: (id: string, status: CaseStatus) => void;
  setScanResult: (caseId: string, result: CheckBrandResponse) => void;
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
            { ...m, id: `m${Date.now()}`, createdAt: new Date().toISOString().slice(0, 10), lastScan: "just now" },
          ],
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
    }),
    {
      name: "tracemark-store",
      partialize: (state) => ({
        persona: state.persona,
        activeClientId: state.activeClientId,
        clients: state.clients,
        marks: state.marks,
        infringements: state.infringements,
        scanResults: state.scanResults,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
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
