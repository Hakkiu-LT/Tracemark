import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Scale, FileCheck, Users } from "lucide-react";
import { InfiniteGridBackdrop } from "@/components/ui/the-infinite-grid";
import { LandingNav } from "@/components/landing/landing-nav";
import { Footer } from "@/components/landing/footer";
import { Reveal } from "@/components/landing/reveal";
import { useLeadModals } from "@/components/landing/lead-modals";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { COMPANY } from "@/lib/company";

const PATH = "/solutions/law-firms";
const TITLE = "Trademark Monitoring Software for IP Law Firms";
const DESCRIPTION =
  "HAKKIU gives IP law firms one platform for trademark and marketplace monitoring, legal-review-ready evidence, and multi-client enforcement workflows. Book a firm demo.";

export const Route = createFileRoute("/solutions/law-firms")({
  head: () => ({
    meta: [
      { title: `${TITLE} | ${COMPANY.brand}` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `${COMPANY.brand} for Law Firms` },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${COMPANY.baseUrl}${PATH}#webpage`,
          url: `${COMPANY.baseUrl}${PATH}`,
          name: TITLE,
          description: DESCRIPTION,
          isPartOf: { "@id": `${COMPANY.baseUrl}/#website` },
          about: { "@id": `${COMPANY.baseUrl}/#organization` },
        },
      },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${COMPANY.baseUrl}/` },
            { "@type": "ListItem", position: 2, name: "Solutions", item: `${COMPANY.baseUrl}/solutions/law-firms` },
            { "@type": "ListItem", position: 3, name: "Law Firms", item: `${COMPANY.baseUrl}${PATH}` },
          ],
        },
      },
      { property: "og:url", content: `${COMPANY.baseUrl}${PATH}` },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.baseUrl}${PATH}` }],
  }),
  component: LawFirmsPage,
});

const CAPABILITIES = [
  {
    icon: Users,
    title: "One workspace per client",
    body: "Manage enforcement for many clients side by side. Each matter keeps its own marks, authorized sellers, detections and takedown history — organized and defensible.",
  },
  {
    icon: FileCheck,
    title: "Evidence for legal review",
    body: "Every detection is captured as high-resolution screenshots, WHOIS records and a SHA-256 hash with a UTC timestamp — packaged so it stands up when you escalate or file.",
  },
  {
    icon: Scale,
    title: "Representative-of-client notices",
    body: "Takedown notices are prepared with representative-of-client wording and routed to the right marketplace portal, abuse contact or UDRP complaint, with each case tracked to resolution.",
  },
];

function LawFirmsPage() {
  const { openDemo, openSales } = useLeadModals();

  return (
    <div className="relative isolate min-h-screen bg-background text-foreground antialiased selection:bg-foreground selection:text-background">
      <InfiniteGridBackdrop fixed />

      <div className="relative z-10">
        <LandingNav />

        {/* HERO */}
        <section className="technical-paper relative border-b border-border/60 pt-28 pb-16 md:pt-36 md:pb-24">
          <div className="mx-auto flex max-w-5xl flex-col items-center px-6 text-center">
            <Reveal
              as="p"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              For law firms
            </Reveal>
            <Reveal
              as="h1"
              delay={70}
              className="mt-6 max-w-4xl font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-foreground sm:text-6xl"
            >
              Brand protection built for IP law firms
            </Reveal>
            <Reveal
              as="p"
              delay={140}
              className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Monitor trademarks, marketplaces and domains for every client from one workspace —
              with legal-review-ready evidence and takedowns tracked to resolution.
            </Reveal>
            <Reveal delay={200} className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <RainbowButton
                type="button"
                onClick={openDemo}
                className="h-12 gap-2 px-7 text-sm font-semibold shadow-md"
              >
                Book a firm demo
                <ArrowRight className="h-4 w-4" />
              </RainbowButton>
              <Button
                size="lg"
                variant="outline"
                onClick={openSales}
                className="h-12 rounded-lg border-border bg-card px-7 text-sm font-semibold text-foreground transition-all hover:border-foreground/40 hover:bg-muted hover:text-foreground"
              >
                Talk to sales
              </Button>
            </Reveal>
          </div>
        </section>

        {/* THE PROBLEM */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              The gap in the usual workflow
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              Most firms watch client brands with a patchwork: a trademark watch service that arrives
              as raw data, docketing software that was never built for online enforcement, and manual
              marketplace checks that eat associate hours. When a client asks what you are doing about
              counterfeits and impersonation online, the honest answer is often "not much,
              systematically." {COMPANY.brand} closes that gap — continuous monitoring across
              marketplaces, domains and the open web, with the evidence and workflow a legal team
              needs to act.
            </Reveal>
          </div>
        </section>

        {/* CAPABILITIES */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              Built for multi-client enforcement
            </Reveal>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {CAPABILITIES.map((item, i) => (
                <Reveal key={item.title} delay={120 + i * 70}>
                  <Card className="h-full bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
                        <item.icon className="h-5 w-5" />
                      </span>
                      <CardTitle className="mt-4 text-lg">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm leading-relaxed">
                        {item.body}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* COVERAGE + INTERLINK */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              Coverage and evidence
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              {COMPANY.brand} monitors online marketplaces, social commerce, app stores, domain
              registries and the open web around the clock; see the full{" "}
              <Link
                to="/"
                hash="coverage"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                coverage overview
              </Link>{" "}
              and how detection works on the{" "}
              <Link
                to="/"
                hash="how"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                homepage workflow
              </Link>
              . Weighing enterprise IP suites? See how we compare on{" "}
              <Link
                to="/compare/corsearch"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                HAKKIU vs Corsearch
              </Link>
              , or read about{" "}
              <Link
                to="/solutions/brand-owners"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                HAKKIU for brand owners
              </Link>
              .
            </Reveal>

            <Reveal delay={140} className="mt-10">
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Protect your clients' brands online</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Book a demo and we'll walk your firm through multi-client monitoring, evidence
                    capture and takedown workflows. Questions first? Reach us at{" "}
                    <a
                      href={`mailto:${COMPANY.email.general}`}
                      className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
                    >
                      {COMPANY.email.general}
                    </a>
                    .
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RainbowButton
                    type="button"
                    onClick={openDemo}
                    className="h-11 gap-2 px-6 text-sm font-semibold shadow-md"
                  >
                    Book a firm demo
                    <ArrowRight className="h-4 w-4" />
                  </RainbowButton>
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
