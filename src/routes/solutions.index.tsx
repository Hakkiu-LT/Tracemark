import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Scale, Building2 } from "lucide-react";
import { InfiniteGridBackdrop } from "@/components/ui/the-infinite-grid";
import { LandingNav } from "@/components/landing/landing-nav";
import { Footer } from "@/components/landing/footer";
import { Reveal } from "@/components/landing/reveal";
import { useLeadModals } from "@/components/landing/lead-modals";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { COMPANY } from "@/lib/company";

const PATH = "/solutions";
const TITLE = "Solutions — Brand Protection for Brand Owners & Law Firms";
const DESCRIPTION =
  "HAKKIU brand protection built around how you work — for brand owners protecting their own marks, and for IP law firms enforcing across a client portfolio.";

const SOLUTIONS = [
  {
    icon: Building2,
    eyebrow: "For brand owners",
    title: "Protect your own brand",
    body: "Find counterfeit listings, unauthorized sellers and lookalike domains across your marketplaces, social channels and the open web — and prepare the takedowns to remove them.",
    to: "/solutions/brand-owners",
  },
  {
    icon: Scale,
    eyebrow: "For law firms",
    title: "Enforce across a client portfolio",
    body: "One platform to monitor marketplaces and domains for every client, with legal-review-ready evidence and multi-client enforcement workflows.",
    to: "/solutions/law-firms",
  },
] as const;

export const Route = createFileRoute("/solutions/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "HAKKIU Solutions" },
      { property: "og:description", content: DESCRIPTION },
      { name: "twitter:title", content: "HAKKIU Solutions" },
      { name: "twitter:description", content: DESCRIPTION },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
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
            { "@type": "ListItem", position: 2, name: "Solutions", item: `${COMPANY.baseUrl}${PATH}` },
          ],
        },
      },
      { property: "og:url", content: `${COMPANY.baseUrl}${PATH}` },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.baseUrl}${PATH}` }],
  }),
  component: SolutionsIndexPage,
});

function SolutionsIndexPage() {
  const { openDemo } = useLeadModals();

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
              Solutions
            </Reveal>
            <Reveal
              as="h1"
              delay={70}
              className="mt-6 max-w-4xl font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-foreground sm:text-6xl"
            >
              Brand protection, built around how you work
            </Reveal>
            <Reveal
              as="p"
              delay={140}
              className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Whether you protect your own brand or enforce across a portfolio of clients, {COMPANY.brand}{" "}
              finds infringements and prepares the takedowns to remove them — never charged per detection
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
            </Reveal>
          </div>
        </section>

        {/* CHOOSE YOUR PATH */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              Who is it for
            </Reveal>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {SOLUTIONS.map((s, i) => (
                <Reveal key={s.to} delay={120 + i * 70}>
                  <Link
                    to={s.to}
                    className="group flex h-full flex-col rounded-2xl border border-border/80 bg-card/80 p-7 shadow-sm backdrop-blur-sm transition-all hover:border-foreground/40 hover:shadow-md"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
                      <s.icon className="h-5 w-5" />
                    </span>
                    <p className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                      {s.eyebrow}
                    </p>
                    <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-foreground">
                      {s.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                    <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      Learn more
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
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
