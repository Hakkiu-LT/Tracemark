import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout, LegalDisclaimer } from "@/components/legal/legal-layout";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/legal/dpa")({
  head: () => ({
    meta: [
      { title: "Data Processing Agreement — HAKKIU" },
      {
        name: "description",
        content: "HAKKIU's Data Processing Agreement (GDPR Article 28) for customer personal data.",
      },
      { property: "og:title", content: "Data Processing Agreement — HAKKIU" },
      {
        property: "og:description",
        content: "HAKKIU's Data Processing Agreement (GDPR Article 28) for customer personal data.",
      },
      { name: "twitter:title", content: "Data Processing Agreement — HAKKIU" },
      {
        name: "twitter:description",
        content: "HAKKIU's Data Processing Agreement (GDPR Article 28) for customer personal data.",
      },
      { property: "og:url", content: `${COMPANY.baseUrl}/legal/dpa` },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.baseUrl}/legal/dpa` }],
  }),
  component: DpaPage,
});

function DpaPage() {
  return (
    <LegalLayout
      title="Data Processing Agreement"
      subtitle="Governs personal data that HAKKIU processes on behalf of its customers, under GDPR Article 28."
    >
      <p>
        This Data Processing Agreement ("DPA") forms part of the agreement between the customer
        ("Controller") and {COMPANY.legalName} ("{COMPANY.brand}", "Processor") for use of the
        Service. It applies where {COMPANY.brand} processes personal data on the Controller's
        behalf. A countersigned copy is available on request from{" "}
        <a href={`mailto:${COMPANY.email.legal}`}>{COMPANY.email.legal}</a>.
      </p>

      <h2>1. Roles</h2>
      <p>
        The Controller determines the purposes and means of processing Customer Data.{" "}
        {COMPANY.brand}
        acts as Processor and processes personal data only on the Controller's documented
        instructions, including as set out in the agreement and this DPA.
      </p>

      <h2>2. Subject matter, nature and purpose</h2>
      <p>
        The processing consists of hosting, monitoring, detection, AI analysis, evidence capture and
        takedown support provided through the Service, for the duration of the agreement.
      </p>

      <h2>3. Types of data and categories of data subjects</h2>
      <ul>
        <li>
          <strong>Data subjects:</strong> the Controller's authorized users; and individuals
          appearing in monitored content (e.g. sellers or others associated with potentially
          infringing listings).
        </li>
        <li>
          <strong>Types of data:</strong> contact and account data; marketplace/listing data; and
          any personal data contained in content submitted to or retrieved by the Service.
        </li>
      </ul>

      <h2>4. Processor obligations (Art. 28(3))</h2>
      <ul>
        <li>
          <strong>Instructions</strong> — process personal data only on the Controller's documented
          instructions, including for international transfers, unless required by law (in which case
          we notify the Controller where permitted).
        </li>
        <li>
          <strong>Confidentiality</strong> — ensure persons authorized to process the data are bound
          by confidentiality.
        </li>
        <li>
          <strong>Security</strong> — implement appropriate technical and organizational measures
          under Art. 32 (see our <Link to="/legal/security">Trust &amp; Security</Link> page).
        </li>
        <li>
          <strong>Sub-processing</strong> — the Controller grants general authorization to engage
          sub-processors listed on our <Link to="/legal/subprocessors">Sub-processors</Link> page;
          we impose equivalent data-protection obligations on them, remain liable for their
          performance, and give notice of changes with an opportunity to object.
        </li>
        <li>
          <strong>Data-subject requests</strong> — assist the Controller, by appropriate measures,
          in responding to data-subject rights requests.
        </li>
        <li>
          <strong>Assistance</strong> — assist the Controller with security, breach notification,
          data-protection impact assessments and prior consultation (Art. 32–36).
        </li>
        <li>
          <strong>Breach notification</strong> — notify the Controller without undue delay after
          becoming aware of a personal-data breach.
        </li>
        <li>
          <strong>Deletion or return</strong> — at the Controller's choice, delete or return
          personal data at the end of the services, unless retention is required by law.
        </li>
        <li>
          <strong>Audits</strong> — make available information necessary to demonstrate compliance
          and allow for and contribute to audits, subject to reasonable confidentiality and security
          conditions.
        </li>
      </ul>

      <h2>5. International transfers</h2>
      <p>
        Where personal data is transferred outside the EEA, the transfer is protected by appropriate
        safeguards — the EU–US Data Privacy Framework and/or the European Commission's Standard
        Contractual Clauses, which are incorporated by reference where they apply.
      </p>

      <h2>6. Liability and precedence</h2>
      <p>
        Liability under this DPA is subject to the limitations in the agreement. In case of conflict
        between this DPA and the agreement on data-protection matters, this DPA prevails.
      </p>

      <h2>7. Annexes</h2>
      <ul>
        <li>
          <strong>Annex A — Processing details:</strong> as described in sections 2–3 above.
        </li>
        <li>
          <strong>Annex B — Technical &amp; organizational measures:</strong> see{" "}
          <Link to="/legal/security">Trust &amp; Security</Link>.
        </li>
        <li>
          <strong>Annex C — Sub-processors:</strong> see{" "}
          <Link to="/legal/subprocessors">Sub-processors</Link>.
        </li>
        <li>
          <strong>Annex D — Standard Contractual Clauses:</strong> available on request where
          transfers require them.
        </li>
      </ul>

      <h2>8. Contact</h2>
      <p>
        To request a signed DPA or discuss data-processing terms, contact{" "}
        <a href={`mailto:${COMPANY.email.legal}`}>{COMPANY.email.legal}</a>.
      </p>

      <LegalDisclaimer />
    </LegalLayout>
  );
}
