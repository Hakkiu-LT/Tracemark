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
    a: "Trademark monitoring software continuously scans the places a brand can be abused — online marketplaces, social platforms, app stores, domain registries and the open web — for listings, ads and sites that misuse your name, logo or products. It surfaces counterfeits, unauthorized sellers, copycat storefronts and typosquatting domains so your team isn't refreshing search results by hand. HAKKIU automates that watch end to end: AI scans your channels around the clock, scores each likely match, captures the supporting evidence, and prepares a takedown notice formatted for legal review. The aim is to shorten the gap between the moment an infringement appears and the moment it comes down — turning weeks of manual searching into a continuous, repeatable workflow that one small team can run across a large brand footprint.",
  },
  {
    q: "How does HAKKIU detect counterfeit listings?",
    a: "HAKKIU doesn't rely on a single keyword filter. Detection runs as a tiered funnel. First, deterministic checks catch a brand name buried inside longer titles and typosquats using fuzzy text matching and edit-distance. Next, perceptual image hashing compares scraped product and logo images against your reference assets, so a resized, recoloured or lightly edited logo still matches. Finally, for the cases that matter, vision-and-language AI reads the screenshot — titles, descriptions, watermarks and overlaid text — and adjudicates whether it is genuinely infringing. Every match is scored and assigned a risk level, and the AI only ever recommends an action: a person reviews consequential decisions before any takedown is sent. That keeps automation on the slow part — the searching — without removing human judgement from enforcement.",
  },
  {
    q: "Which marketplaces and channels does HAKKIU monitor?",
    a: "HAKKIU monitors 12+ channels from a single workspace, so you're not stitching together a separate tool and login for every platform. Coverage spans major marketplaces (Amazon, eBay, Alibaba, AliExpress, Etsy and Shopify storefronts), social and advertising surfaces (Instagram, TikTok, Facebook, and Meta and Google ads), app stores, Google Shopping, and the web-domain layer where look-alike sites are registered. The important part isn't the list — it's that the watch is continuous rather than a periodic manual sweep, and consolidated: every detection across every channel lands in one case queue with the same scoring, evidence and takedown workflow behind it. Scanning is built to stay lightweight, favouring direct page parsing over heavier rendering, so coverage can expand without the cost rising at the same rate.",
  },
  {
    q: "What evidence does HAKKIU capture for a takedown?",
    a: "Every detection is preserved as a structured evidence dossier, not a loose screenshot. HAKKIU captures a high-resolution screenshot of the infringing listing or page, records the WHOIS registration details for domains (registrar, creation and expiry dates, name servers and registrant country), and stores a SHA-256 hash of the captured content alongside a UTC timestamp. Because each artefact is hashed, the record is tamper-evident — an altered file would no longer match its recorded hash. Screenshots are kept in a private store and shared only through short-lived signed links, and completed-case evidence is retained on a defined schedule rather than indefinitely. Everything is organised and formatted for legal review, so your counsel can act on a case without re-gathering context or chasing down the original listing before it disappears.",
  },
  {
    q: "How does HAKKIU handle takedowns?",
    a: "When a match is confirmed for enforcement, HAKKIU generates a formal DMCA or trademark notice with the evidence dossier attached, using the right wording for your context — brand-owner notices for in-house teams, and representative-of-client language when a law firm acts on a client's behalf. Each notice is routed to the correct destination from a built-in registry of around 40 marketplaces, social networks, ad platforms, app stores, search engines and domain registrars, by the appropriate method: an abuse email, the platform's reporting form, or a UDRP domain complaint. Notices sent by email are dispatched and logged automatically; where a portal requires manual submission, HAKKIU hands you the prepared notice and the exact destination. Every attempt is recorded in an audit log and each case's status is tracked through the workspace.",
  },
  {
    q: "How much does HAKKIU cost?",
    a: "Pricing is quote-based and tailored to your brand's footprint after a short demo — the number of brands, channels and clients you need to cover — rather than published as fixed tiers. There are no self-serve plans; accounts are provisioned by our team once you're set up. The model is deliberately simple in one important way: you are never charged per detection or per takedown. Enforcement volume is unpredictable by nature — a single counterfeit campaign can spawn dozens of listings overnight — so metering it would penalise you exactly when your brand is under the most pressure. Protecting more of your brand should never mean an unpredictable bill. Book a demo or talk to sales and we'll scope a quote to what you actually need to protect.",
  },
  {
    q: "How does HAKKIU compare to other brand protection tools?",
    a: "The brand-protection category includes established enterprise suites such as Red Points, BrandShield and Corsearch, which many large rights-holders use. HAKKIU covers the same core job — detect infringements, capture evidence, and drive takedowns across marketplaces, social, ads and domains — with a few deliberate differences. Pricing is quote-based with no per-detection or per-takedown metering, so cost stays predictable when enforcement volume spikes. The platform is built for both in-house brand teams and IP law firms, with multi-client, multi-region workflows so an agency or firm can run enforcement for several brands in one workspace. And detection combines deterministic matching, perceptual image hashing and vision-language AI rather than keyword alerts alone. The most useful comparison is on your own brand — book a demo and we'll scan your channels live.",
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

        {/* Freshness signal — a visible last-reviewed date reassures readers
            (and AI answer engines) the answers are maintained. Bump when the
            FAQ copy is next reviewed. */}
        <p className="mt-10 max-w-3xl font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Last reviewed: July 2026
        </p>
      </div>
    </section>
  );
}
