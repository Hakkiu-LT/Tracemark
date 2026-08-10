import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout, LegalDisclaimer } from "@/components/legal/legal-layout";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/legal/security")({
  head: () => ({
    meta: [
      { title: "Trust & Security — HAKKIU" },
      {
        name: "description",
        content:
          "How HAKKIU protects customer data: hosting, encryption, access control, and responsible disclosure.",
      },
      { property: "og:title", content: "Trust & Security — HAKKIU" },
      {
        property: "og:description",
        content:
          "How HAKKIU protects customer data: hosting, encryption, access control, and responsible disclosure.",
      },
      { name: "twitter:title", content: "Trust & Security — HAKKIU" },
      {
        name: "twitter:description",
        content:
          "How HAKKIU protects customer data: hosting, encryption, access control, and responsible disclosure.",
      },
      { property: "og:url", content: `${COMPANY.baseUrl}/legal/security` },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.baseUrl}/legal/security` }],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <LegalLayout
      eyebrow="Trust"
      title="Trust & Security"
      subtitle="How we protect your data and run the platform responsibly."
    >
      <p>
        Brand owners and law firms trust {COMPANY.brand} with sensitive enforcement data. This page
        summarizes the technical and organizational measures we use to protect it. It also serves as
        Annex B (security measures) to our <Link to="/legal/dpa">Data Processing Agreement</Link>.
      </p>

      <h2>Hosting and data location</h2>
      <ul>
        <li>Core infrastructure is hosted in the EEA (Germany).</li>
        <li>We use Cloudflare for CDN, DNS and edge protection.</li>
        <li>
          A current list of infrastructure providers is on our{" "}
          <Link to="/legal/subprocessors">Sub-processors</Link> page.
        </li>
      </ul>

      <h2>Encryption</h2>
      <ul>
        <li>All traffic is encrypted in transit using TLS (HTTPS), with HSTS enforced.</li>
        <li>Data is encrypted at rest by our hosting and database providers.</li>
      </ul>

      <h2>Access control</h2>
      <ul>
        <li>Least-privilege access; administrative access is restricted and logged.</li>
        <li>Customer data is logically segregated per organization (multi-tenant isolation).</li>
        <li>
          Authentication is handled by a dedicated identity provider; customer logins are
          provisioned by staff.
        </li>
      </ul>

      <h2>Application security</h2>
      <ul>
        <li>
          Security headers (CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) and
          framing protection.
        </li>
        <li>Rate limiting and input validation on public endpoints.</li>
        <li>Internal service endpoints are protected by shared secrets and network controls.</li>
      </ul>

      <h2>Sub-processor vetting</h2>
      <p>
        We engage reputable sub-processors under GDPR-consistent data-protection terms and remain
        responsible for their performance. See <Link to="/legal/subprocessors">Sub-processors</Link>
        .
      </p>

      <h2>Backups and resilience</h2>
      <ul>
        <li>Databases are backed up on a regular schedule.</li>
        <li>We monitor availability and respond to operational incidents.</li>
      </ul>

      <h2>Incident response</h2>
      <p>
        We maintain an incident-response process and will notify affected customers of a
        personal-data breach without undue delay, consistent with the GDPR and our{" "}
        <Link to="/legal/dpa">DPA</Link>.
      </p>

      <h2>Compliance</h2>
      <p>
        {COMPANY.brand} processes personal data in line with the GDPR. As we grow we intend to
        pursue recognized certifications (such as SOC 2 / ISO 27001); this page will be updated when
        they are in place.
      </p>

      <h2>Responsible disclosure</h2>
      <p>
        If you believe you've found a security vulnerability, please report it to{" "}
        <a href={`mailto:${COMPANY.email.security}`}>{COMPANY.email.security}</a>. Please give us a
        reasonable opportunity to investigate and remediate before any public disclosure. We
        appreciate the security community's help and will not pursue good-faith research conducted
        under this policy.
      </p>

      <h2>Request our DPA or security documentation</h2>
      <p>
        Procurement or vendor-review team? Email{" "}
        <a href={`mailto:${COMPANY.email.legal}`}>{COMPANY.email.legal}</a> to request a signed DPA
        or additional security documentation.
      </p>

      <LegalDisclaimer />
    </LegalLayout>
  );
}
