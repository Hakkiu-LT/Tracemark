import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout, LegalDisclaimer } from "@/components/legal/legal-layout";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/legal/subprocessors")({
  head: () => ({
    meta: [
      { title: "Sub-processors — HAKKIU" },
      { name: "description", content: "The third-party sub-processors HAKKIU uses to deliver the Service." },
      { property: "og:url", content: `${COMPANY.baseUrl}/legal/subprocessors` },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.baseUrl}/legal/subprocessors` }],
  }),
  component: SubprocessorsPage,
});

type Row = {
  name: string;
  purpose: string;
  data: string;
  location: string;
  transfer: string;
};

const SUBPROCESSORS: Row[] = [
  {
    name: "Supabase",
    purpose: "Database, authentication and application data hosting",
    data: "Account, authentication and platform data",
    location: "EU / US (region-dependent)",
    transfer: "SCCs / EU–US DPF where applicable",
  },
  {
    name: "Hetzner Online GmbH",
    purpose: "Server / application hosting",
    data: "Application data, logs",
    location: "Germany (EEA)",
    transfer: "Within the EEA",
  },
  {
    name: "Cloudflare",
    purpose: "CDN, DNS and edge security",
    data: "Network / request metadata",
    location: "Global / US",
    transfer: "SCCs / EU–US DPF",
  },
  {
    name: "Resend",
    purpose: "Transactional and notification email",
    data: "Recipient email address and message content",
    location: "US",
    transfer: "SCCs / EU–US DPF",
  },
  {
    name: "Google (Gemini API)",
    purpose: "AI vision analysis of monitored content",
    data: "Content submitted for analysis (may include images/text)",
    location: "US",
    transfer: "SCCs / EU–US DPF",
  },
  {
    name: "Firecrawl",
    purpose: "Web scraping / content retrieval",
    data: "Public web content retrieved for monitoring",
    location: "United States",
    transfer: "SCCs / EU–US DPF",
  },
  {
    name: "Google Analytics",
    purpose: "Website analytics (consent-based)",
    data: "Pseudonymous usage and device data",
    location: "US",
    transfer: "SCCs / EU–US DPF (consent required)",
  },
];

function SubprocessorsPage() {
  return (
    <LegalLayout
      title="Sub-processors"
      subtitle="Third parties we engage to help deliver the Service, with their purpose and location."
    >
      <p>
        {COMPANY.brand} engages the sub-processors below to provide the Service. Each is bound by data
        protection terms consistent with the GDPR, and {COMPANY.brand} remains responsible for their
        performance. This list supplements our{" "}
        <Link to="/legal/dpa">Data Processing Agreement</Link>.
      </p>

      <table>
        <thead>
          <tr>
            <th>Sub-processor</th>
            <th>Purpose</th>
            <th>Data processed</th>
            <th>Location</th>
            <th>Transfer safeguard</th>
          </tr>
        </thead>
        <tbody>
          {SUBPROCESSORS.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td>{r.purpose}</td>
              <td>{r.data}</td>
              <td>{r.location}</td>
              <td>{r.transfer}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Changes and notifications</h2>
      <p>
        We may update this list as our providers change. Customers can request advance notice of new
        sub-processors and may object on reasonable data-protection grounds. To receive change
        notifications or to raise an objection, email{" "}
        <a href={`mailto:${COMPANY.email.privacy}`}>{COMPANY.email.privacy}</a>.
      </p>

      <LegalDisclaimer />
    </LegalLayout>
  );
}
