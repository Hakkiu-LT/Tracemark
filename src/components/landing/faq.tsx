import { ChevronDown } from "lucide-react";
import { Reveal } from "./reveal";

/**
 * FAQ (SS7) — plain-language answers to the questions a brand owner or IP
 * lawyer asks before booking a demo. Collapsible (question shown, click to
 * expand) using native <details>/<summary> — chosen over a JS accordion on
 * purpose: <details> keeps the answer text in the server-rendered HTML even
 * while collapsed, so crawlers and LLMs still read every answer and each
 * question stays a passage-extraction anchor. A Radix/JS accordion would
 * unmount collapsed content and hide it from SSR.
 *
 * Every answer here is factual and defensible — sourced from public/llms.txt
 * and the platform description. Do NOT add invented metrics (channel counts
 * beyond "12+", match percentages, per-minute rates); those live only in the
 * decorative product mockups and are not claims.
 *
 * FAQ_ITEMS is exported so index.tsx can build the FAQPage JSON-LD from the
 * same source — the visible copy and the structured data never drift apart.
 */
export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "What is trademark monitoring software?",
    a: "Trademark monitoring software continuously scans marketplaces, social platforms, app stores, domains and the open web for listings, ads and sites that misuse your brand — counterfeits, unauthorized sellers and typosquatting. HAKKIU automates that watch with AI and turns each match into court-ready evidence and a ready-to-send takedown notice.",
  },
  {
    q: "How does HAKKIU detect counterfeit listings?",
    a: "HAKKIU pairs large-scale scanning with AI visual and text matching against your registered trademark portfolio, catching modified logos, typosquats and evasive wording that simple keyword filters miss. Each match is given a 0–100% threat score, and a human reviews consequential decisions before any enforcement is sent.",
  },
  {
    q: "Which marketplaces and channels does HAKKIU monitor?",
    a: "HAKKIU watches 12+ channels around the clock from one workspace — including Amazon, Shopify, eBay, Alibaba, AliExpress and Etsy, plus Instagram, TikTok, Facebook, Meta and Google ads, and web domains — so you don't have to stitch together a separate tool for every platform.",
  },
  {
    q: "What evidence does HAKKIU capture for a takedown?",
    a: "Every detection is preserved as a forensic dossier: high-resolution screenshots, page HTML, WHOIS records and cryptographic SHA-256 timestamps. The chain of custody is tamper-evident and formatted for legal review, so your counsel can act without re-gathering context or chasing screenshots.",
  },
  {
    q: "How does HAKKIU handle takedowns?",
    a: "HAKKIU prepares DMCA and trademark notices with the evidence dossier attached and dispatches them to the right marketplace legal portals and registrars — such as Amazon Brand Registry, Shopify, Google and domain registrars. Every case is then tracked to resolution with a full audit log.",
  },
  {
    q: "How much does HAKKIU cost?",
    a: "Pricing is quote-based and tailored to your brand's footprint after a short demo. There are no self-serve plans, and you're never charged per detection or per takedown — so protecting more of your brand never means an unpredictable bill. Book a demo or talk to sales for a tailored quote.",
  },
];

export function Faq() {
  return (
    <section
      id="faq"
      className="technical-paper relative scroll-mt-16 border-b border-border/60 py-20 md:py-24"
    >
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <Reveal
            as="p"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
          >
            Frequently asked
          </Reveal>
          <Reveal
            as="h2"
            delay={60}
            className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl"
          >
            Questions brand and legal teams ask first.
          </Reveal>
          <Reveal as="p" delay={120} className="mt-4 text-base text-muted-foreground">
            Straight answers on how HAKKIU detects, documents and removes brand abuse — and how
            pricing works — before you book a demo.
          </Reveal>
        </div>

        <div className="mt-12 max-w-3xl">
          {FAQ_ITEMS.map((item, i) => (
            <Reveal
              as="div"
              key={item.q}
              delay={i * 60}
              className="border-t border-border/70 first:border-t-0"
            >
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
                  <h3 className="font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                    {item.q}
                  </h3>
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <p className="-mt-1 pb-6 pr-9 text-base leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
