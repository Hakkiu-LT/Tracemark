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
  "HAKKIU gives IP law firms one platform to monitor marketplaces and domains, with legal-review-ready evidence and multi-client enforcement workflows.";

const FAQS = [
  {
    q: "Can one firm manage several clients in HAKKIU?",
    a: "Yes — that is the point of it. Each client gets its own workspace, with its own marks, authorized sellers, detections and takedown history kept separate. Nothing bleeds between matters, so you can hand a partner a clean picture of exactly what is happening for one client without unpicking it from the rest.",
  },
  {
    q: "Is the evidence usable if we escalate or file?",
    a: "That is what it is built for. Every detection is captured as high-resolution screenshots, WHOIS registration records and a SHA-256 hash of the content with a UTC timestamp, then stored privately and shared through short-lived signed links. The point is a record that is timestamped and tamper-evident — something that holds up at a marketplace portal, in a UDRP complaint, or in front of a court, rather than a screenshot someone could have edited.",
  },
  {
    q: "Do takedown notices go out under our firm's name?",
    a: "Notices are prepared with representative-of-client wording and routed to the right destination — a marketplace reporting portal, an abuse contact, or a UDRP domain complaint — with each one tracked to resolution. You stay in control of what gets sent; HAKKIU does the assembly and the routing.",
  },
  {
    q: "How does pricing work for a firm?",
    a: "You are never charged per detection or per takedown, so a busy enforcement month does not turn into a bigger bill. Exact pricing depends on the number of clients and marks you are watching, and we share it after a demo once we understand what you are protecting.",
  },
];

export const Route = createFileRoute("/solutions/law-firms")({
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
            { "@type": "ListItem", position: 2, name: "For law firms", item: `${COMPANY.baseUrl}${PATH}` },
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
              Monitor marketplaces, domains and the open web for every client from one workspace,
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
              systematically." {COMPANY.brand} closes that gap: continuous monitoring across
              marketplaces, domains and the open web, and timestamped evidence that ends in a filed
              takedown rather than a spreadsheet.
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

        {/* HOW A MATTER MOVES */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              How a client matter moves through {COMPANY.brand}
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              The shape is the same for every client, whether you are watching two marks or two
              hundred. Here is the path a single case takes, start to finish.
            </Reveal>
            <ol className="mt-10 space-y-8">
              {[
                {
                  step: "Onboard the client",
                  body: "Add the client's trademarks and the sellers they have authorized. That becomes their workspace — separate from every other matter you run, so the line between clients is never blurry.",
                },
                {
                  step: "Monitoring runs",
                  body: "HAKKIU watches marketplaces, social commerce, app stores, domain registries and the open web continuously. Each possible match is scored by risk, so the obvious knock-offs and the borderline cases are not treated the same.",
                },
                {
                  step: "You review, not hunt",
                  body: "The evidence is already captured by the time you look. You confirm the ones that matter and dismiss the noise — the associate hours that used to go into manually checking marketplaces are the hours you get back.",
                },
                {
                  step: "The notice goes out",
                  body: "A takedown is prepared with representative-of-client wording and routed to the right marketplace portal, abuse contact or UDRP complaint. Every case is tracked to resolution, so you always know what is outstanding for which client.",
                },
              ].map((item, i) => (
                <Reveal as="li" key={item.step} delay={110 + i * 70} className="flex gap-5">
                  <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full border border-border bg-muted/50 font-mono text-sm font-semibold text-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                      {item.step}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* WHAT THE EVIDENCE LOOKS LIKE */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              What "legal-review-ready" actually means
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              It is a phrase every vendor uses, so here is what sits behind it at {COMPANY.brand}.
              Each detection is captured as high-resolution screenshots, the WHOIS record for the
              domain or listing, and a SHA-256 hash of the captured content stamped with a UTC time.
              The hash is the part that matters to a lawyer: it is a fingerprint of exactly what was
              on that page at that moment, so no one can later argue the screenshot was edited.
              Evidence is stored privately and shared through short-lived signed links, not passed
              around as loose files — which keeps the chain intact if a matter ends up in front of a
              marketplace panel or a court.
            </Reveal>
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
              registries and the open web continuously; see the full{" "}
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

        {/* FAQ */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              Questions IP firms ask us
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
