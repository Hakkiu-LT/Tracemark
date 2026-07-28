import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HakkiuLogo } from "@/components/hakkiu-logo";
import { Footer } from "@/components/landing/footer";
import { COMPANY } from "@/lib/company";

// Tailwind "prose" recipe (no typography plugin needed). Applied to the content
// wrapper; pages then write plain <h2>/<h3>/<p>/<ul>/<table> and get styled.
export const proseClasses = [
  "text-[0.95rem] leading-7 text-foreground/80",
  "[&>p]:mt-4 [&>section>p]:mt-4",
  "[&_h2]:mt-12 [&_h2]:mb-1 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2]:scroll-mt-24",
  "[&_h3]:mt-7 [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-foreground",
  "[&_p]:mt-4",
  "[&_a]:font-medium [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
  "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_ul]:marker:text-muted-foreground",
  "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-6",
  "[&_li]:pl-1",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_table]:mt-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
  "[&_th]:border [&_th]:border-border/60 [&_th]:bg-muted/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground",
  "[&_td]:border [&_td]:border-border/60 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
  "[&_hr]:my-10 [&_hr]:border-border/60",
].join(" ");

export function LegalLayout({
  title,
  subtitle,
  updated = COMPANY.effectiveDate,
  eyebrow = "Legal",
  showUpdated = true,
  children,
}: {
  title: string;
  subtitle?: string;
  updated?: string;
  eyebrow?: string;
  showUpdated?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background font-body-alt text-foreground">
      {/* Minimal top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/landing" className="flex items-center gap-2.5">
            <HakkiuLogo className="h-6 text-foreground" />
          </Link>
          <Link
            to="/landing"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-accent">{eyebrow}</p>
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle ? <p className="mt-3 text-base text-muted-foreground">{subtitle}</p> : null}
        {showUpdated ? (
          <p className="mt-4 text-sm text-muted-foreground">Last updated: {updated}</p>
        ) : null}
        <hr className="my-10 border-border/60" />

        <div className={proseClasses}>{children}</div>
      </main>

      <Footer />
    </div>
  );
}

// Small reusable "not legal advice / confirm details" callout for legal pages.
export function LegalDisclaimer() {
  return (
    <div className="mt-12 rounded-lg border border-border/60 bg-muted/30 p-4 text-xs leading-6 text-muted-foreground">
      <strong className="text-foreground">Note:</strong> This document is provided for transparency
      and is not legal advice. {COMPANY.brand} is an EU-established company; specific company
      registration details are set out in our{" "}
      <Link to="/legal/imprint" className="text-accent underline underline-offset-2">
        Legal Notice
      </Link>
      . If you have questions, contact us at{" "}
      <a href={`mailto:${COMPANY.email.legal}`} className="text-accent underline underline-offset-2">
        {COMPANY.email.legal}
      </a>
      .
    </div>
  );
}
