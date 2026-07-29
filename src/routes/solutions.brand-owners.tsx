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
  "HAKKIU monitors Amazon, eBay, social media, app stores and domains for counterfeits, unauthorized sellers and lookalike domains — no per-takedown fee.";

const FAQS = [
  {
    q: "Which marketplaces and channels does HAKKIU monitor?",
    a: "Marketplaces like Amazon, eBay, Etsy, AliExpress and Alibaba, plus Shopify storefronts, social commerce on Instagram, Facebook and TikTok, app stores, Google Shopping, and domain registries and the open web. The idea is to cover the places a counterfeit or a lookalike domain actually shows up, not just the one or two you already watch by hand.",
  },
  {
    q: "How is pricing structured?",
    a: "It is a flat rate, set by how many brands and marks you are protecting — not by how many infringements we find or how many takedowns we file. That matters, because the months you most need enforcement are the months a per-takedown tool costs you the most. We share the number after a demo, once we know what you are protecting.",
  },
  {
    q: "What happens after a counterfeit listing is detected?",
    a: "The match is scored by risk and its evidence is captured automatically — screenshots, WHOIS and a hashed, timestamped record. You review it, and if it is a real infringement a trademark or DMCA notice is prepared with that evidence attached and routed to the right marketplace portal, abuse contact or domain complaint. Each case is then tracked until it is resolved.",
  },
  {
    q: "How much is automated, and where does a person actually look?",
    a: "Detection is the automated part: a tiered pipeline runs keyword and typosquat checks, perceptual image hashing, then a vision-language model to judge the harder cases. But a person reviews the consequential decisions before any notice goes out. You are not handing enforcement to a model and hoping — the automation does the searching, a human makes the calls that carry weight.",
  },
];

export const Route = createFileRoute("/solutions/brand-owners")({
  head: () => ({
    meta: [
      { title: `${TITLE} | ${COMPANY.brand}` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
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
          datePublished: "2026-07-29",
          dateModified: "2026-07-29",
          author: { "@id": `${COMPANY.baseUrl}/#organization` },
        },
      },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${COMPANY.baseUrl}/` },
            { "@type": "ListItem", position: 2, name: "For brand owners", item: `${COMPANY.baseUrl}${PATH}` },
          ],
        },
      },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "@id": `${COMPANY.baseUrl}${PATH}#faq`,
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
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
              makes finding them a background job instead of a fire drill.
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

        {/* CHANNEL BY CHANNEL */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              What that looks like on each channel
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              "Everywhere online" is easy to say. In practice the abuse looks different depending on
              where it lives, and so does the way you get it removed.
            </Reveal>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Marketplaces",
                  body: "Counterfeit listings and unauthorized sellers on Amazon, eBay, Etsy, AliExpress and Alibaba. Where a marketplace runs its own brand-protection route — Amazon Brand Registry, eBay's VeRO programme — notices are routed through it, which is usually the fastest way to a removal.",
                },
                {
                  title: "Domains",
                  body: "Lookalike and typosquatted domains running ads against your name or phishing your customers. The WHOIS record is captured with the rest of the evidence, and where it is warranted a UDRP complaint is prepared to go after the domain itself, not just one page.",
                },
                {
                  title: "Social & app stores",
                  body: "Fake shops, impersonation accounts and knock-off apps across Instagram, Facebook, TikTok and the app stores. These get reported through each platform's own channel, with the evidence attached so the report is not just a flag.",
                },
              ].map((c, i) => (
                <Reveal key={c.title} delay={120 + i * 70}>
                  <div className="h-full rounded-2xl border border-border/80 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
                    <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                      {c.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                  </div>
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

        {/* FAQ */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              Questions brand owners ask us
            </Reveal>
            <div className="mt-10 max-w-3xl divide-y divide-border/60">
              {FAQS.map((faq, i) => (
                <Reveal key={faq.q} delay={100 + i * 60} className="py-6 first:pt-0">
                  <h3 className="font-display text-base font-bold tracking-tight text-foreground">
                    {faq.q}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
