import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShieldCheck,
  Radar,
  ShieldAlert,
  FileText,
  Zap,
  Globe2,
  Scale,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Building2,
  Gavel,
} from "lucide-react";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "Tracemark — Protect your brand at internet speed" },
      {
        name: "description",
        content:
          "Tracemark monitors marketplaces and the open web 24/7, detects infringements with AI, and automates takedowns — built for brand owners and law firms.",
      },
      { property: "og:title", content: "Tracemark — Protect your brand at internet speed" },
      {
        property: "og:description",
        content:
          "AI-powered trademark monitoring, evidence capture, and one-click takedowns across Amazon, Shopify, and the web.",
      },
    ],
  }),
  component: LandingPage,
});

const features = [
  {
    icon: Radar,
    title: "Always-on monitoring",
    body: "Continuous crawls across Amazon, Shopify, eBay, AliExpress, Instagram, TikTok, and the open web. New listings surface within minutes, not weeks.",
  },
  {
    icon: Sparkles,
    title: "AI infringement analysis",
    body: "Vision and language models score every match: logo similarity, brand-name proximity, product category overlap, and a plain-English rationale.",
  },
  {
    icon: FileText,
    title: "One-click takedowns",
    body: "Generate DMCA notices, cease & desist letters, and platform-specific Amazon/Shopify forms — pre-filled from captured evidence, ready to send.",
  },
  {
    icon: ShieldAlert,
    title: "Court-ready evidence",
    body: "Every detection ships with a forensics packet: timestamped screenshots, URLs, IP, user agent, and detection method. Tamper-evident by default.",
  },
  {
    icon: Scale,
    title: "Brand owner ↔ Law firm",
    body: "Switch personas in a click. Law firms manage multiple clients, track MRR and case load. Brand owners stay focused on their own portfolio.",
  },
  {
    icon: Zap,
    title: "Workflows that close cases",
    body: "Escalate, mark safe, send to counsel, or push to your webhook stack. Track success rate trends and platform breakdowns in real time.",
  },
];

const stats = [
  { value: "24/7", label: "Marketplace coverage" },
  { value: "<5 min", label: "From detection to alert" },
  { value: "87%", label: "Average takedown success" },
  { value: "12+", label: "Platforms monitored" },
];

const steps = [
  {
    n: "01",
    title: "Register your marks",
    body: "Add brand names, logos, registration numbers, and the marketplaces that matter.",
  },
  {
    n: "02",
    title: "We scan the internet",
    body: "Tracemark crawls listings, sellers, and domains — flagging anything that looks like you.",
  },
  {
    n: "03",
    title: "Review, decide, send",
    body: "AI ranks risk and drafts the notice. You approve. We deliver and track the outcome.",
  },
];

function LandingPage() {
  return (
    <>
      {/* TOP NAV */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-primary/95 text-primary-foreground backdrop-blur supports-[backdrop-filter]:bg-primary/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
          <Link to="/landing" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Tracemark</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-primary-foreground/80 md:flex">
            <a href="#features" className="transition-colors hover:text-primary-foreground">Features</a>
            <a href="#how" className="transition-colors hover:text-primary-foreground">How it works</a>
            <Link to="/plans" className="transition-colors hover:text-primary-foreground">Pricing</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
              <Link to="/auth/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="bg-white text-primary hover:bg-white/90">
              <Link to="/auth/sign-up">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary via-primary to-[oklch(0.32_0.12_260)] text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5" />
            Trademark & brand protection, automated
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Protect your brand at <span className="text-[oklch(0.78_0.14_255)]">internet speed.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-primary-foreground/80 md:text-xl">
            Tracemark monitors every marketplace, detects infringements with AI, and ships
            ready-to-file takedowns — so counterfeit listings disappear before customers ever see them.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
              <Link to="/dashboard">
                Open dashboard
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Link to="/plans">See pricing</Link>
            </Button>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold tracking-tight md:text-4xl">{s.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-primary-foreground/60">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="scroll-mt-16 border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.58_0.18_255)]">
              What you get
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Everything brand teams and IP counsel need, in one workspace.
            </h2>
            <p className="mt-4 text-muted-foreground">
              No more spreadsheets of suspicious URLs. No more screenshot folders. Tracemark
              turns brand protection into a clean, auditable workflow.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="group border-border/60 transition-colors hover:border-[oklch(0.58_0.18_255)]/60">
                <CardContent className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[oklch(0.58_0.18_255)]/10 text-[oklch(0.58_0.18_255)]">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="scroll-mt-16 border-b border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.58_0.18_255)]">
            How it works
          </div>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
            From "is that a fake?" to "it's gone" — in three steps.
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="relative rounded-xl border border-border bg-card p-6">
                <div className="font-mono text-xs text-muted-foreground">{s.n}</div>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PERSONAS */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[oklch(0.58_0.18_255)]/10 text-[oklch(0.58_0.18_255)]">
                <Building2 className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">For brand owners</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Defend your trademarks without a legal team on payroll. Monitor, file, and resolve
                in one workspace.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {["Real-time alerts on new infringements", "AI-drafted DMCA & cease letters", "Escalate to your counsel with one click"].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.62_0.15_155)]" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[oklch(0.58_0.18_255)]/10 text-[oklch(0.58_0.18_255)]">
                <Gavel className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">For law firms</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Scale your IP practice. Manage every client's portfolio, case load, and billing
                from a single pane of glass.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {["Multi-client switcher with per-client filters", "Case queue with MRR and activity tracking", "White-glove evidence packets for litigation"].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.62_0.15_155)]" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* COVERAGE */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-[oklch(0.58_0.18_255)]">
            <Globe2 className="h-4 w-4" />
            Coverage
          </div>
          <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight md:text-4xl">
            Wherever counterfeiters hide, we look.
          </h2>
          <div className="mt-10 flex flex-wrap gap-2">
            {["Amazon", "Shopify", "eBay", "AliExpress", "Etsy", "Walmart", "Instagram", "TikTok", "Facebook Marketplace", "Web domains", "App stores", "Google Shopping"].map((p) => (
              <span
                key={p}
                className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Your brand isn't going to defend itself.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Start monitoring in minutes. Send your first takedown today.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
              <Link to="/monitoring/new">
                Add your first mark
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Link to="/plans">View plans</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[oklch(0.58_0.18_255)]" />
            <span className="font-semibold text-foreground">Tracemark</span>
            <span>· Brand protection, automated.</span>
          </div>
          <div>© {new Date().getFullYear()} Tracemark. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}
