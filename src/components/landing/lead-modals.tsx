"use client";

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";

// Lazy-loaded: the two lead modals pull in Radix Select + Input + the full form
// logic, but they're never visible until a CTA is clicked. Code-splitting them
// keeps that JS out of the initial landing bundle (part of the ~176KiB unused-JS
// finding). Each only mounts once its `loaded` latch flips true (on first open),
// so it renders NOTHING during SSR and never blocks the stream.
const BookDemoModal = lazy(() =>
  import("./book-demo-modal").then((m) => ({ default: m.BookDemoModal })),
);
const TalkToSalesModal = lazy(() =>
  import("./talk-to-sales-modal").then((m) => ({ default: m.TalkToSalesModal })),
);

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
  // "loaded" latches: flip true the first time a modal opens and stay true, so
  // the lazy chunk is fetched once and the component stays mounted afterwards
  // (preserving Radix's open AND close animations; a plain `&&` on `open` would
  // unmount on close and skip the exit transition).
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [salesLoaded, setSalesLoaded] = useState(false);

  const openDemo = useCallback(() => {
    setDemoLoaded(true);
    setDemoOpen(true);
  }, []);
  const openSales = useCallback(() => {
    setSalesLoaded(true);
    setSalesOpen(true);
  }, []);

  // Auto-open from a `?book=demo|sales` query param. This powers the
  // /request-demo → /landing?book=demo redirect (retired wizard) and lets
  // campaign / email links deep-link straight into a modal. We strip the param
  // afterwards so a refresh or back-nav doesn't re-open the modal.
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const book = search?.book;

  useEffect(() => {
    if (book !== "demo" && book !== "sales") return;
    if (book === "demo") {
      setDemoLoaded(true);
      setDemoOpen(true);
    } else {
      setSalesLoaded(true);
      setSalesOpen(true);
    }

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
      {demoLoaded && (
        <Suspense fallback={null}>
          <BookDemoModal open={demoOpen} onOpenChange={setDemoOpen} />
        </Suspense>
      )}
      {salesLoaded && (
        <Suspense fallback={null}>
          <TalkToSalesModal open={salesOpen} onOpenChange={setSalesOpen} />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}
