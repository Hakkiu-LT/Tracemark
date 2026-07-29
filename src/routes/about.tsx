import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ScanSearch, Sparkles, Gavel, Building2, Scale, Linkedin } from "lucide-react";
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
import { COMPANY, TEAM } from "@/lib/company";

/** Two-letter (or one, for single names) monogram for the avatar fallback. */
function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About HAKKIU — EU Brand Protection for IP Teams" },
      {
        name: "description",
        content:
          "HAKKIU is an EU-based brand-protection platform that helps brand owners and law firms detect infringements and automate takedowns across marketplaces and the open web.",
      },
      { property: "og:title", content: "About HAKKIU" },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "@id": `${COMPANY.baseUrl}/about#webpage`,
          url: `${COMPANY.baseUrl}/about`,
          name: "About HAKKIU",
          description:
            "HAKKIU is an EU-based brand-protection platform that helps brand owners and law firms detect infringements and automate takedowns across marketplaces and the open web.",
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
            { "@type": "ListItem", position: 2, name: "About", item: `${COMPANY.baseUrl}/about` },
          ],
        },
      },
      { property: "og:url", content: `${COMPANY.baseUrl}/about` },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.baseUrl}/about` }],
  }),
  component: AboutPage,
});

const WHAT_WE_DO = [
  {
    icon: ScanSearch,
    title: "Detect",
    body: "24/7 monitoring across marketplaces, domains and the open web.",
  },
  {
    icon: Sparkles,
    title: "Analyze",
    body: "AI-assisted scoring and evidence capture, with a human in the loop for consequential decisions.",
  },
  {
    icon: Gavel,
    title: "Act",
    body: "Prepared takedown documentation and delivery, tracked to resolution.",
  },
];

const AUDIENCES = [
  {
    icon: Building2,
    title: "In-house brand & IP teams",
    body: "Protect a large brand footprint with a small team. Multi-region workflows keep detection, evidence and takedowns in one workspace.",
  },
  {
    icon: Scale,
    title: "Law firms",
    body: "Manage enforcement on behalf of multiple clients. Multi-client workflows keep each matter organized and defensible.",
  },
];

function AboutPage() {
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
              Company
            </Reveal>

            <Reveal
              as="h1"
              delay={70}
              className="mt-6 max-w-4xl font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-foreground sm:text-6xl"
            >
              About {COMPANY.brand}
            </Reveal>

            <Reveal
              as="p"
              delay={140}
              className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Brand protection at internet speed — built for the teams defending real brands.
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

        {/* OUR MISSION */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              Our mission
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl font-display text-2xl leading-snug tracking-tight text-foreground sm:text-3xl"
            >
              Counterfeits, copycats, and impersonators spread across marketplaces and the open web
              faster than any team can manually track.
            </Reveal>
            <Reveal
              as="p"
              delay={140}
              className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              {COMPANY.brand} exists to close that gap: we help brand owners and the law firms that
              represent them find infringements the moment they appear and act on them without
              drowning in manual review. We believe enforcement should be fast, evidence-based and
              defensible — so brand and legal teams can protect their reputation without scaling
              headcount to match the problem.
            </Reveal>
          </div>
        </section>

        {/* WHAT WE DO */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              What we do
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              {COMPANY.brand} continuously monitors online marketplaces (such as Amazon, Shopify,
              eBay and Alibaba) and the wider web for listings, domains and content that misuse our
              customers' brands. Our platform combines large-scale scanning with AI vision-and-text
              analysis to score likely infringements, capture evidence, and prepare and route
              takedown requests — turning a slow, manual enforcement process into a fast, repeatable
              one. We watch more than a dozen channels around the clock; see the full list on our{" "}
              <Link
                to="/"
                hash="coverage"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                coverage overview
              </Link>
              .
            </Reveal>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {WHAT_WE_DO.map((item, i) => (
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

        {/* WHO WE BUILD FOR */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              Who we build for
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              We build for in-house brand and IP teams and for law firms managing enforcement on
              behalf of multiple clients. Our platform supports multi-client, multi-region workflows
              so a small team can protect a large brand footprint. Whether you defend a single
              flagship brand or manage enforcement across many clients, {COMPANY.brand} keeps
              detection, evidence and takedowns in one auditable workspace.
            </Reveal>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {AUDIENCES.map((item, i) => (
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

        {/* HOW IT WORKS */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              How it works
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              Getting protected takes three steps. You connect your registered trademarks, logos and
              authorized sellers once; our AI then scans your channels continuously, scores every
              match, and captures tamper-evident evidence; and when something infringes, a DMCA or
              trademark notice goes out with that evidence attached while each case is tracked to
              resolution. You can{" "}
              <Link
                to="/"
                hash="how"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                see the full workflow
              </Link>{" "}
              and{" "}
              <Link
                to="/"
                hash="features"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                explore the platform
              </Link>{" "}
              on our homepage.
            </Reveal>
          </div>
        </section>

        {/* THE TEAM */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              The team
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              Founded in {COMPANY.foundedYear}, {COMPANY.brand} is built by a small, hands-on team
              working across detection, AI and enforcement — the same people who build the platform
              talk to the brand owners and law firms who use it. Connect with any of us on LinkedIn.
            </Reveal>

            <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
              {TEAM.map((member, i) => (
                <Reveal as="li" key={member.name} delay={120 + i * 60}>
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-center text-center"
                    aria-label={`${member.name} on LinkedIn`}
                  >
                    {member.photo ? (
                      <img
                        src={member.photo}
                        alt={member.name}
                        width={80}
                        height={80}
                        loading="lazy"
                        className="h-20 w-20 rounded-full border border-border object-cover shadow-sm transition-all group-hover:border-foreground/40 group-hover:shadow-md"
                      />
                    ) : (
                      <span className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-muted/50 font-display text-xl font-bold tracking-tight text-foreground shadow-sm transition-all group-hover:border-foreground/40 group-hover:shadow-md">
                        {initials(member.name)}
                      </span>
                    )}
                    <span className="mt-4 font-display text-base font-semibold tracking-tight text-foreground">
                      {member.name}
                    </span>
                    <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                      <Linkedin className="h-3.5 w-3.5" />
                      LinkedIn
                    </span>
                  </a>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* WHERE WE ARE */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              Where we are
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              {COMPANY.brand} is an EU-based company headquartered in Kaunas, Lithuania, and we
              build for the standards European brand and legal teams expect. Our core infrastructure
              is hosted in the EEA and we process personal data in line with the GDPR — you can read
              how in our{" "}
              <Link
                to="/legal/security"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                Trust &amp; Security
              </Link>{" "}
              overview, our{" "}
              <Link
                to="/legal/privacy"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                Privacy Policy
              </Link>{" "}
              and our{" "}
              <Link
                to="/legal/dpa"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                Data Processing Agreement
              </Link>
              . Full company details are set out in our{" "}
              <Link
                to="/legal/imprint"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                Legal Notice
              </Link>
              .
            </Reveal>

            <Reveal delay={140} className="mt-10">
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Want to see it in action?</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Book a demo and our team will tailor brand protection to your needs. For anything
                    else, reach us at{" "}
                    <a
                      href={`mailto:${COMPANY.email.general}`}
                      className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
                    >
                      {COMPANY.email.general}
                    </a>{" "}
                    or visit our{" "}
                    <Link
                      to="/contact"
                      className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
                    >
                      contact page
                    </Link>
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
