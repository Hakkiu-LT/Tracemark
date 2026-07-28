import { Link } from "@tanstack/react-router";
import { Linkedin } from "lucide-react";
import { HakkiuLogo } from "@/components/hakkiu-logo";
import { COMPANY, copyrightLine } from "@/lib/company";

type FooterLink = { label: string; to?: string; href?: string };

const COMPANY_LINKS: FooterLink[] = [
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
  { label: "Book a demo", to: "/request-demo" },
  { label: "Login", to: "/auth/sign-in" },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy Policy", to: "/legal/privacy" },
  { label: "Terms of Service", to: "/legal/terms" },
  { label: "Cookie Policy", to: "/legal/cookies" },
  { label: "Acceptable Use", to: "/legal/acceptable-use" },
  { label: "Data Processing Agreement", to: "/legal/dpa" },
  { label: "Sub-processors", to: "/legal/subprocessors" },
  { label: "Trust & Security", to: "/legal/security" },
  { label: "Legal Notice / Imprint", to: "/legal/imprint" },
];

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-foreground">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            {l.to ? (
              <Link to={l.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                {l.label}
              </Link>
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
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1.4fr]">
          {/* Brand block */}
          <div>
            <Link to="/landing" className="inline-flex items-center gap-2.5">
              <HakkiuLogo className="h-6 text-foreground" />
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              AI-powered trademark monitoring, evidence capture, and automated takedowns across
              marketplaces and the open web — built for brand owners and law firms.
            </p>
            <a
              href={COMPANY.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="HAKKIU on LinkedIn"
              className="mt-6 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              <Linkedin className="h-4 w-4" />
            </a>
          </div>

          <FooterColumn title="Company" links={COMPANY_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>{copyrightLine()}</span>
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            All systems operational
          </span>
        </div>
      </div>
    </footer>
  );
}
