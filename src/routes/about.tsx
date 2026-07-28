import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/legal-layout";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — HAKKIU" },
      {
        name: "description",
        content:
          "HAKKIU is an EU-based brand-protection platform that helps brand owners and law firms detect infringements and automate takedowns across marketplaces and the open web.",
      },
      { property: "og:title", content: "About HAKKIU" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <LegalLayout
      eyebrow="Company"
      title="About HAKKIU"
      subtitle="Brand protection at internet speed — built for the teams defending real brands."
      showUpdated={false}
    >
      <h2>Our mission</h2>
      <p>
        Counterfeits, copycats, and impersonators spread across marketplaces and the open web faster
        than any team can manually track. {COMPANY.brand} exists to close that gap: we help brand
        owners and the law firms that represent them find infringements the moment they appear and
        act on them without drowning in manual review.
      </p>

      <h2>What we do</h2>
      <p>
        {COMPANY.brand} continuously monitors online marketplaces (such as Amazon, Shopify, eBay and
        Alibaba) and the wider web for listings, domains and content that misuse our customers'
        brands. Our platform combines large-scale scraping with AI vision analysis to score likely
        infringements, capture evidence, and prepare and deliver takedown requests — turning a slow,
        manual enforcement process into a fast, repeatable one.
      </p>
      <ul>
        <li>
          <strong>Detect</strong> — 24/7 monitoring across marketplaces, domains and the open web.
        </li>
        <li>
          <strong>Analyze</strong> — AI-assisted scoring and evidence capture, with a human in the
          loop for consequential decisions.
        </li>
        <li>
          <strong>Act</strong> — prepared takedown documentation and delivery, tracked to resolution.
        </li>
      </ul>

      <h2>Who we build for</h2>
      <p>
        We build for in-house brand and IP teams and for law firms managing enforcement on behalf of
        multiple clients. Our platform supports multi-client, multi-region workflows so a small team
        can protect a large brand footprint.
      </p>

      <h2>Where we are</h2>
      <p>
        {COMPANY.brand} is an EU-established company. Our company details are set out in our{" "}
        <Link to="/legal/imprint">Legal Notice</Link>, and how we handle data is described in our{" "}
        <Link to="/legal/privacy">Privacy Policy</Link> and{" "}
        <Link to="/legal/security">Trust &amp; Security</Link> page.
      </p>

      <h2>Get in touch</h2>
      <p>
        Want to see it in action? <Link to="/request-demo">Book a demo</Link> and our team will
        tailor brand protection to your needs. For anything else, reach us at{" "}
        <a href={`mailto:${COMPANY.email.general}`}>{COMPANY.email.general}</a> or visit our{" "}
        <Link to="/contact">contact page</Link>.
      </p>
    </LegalLayout>
  );
}
