import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Lock, Shield, Scale, LifeBuoy, Mail, Building2 } from "lucide-react";
import { InfiniteGridBackdrop } from "@/components/ui/the-infinite-grid";
import { LandingNav } from "@/components/landing/landing-nav";
import { Footer } from "@/components/landing/footer";
import { Reveal } from "@/components/landing/reveal";
import { useLeadModals } from "@/components/landing/lead-modals";
import { RainbowButton } from "@/components/ui/rainbow-button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — HAKKIU" },
      {
        name: "description",
        content: "Get in touch with HAKKIU — book a demo, ask about the platform, or reach our privacy, security and legal teams.",
      },
      { property: "og:title", content: "Contact HAKKIU" },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "ContactPage",
          "@id": `${COMPANY.baseUrl}/contact#webpage`,
          url: `${COMPANY.baseUrl}/contact`,
          name: "Contact HAKKIU",
          description:
            "Get in touch with HAKKIU — book a demo, ask about the platform, or reach our privacy, security and legal teams.",
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
            { "@type": "ListItem", position: 2, name: "Contact", item: `${COMPANY.baseUrl}/contact` },
          ],
        },
      },
      { property: "og:url", content: `${COMPANY.baseUrl}/contact` },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.baseUrl}/contact` }],
  }),
  component: ContactPage,
});

const SPECIALIST_CONTACTS = [
  {
    icon: Lock,
    label: "Privacy & data protection",
    email: COMPANY.email.privacy,
    description: "Data-subject requests and questions about our Privacy Policy.",
  },
  {
    icon: Shield,
    label: "Security",
    email: COMPANY.email.security,
    description: "Report a vulnerability or security concern (see Trust & Security).",
  },
  {
    icon: Scale,
    label: "Legal",
    email: COMPANY.email.legal,
    description: "Contracts, DPAs and legal notices.",
  },
  {
    icon: LifeBuoy,
    label: "Support",
    email: COMPANY.email.support,
    description: "For existing customers.",
  },
];

function ContactPage() {
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
              Contact
            </Reveal>

            <Reveal
              as="h1"
              delay={70}
              className="mt-6 max-w-4xl font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-foreground sm:text-6xl"
            >
              Contact us
            </Reveal>

            <Reveal
              as="p"
              delay={140}
              className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              The fastest way to evaluate {COMPANY.brand} is a tailored demo. Tell us about your
              brand and where you see abuse, and we'll show you how detection and takedowns work for
              your case.
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

        {/* SPECIALIST CONTACTS */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal
              as="p"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              Specialist contacts
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              Pick the channel that fits. Each inbox is monitored by the team that owns it.
            </Reveal>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {SPECIALIST_CONTACTS.map((item, i) => (
                <Reveal key={item.label} delay={120 + i * 60}>
                  <Card className="h-full bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
                        <item.icon className="h-5 w-5" />
                      </span>
                      <CardTitle className="mt-4 text-base font-bold">{item.label}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
                        {item.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <a
                        href={`mailto:${item.email}`}
                        className="text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline"
                      >
                        {item.email}
                      </a>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* GENERAL ENQUIRIES + COMPANY DETAILS */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Reveal>
                <Card className="h-full bg-card/80 backdrop-blur-sm">
                  <CardHeader>
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
                      <Mail className="h-5 w-5" />
                    </span>
                    <CardTitle className="mt-4 text-base font-bold">General enquiries</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      For general questions, partnerships or press.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a
                      href={`mailto:${COMPANY.email.general}`}
                      className="text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline"
                    >
                      {COMPANY.email.general}
                    </a>
                  </CardContent>
                </Card>
              </Reveal>

              <Reveal delay={70}>
                <Card className="h-full bg-card/80 backdrop-blur-sm">
                  <CardHeader>
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <CardTitle className="mt-4 text-base font-bold">Company details</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {COMPANY.brand} is an EU-established company. Company details are on our Legal
                      Notice page.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link
                      to="/legal/imprint"
                      className="text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline"
                    >
                      View Legal Notice
                    </Link>
                  </CardContent>
                </Card>
              </Reveal>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
