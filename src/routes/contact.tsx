import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/legal-layout";
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
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <LegalLayout
      eyebrow="Contact"
      title="Contact us"
      subtitle="We'd love to hear from you. Pick the channel that fits."
      showUpdated={false}
    >
      <h2>Book a demo</h2>
      <p>
        The fastest way to evaluate {COMPANY.brand} is a tailored demo. Tell us about your brand and
        where you see abuse, and we'll show you how detection and takedowns work for your case.
      </p>
      <p>
        → <Link to="/request-demo">Request a demo</Link>
      </p>

      <h2>General enquiries</h2>
      <p>
        For general questions, partnerships or press, email us at{" "}
        <a href={`mailto:${COMPANY.email.general}`}>{COMPANY.email.general}</a>.
      </p>

      <h2>Specialist contacts</h2>
      <ul>
        <li>
          <strong>Privacy &amp; data protection:</strong>{" "}
          <a href={`mailto:${COMPANY.email.privacy}`}>{COMPANY.email.privacy}</a> — data-subject
          requests and questions about our <Link to="/legal/privacy">Privacy Policy</Link>.
        </li>
        <li>
          <strong>Security:</strong>{" "}
          <a href={`mailto:${COMPANY.email.security}`}>{COMPANY.email.security}</a> — report a
          vulnerability or security concern (see <Link to="/legal/security">Trust &amp; Security</Link>).
        </li>
        <li>
          <strong>Legal:</strong> <a href={`mailto:${COMPANY.email.legal}`}>{COMPANY.email.legal}</a>{" "}
          — contracts, DPAs and legal notices.
        </li>
        <li>
          <strong>Support:</strong>{" "}
          <a href={`mailto:${COMPANY.email.support}`}>{COMPANY.email.support}</a> — existing
          customers.
        </li>
      </ul>

      <h2>Company details</h2>
      <p>
        {COMPANY.brand} is an EU-established company. Company details are on our{" "}
        <Link to="/legal/imprint">Legal Notice</Link> page.
      </p>
    </LegalLayout>
  );
}
