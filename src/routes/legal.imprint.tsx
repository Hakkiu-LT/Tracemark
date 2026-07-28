import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/legal-layout";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/legal/imprint")({
  head: () => ({
    meta: [
      { title: "Legal Notice / Imprint — HAKKIU" },
      { name: "description", content: "Company identification and legal notice for HAKKIU." },
    ],
  }),
  component: ImprintPage,
});

function ImprintPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Legal Notice / Imprint"
      subtitle="Provider identification pursuant to the EU E-Commerce Directive (2000/31/EC) and Lithuanian implementing law."
    >
      <h2>Company</h2>
      <table>
        <tbody>
          <tr>
            <th>Name</th>
            <td>{COMPANY.brand}</td>
          </tr>
          {COMPANY.registrationCode ? (
            <tr>
              <th>Registration code</th>
              <td>{COMPANY.registrationCode}</td>
            </tr>
          ) : null}
          {COMPANY.vatNumber ? (
            <tr>
              <th>VAT number</th>
              <td>{COMPANY.vatNumber}</td>
            </tr>
          ) : null}
          {COMPANY.address.line1 ? (
            <tr>
              <th>Registered office</th>
              <td>
                {COMPANY.address.line1}, {COMPANY.address.postalCode} {COMPANY.address.city},{" "}
                {COMPANY.address.country}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {!COMPANY.registrationCode ? (
        <p>
          Full company registration details (registered legal entity, registration number and
          registered office) will be published here once finalized.
        </p>
      ) : null}

      <h2>Contact</h2>
      <table>
        <tbody>
          <tr>
            <th>Email</th>
            <td>
              <a href={`mailto:${COMPANY.email.general}`}>{COMPANY.email.general}</a>
            </td>
          </tr>
          {COMPANY.phone ? (
            <tr>
              <th>Phone</th>
              <td>{COMPANY.phone}</td>
            </tr>
          ) : null}
          <tr>
            <th>Website</th>
            <td>{COMPANY.baseUrl}</td>
          </tr>
        </tbody>
      </table>

      <h2>Data protection</h2>
      <p>
        Questions about personal data can be directed to{" "}
        <a href={`mailto:${COMPANY.email.privacy}`}>{COMPANY.email.privacy}</a>. Our data-protection
        supervisory authority is the {COMPANY.supervisoryAuthority.name},{" "}
        {COMPANY.supervisoryAuthority.country} (
        <a href={COMPANY.supervisoryAuthority.url} target="_blank" rel="noopener noreferrer">
          {COMPANY.supervisoryAuthority.url}
        </a>
        ). See our <a href="/legal/privacy">Privacy Policy</a> for details.
      </p>

      <h2>Responsibility for content</h2>
      <p>
        {COMPANY.legalName} is responsible for the content of this website. While we take care to keep
        information accurate and up to date, we accept no liability for the content of external
        websites linked from here; responsibility for linked content rests with their respective
        operators.
      </p>
    </LegalLayout>
  );
}
