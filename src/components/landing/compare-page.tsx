import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Minus } from "lucide-react";
import { InfiniteGridBackdrop } from "@/components/ui/the-infinite-grid";
import { LandingNav } from "@/components/landing/landing-nav";
import { Footer } from "@/components/landing/footer";
import { Reveal } from "@/components/landing/reveal";
import { useLeadModals } from "@/components/landing/lead-modals";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/lib/company";

/**
 * Shared layout for the /compare/* pages. All three competitor pages
 * (Red Points, BrandShield, Corsearch) share the same skeleton — hero,
 * a fair "who they're best for" note, a factual side-by-side table, honest
 * reasons-to-consider, and a CTA — so the markup lives here once and each
 * route file only supplies verified data.
 *
 * TRUTHFULNESS RULE: every row/claim must be verifiable from the competitor's
 * OWN public site (checked July 2026). Cells that a competitor doesn't publish
 * are marked "Not published", never guessed. See the disclaimer footnote.
 */

/** One row of the comparison table. A cell can be a boolean (→ check / dash),
 *  or a string for a short factual value. */
export type CompareRow = {
  feature: string;
  hakkiu: string | boolean;
  competitor: string | boolean;
};

/** One question/answer pair. Rendered as a visible FAQ and also serialized to
 *  FAQPage JSON-LD in the route's head(). */
export type CompareFaq = { q: string; a: string };

export type ComparePageData = {
  /** Competitor display name, e.g. "Red Points". */
  competitor: string;
  /** Hero subheadline — one honest positioning sentence. */
  subhead: string;
  /** A fair paragraph on who the competitor is genuinely best for (E-E-A-T). */
  fairAssessment: string;
  /** The side-by-side rows. */
  rows: CompareRow[];
  /** Honest reasons a brand might pick HAKKIU (no competitor bashing). */
  reasons: { title: string; body: string }[];
  /** The plain-spoken "pick this one if…" verdict for each side. */
  verdict: { competitorFit: string; hakkiuFit: string };
  /** 3–5 real buyer questions, answered honestly. Also drives FAQPage schema. */
  faqs: CompareFaq[];
  /** Optional extra note appended to the disclaimer (e.g. HQ caveats). */
  extraNote?: string;
};

/** Questions worth asking ANY brand-protection vendor before you sign — the
 *  same list regardless of who you're comparing, so it lives here once. */
const BUYER_QUESTIONS = [
  "When you find something, what evidence do you actually capture — and would it survive a marketplace appeal or a lawyer reading it later?",
  "What counts as a “takedown,” and does my invoice move if we have a bad month with a lot of them?",
  "Where does our data live, who on your side can open it, and can we get it out again?",
  "How much of the detection is a model, and at what point does a human look before a notice goes out?",
  "Which channels are in the base price, and which ones are an upsell later?",
  "What do the first two weeks look like after we sign — who does the setup, us or you?",
];

function Cell({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="mx-auto h-4 w-4 text-[var(--mint,#18c889)]" aria-label="Yes" />;
  }
  if (value === false) {
    return <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-label="No" />;
  }
  return <span className="text-sm text-foreground">{value}</span>;
}

export function ComparePage({ data }: { data: ComparePageData }) {
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
              {COMPANY.brand} vs {data.competitor}
            </Reveal>

            <Reveal
              as="h1"
              delay={70}
              className="mt-6 max-w-4xl font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-foreground sm:text-6xl"
            >
              {COMPANY.brand} vs {data.competitor}: an honest comparison
            </Reveal>

            <Reveal
              as="p"
              delay={140}
              className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              {data.subhead}
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

        {/* FAIR ASSESSMENT — who the competitor is best for */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              Where {data.competitor} fits
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              {data.fairAssessment}
            </Reveal>
          </div>
        </section>

        {/* COMPARISON TABLE */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              Side by side
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              Every figure below is taken from each vendor's own public website as of July 2026.
              Where a vendor does not publish a detail, we mark it{" "}
              <span className="font-medium text-foreground">Not published</span> rather than guess.
            </Reveal>

            <Reveal delay={120} className="mt-10 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 pr-4 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Capability
                    </th>
                    <th className="px-4 py-3 text-center font-display text-sm font-bold tracking-tight text-foreground">
                      {COMPANY.brand}
                    </th>
                    <th className="px-4 py-3 text-center font-display text-sm font-bold tracking-tight text-muted-foreground">
                      {data.competitor}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.feature} className="border-b border-border/60">
                      <td className="py-4 pr-4 text-sm font-medium text-foreground">
                        {row.feature}
                      </td>
                      <td className="px-4 py-4 text-center align-top">
                        <Cell value={row.hakkiu} />
                      </td>
                      <td className="px-4 py-4 text-center align-top">
                        <Cell value={row.competitor} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </div>
        </section>

        {/* REASONS TO CONSIDER HAKKIU */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              Why teams consider {COMPANY.brand}
            </Reveal>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {data.reasons.map((reason, i) => (
                <Reveal key={reason.title} delay={120 + i * 70}>
                  <div className="h-full rounded-2xl border border-border/80 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
                    <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                      {reason.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {reason.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* THE HONEST VERDICT — pick-this-one-if */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              So which one should you pick?
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              Neither of these is the "right" answer for everyone, and we're not going to pretend
              otherwise. Here is the short version of who each tool actually suits.
            </Reveal>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <Reveal delay={120}>
                <div className="h-full rounded-2xl border border-border/80 bg-card/60 p-6 shadow-sm backdrop-blur-sm">
                  <h3 className="font-display text-lg font-bold tracking-tight text-muted-foreground">
                    Stay with {data.competitor} if…
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {data.verdict.competitorFit}
                  </p>
                </div>
              </Reveal>
              <Reveal delay={190}>
                <div className="h-full rounded-2xl border border-foreground/20 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
                  <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                    Look at {COMPANY.brand} if…
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {data.verdict.hakkiuFit}
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* QUESTIONS TO ASK ANY VENDOR */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              Questions to ask on any demo
            </Reveal>
            <Reveal
              as="p"
              delay={70}
              className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground"
            >
              Take these into a call with us, with {data.competitor}, or with anyone else. The answers
              tell you more than a feature grid does.
            </Reveal>
            <ol className="mt-8 max-w-3xl space-y-4">
              {BUYER_QUESTIONS.map((q, i) => (
                <Reveal as="li" key={q} delay={110 + i * 50} className="flex gap-4">
                  <span className="font-mono text-sm font-semibold text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm leading-relaxed text-foreground">{q}</span>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal
              as="h2"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
            >
              {COMPANY.brand} vs {data.competitor} — common questions
            </Reveal>
            <div className="mt-10 max-w-3xl divide-y divide-border/60">
              {data.faqs.map((faq, i) => (
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

        {/* CTA */}
        <section className="technical-paper relative border-b border-border/60 py-20 md:py-24">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <Reveal
              as="h2"
              className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            >
              See {COMPANY.brand} on your own brand
            </Reveal>
            <Reveal as="p" delay={70} className="mt-4 text-base leading-relaxed text-muted-foreground">
              Book a demo and we'll show you exactly what {COMPANY.brand} detects across your
              marketplaces, domains and the open web — no obligation. Prefer to read more? See{" "}
              <Link
                to="/solutions/brand-owners"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                HAKKIU for brand owners
              </Link>{" "}
              or{" "}
              <Link
                to="/solutions/law-firms"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                for law firms
              </Link>
              .
            </Reveal>
            <Reveal delay={140} className="mt-8 flex flex-wrap items-center justify-center gap-3">
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

            {/* Disclaimer — legal hygiene + E-E-A-T */}
            <Reveal delay={200} className="mt-12">
              <p className="mx-auto max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
                Comparison based on each vendor's public website as of July 2026. {data.competitor}{" "}
                is a trademark of its respective owner; this page is provided for comparison purposes
                only and is not endorsed by {data.competitor}. {COMPANY.brand} and {data.competitor}{" "}
                both provide pricing on request.{data.extraNote ? ` ${data.extraNote}` : ""}
              </p>
            </Reveal>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
