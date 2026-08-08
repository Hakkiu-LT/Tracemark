import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUp, Clock } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { Footer } from "@/components/landing/footer";
import { COMPANY } from "@/lib/company";
import { cn } from "@/lib/utils";

// Tailwind "prose" recipe (no typography plugin needed). Applied to the content
// wrapper; pages then write plain <h2>/<h3>/<p>/<ul>/<table> and get styled.
export const proseClasses = [
  "text-[0.95rem] leading-7 text-foreground/90",
  "[&>p]:mt-4 [&>section>p]:mt-4",
  // h2 opens a new section: a hairline rule + generous top padding make the
  // document scannable instead of one flat run of text.
  "[&_h2]:mt-12 [&_h2]:border-t [&_h2]:border-border/50 [&_h2]:pt-10 [&_h2]:mb-4 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2]:scroll-mt-28",
  "[&_h3]:mt-7 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:scroll-mt-28",
  "[&_p]:mt-4",
  "[&_a]:font-medium [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
  "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_ul]:marker:text-muted-foreground",
  "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-6",
  "[&_li]:pl-1",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  // inline code: mono pill so identifiers (e.g. cookie names) read as code.
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-foreground",
  // tables scroll horizontally on small screens instead of clipping; even rows
  // are zebra-striped for readability.
  "[&_table]:mt-5 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm",
  "[&_thead_th]:border [&_thead_th]:border-border/60 [&_thead_th]:bg-muted/50 [&_thead_th]:px-3 [&_thead_th]:py-2 [&_thead_th]:text-left [&_thead_th]:font-semibold [&_thead_th]:text-foreground [&_thead_th]:whitespace-nowrap",
  "[&_th]:border [&_th]:border-border/60 [&_th]:bg-muted/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground",
  "[&_td]:border [&_td]:border-border/60 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
  "[&_tbody_tr:nth-child(even)]:bg-muted/20",
  "[&_hr]:my-10 [&_hr]:border-border/60",
].join(" ");

type TocItem = { id: string; text: string };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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
  const contentRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  // Build the table of contents from the rendered <h2> headings (assigning a
  // slug id to each) and keep the active section in sync while scrolling.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const heads = Array.from(el.querySelectorAll("h2")) as HTMLHeadingElement[];
    const items = heads.map((h) => {
      const text = h.textContent?.trim() ?? "";
      const id = h.id || slugify(text);
      h.id = id;
      return { id, text };
    });
    setToc(items);

    if (heads.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px" },
    );
    heads.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [children]);

  const hasToc = toc.length >= 3;

  return (
    <div className="flex min-h-screen flex-col bg-background font-body-alt text-foreground">
      {/* Minimal top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <CompanyLogo className="h-6 text-foreground" />
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto w-full max-w-6xl flex-1 px-6 py-14",
          hasToc && "lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-14",
        )}
      >
        <div className="min-w-0 max-w-3xl">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-accent">
            {eyebrow}
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {title}
          </h1>
          {subtitle ? <p className="mt-4 text-lg text-muted-foreground">{subtitle}</p> : null}
          {showUpdated ? (
            <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Last updated: {updated}
            </div>
          ) : null}
          <hr className="my-10 border-border/60" />

          <div ref={contentRef} className={proseClasses}>
            {children}
          </div>
        </div>

        {hasToc ? (
          <aside className="hidden lg:block">
            <nav className="sticky top-24">
              <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                On this page
              </p>
              <ul className="space-y-1.5 border-l border-border/60 text-sm">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className={cn(
                        "-ml-px block border-l-2 py-0.5 pl-4 transition-colors",
                        activeId === item.id
                          ? "border-accent font-medium text-foreground"
                          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                      )}
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        ) : null}
      </main>

      <BackToTop />
      <Footer />
    </div>
  );
}

// Floating "scroll to top" button — appears once the reader is well down a long
// legal page, so getting back to the top isn't a manual scroll.
function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground shadow-md backdrop-blur transition-all hover:text-foreground",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
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
