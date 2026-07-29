import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ScanSearch, ShieldCheck, Send } from "lucide-react";
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

const PATH = "/solutions/brand-owners";
const TITLE = "Brand Protection Software for Brand Owners";
const DESCRIPTION =
  "HAKKIU monitors Amazon, eBay, social media, app stores and domains for counterfeits, unauthorized sellers and lookalike domains — with legal-review-ready evidence and no per-takedown charge. Book a demo.";

export const Route = createFileRoute("/solutions/brand-owners")({
  head: () => ({
    meta: [
      { title: `${TITLE} | ${COMPANY.brand}` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `${COMPANY.brand} for Brand Owners` },
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
            { "@type": "ListItem", position: 2, name: "Solutions", item: `${COMPANY.baseUrl}/solutions/brand-owners` },
            { "@type": "ListItem", position: 3, name: "Brand Owners", item: `${COMPANY.baseUrl}${PATH}` },
          ],
        },
      },
      { property: "og:url", content: `${COMPANY.baseUrl}${PATH}` },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.baseUrl}${PATH}` }],
  }),
  component: BrandOwnersPage,
});

const WORKFLOW = [
  {
    icon: ScanSearch,
    title: "Detect",
    body: "Continuous AI monitoring across marketplaces, social commerce, app stores, domain registries and the open web finds listings, sellers and domains that misuse your brand.",
  },
  {
    icon: ShieldCheck,
    title: "Review",
    body: "A tiered pipeline scores every match by risk and captures evidence; a person reviews consequential decisions before anything is sent — so you act on real infringements, not noise.",
  },
  {
    icon: Send,
    title: "Remove",
    body: "A trademark or DMCA notice is prepared with the evidence attached and routed to the right marketplace portal, abuse contact or domain complaint, and each case is tracked to resolution.",
  },
];

function BrandOwnersPage() {
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
              For brand owners
            </Reveal>
            <Reveal
              as="h1"
              delay={70}
              className="mt-6 max-w-4xl font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-foreground sm:text-6xl"
            >
              Stop counterfeits and brand abuse online
            </Reveal>
            <Reveal
              as="p"
              delay={140}
              className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              HAKKIU finds counterfeit listings, unauthorized sellers and lookalike domains across
              your channels — and prepares the takedowns to remove them. Never charged per detection
              or per takedown.
            </Reveal>
            <Reveal delay={200} className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <RainbowButton
                type="button"
                onClick={openDemo}
                className="h-12 gap-2 px-7 text-sm font-semibold shadow-md"
              >
                Book a demo
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
              The problem, in plain terms
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              Your product turns up on AliExpress. Someone else is selling it on Amazon. A lookalike
              domain is running ads against your name and phishing your customers. Usually you find
              out by accident — a customer complaint, or a Google Alert. Checking every marketplace by
              hand does not scale, and each counterfeit chips away at margin and trust. {COMPANY.brand}{" "}
              turns that reactive scramble into a continuous, evidence-backed process.
            </Reveal>
          </div>
        </section>

        {/* WORKFLOW */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              How it works
            </Reveal>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {WORKFLOW.map((item, i) => (
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
              Coverage and pricing
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              See every channel {COMPANY.brand} watches in the{" "}
              <Link
                to="/"
                hash="coverage"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                coverage overview
              </Link>
              . Pricing is tailored to your brand and shared after a demo — you are never charged per
              detection or per takedown, so growing your monitoring never means a growing bill.
              Comparing options? See{" "}
              <Link
                to="/compare/red-points"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                HAKKIU vs Red Points
              </Link>{" "}
              and{" "}
              <Link
                to="/compare/brandshield"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                HAKKIU vs BrandShield
              </Link>
              , or, if you're a law firm,{" "}
              <Link
                to="/solutions/law-firms"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                HAKKIU for law firms
              </Link>
              .
            </Reveal>

            <Reveal delay={140} className="mt-10">
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">See it on your own brand</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Book a demo and we'll show you what {COMPANY.brand} detects across your
                    marketplaces, social channels and domains. Questions first? Email{" "}
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
                    Book a demo
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
