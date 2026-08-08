import { Link } from "@tanstack/react-router";
import { Linkedin, ArrowRight } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { COMPANY, copyrightLine } from "@/lib/company";
import { openCookieSettings } from "@/lib/consent";
import { Reveal } from "./reveal";
import { useLeadModals } from "./lead-modals";

type FooterLink = {
  label: string;
  to?: string;
  hash?: string;
  href?: string;
  onClick?: () => void;
};

const PRODUCT_LINKS: FooterLink[] = [
  { label: "Platform", to: "/", hash: "features" },
  { label: "Coverage", to: "/", hash: "coverage" },
  { label: "How it works", to: "/", hash: "how" },
  { label: "Security", to: "/legal/security" },
];

const SOLUTIONS_LINKS: FooterLink[] = [
  { label: "For brand owners", to: "/solutions/brand-owners" },
  { label: "For law firms", to: "/solutions/law-firms" },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy Policy", to: "/legal/privacy" },
  { label: "Terms of Service", to: "/legal/terms" },
  { label: "Cookie Policy", to: "/legal/cookies" },
  { label: "Acceptable Use", to: "/legal/acceptable-use" },
  { label: "Data Processing", to: "/legal/dpa" },
  { label: "Sub-processors", to: "/legal/subprocessors" },
];

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-foreground">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            {l.to ? (
              <Link
                to={l.to}
                hash={l.hash}
                className="group inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="bg-gradient-to-r from-current to-current bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">
                  {l.label}
                </span>
              </Link>
            ) : l.onClick ? (
              <button
                type="button"
                onClick={l.onClick}
                className="text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </button>
            ) : (
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const { openDemo, openSales } = useLeadModals();

  const companyLinks: FooterLink[] = [
    { label: "About", to: "/about" },
    { label: "Contact", to: "/contact" },
    { label: "Book a demo", onClick: openDemo },
    { label: "Login", to: "/auth/sign-in" },
  ];

  return (
    <footer className="technical-paper border-t border-border/60">
      {/* Closing CTA strip */}
      <div className="border-b border-border/60">
        <Reveal className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Keep your brand within reach.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              See how HAKKIU fits your monitoring and enforcement workflow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openSales}
              className="inline-flex items-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-foreground/40 hover:bg-muted"
            >
              Talk to sales
            </button>
            <RainbowButton
              type="button"
              onClick={openDemo}
              className="gap-2 rounded-lg px-5 text-sm font-semibold shadow-sm"
            >
              Book a demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </RainbowButton>
          </div>
        </Reveal>
      </div>

      {/* Columns */}
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr]">
          {/* Brand block */}
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5">
              <CompanyLogo className="h-6 text-foreground" />
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              AI-powered trademark monitoring, evidence capture, and automated takedowns for brand
              owners and IP teams.
            </p>
            <div className="mt-6 flex items-center gap-2.5">
              <a
                href={COMPANY.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="HAKKIU on LinkedIn"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-6 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ backgroundColor: "var(--mint, #18c889)" }}
              />
              All systems operational
            </p>
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Solutions" links={SOLUTIONS_LINKS} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        {/* Bottom rail */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>{copyrightLine()}</span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link to="/legal/imprint" className="transition-colors hover:text-foreground">
              Legal notice
            </Link>
            <button
              type="button"
              onClick={openCookieSettings}
              className="transition-colors hover:text-foreground"
            >
              Cookie settings
            </button>
            <span className="font-mono">Kaunas, Lithuania</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
