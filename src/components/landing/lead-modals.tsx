"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { BookDemoModal } from "./book-demo-modal";
import { TalkToSalesModal } from "./talk-to-sales-modal";

interface LeadModalsContext {
  openDemo: () => void;
  openSales: () => void;
}

const Ctx = createContext<LeadModalsContext | null>(null);

/**
 * Access the shared Book-a-demo / Talk-to-sales modals from anywhere in the
 * marketing tree. Both modals live once at the app root (see __root.tsx) so
 * every CTA — nav, hero, footer, legal pages — opens the same instance without
 * a page navigation.
 */
export function useLeadModals(): LeadModalsContext {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useLeadModals must be used within <LeadModalsProvider>");
  }
  return ctx;
}

export function LeadModalsProvider({ children }: { children: React.ReactNode }) {
  const [demoOpen, setDemoOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);

  const openDemo = useCallback(() => setDemoOpen(true), []);
  const openSales = useCallback(() => setSalesOpen(true), []);

  // Auto-open from a `?book=demo|sales` query param. This powers the
  // /request-demo → /landing?book=demo redirect (retired wizard) and lets
  // campaign / email links deep-link straight into a modal. We strip the param
  // afterwards so a refresh or back-nav doesn't re-open the modal.
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const book = search?.book;

  useEffect(() => {
    if (book !== "demo" && book !== "sales") return;
    if (book === "demo") setDemoOpen(true);
    else setSalesOpen(true);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("book");
      const qs = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + (qs ? `?${qs}` : ""),
      );
    }
  }, [book]);

  return (
    <Ctx.Provider value={{ openDemo, openSales }}>
      {children}
      <BookDemoModal open={demoOpen} onOpenChange={setDemoOpen} />
      <TalkToSalesModal open={salesOpen} onOpenChange={setSalesOpen} />
    </Ctx.Provider>
  );
}
