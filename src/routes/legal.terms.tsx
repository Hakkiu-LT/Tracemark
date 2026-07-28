import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout, LegalDisclaimer } from "@/components/legal/legal-layout";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — HAKKIU" },
      { name: "description", content: "The terms governing use of the HAKKIU website and platform." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="The agreement between you and HAKKIU for use of our website and platform."
    >
      <h2>1. Agreement</h2>
      <p>
        These Terms of Service ("Terms") govern your access to and use of the {COMPANY.brand} website
        and platform (the "Service") provided by {COMPANY.legalName} ("{COMPANY.brand}", "we", "us").
        By using the Service, or by accepting an order form or quote that references these Terms, you
        agree to them. If you use the Service on behalf of an organization, you confirm you are
        authorized to bind that organization.
      </p>

      <h2>2. Definitions</h2>
      <ul>
        <li><strong>Customer</strong> — the organization that subscribes to the Service.</li>
        <li><strong>User</strong> — an individual authorized to access the Service.</li>
        <li><strong>Customer Data</strong> — data and content you submit to or generate through the Service.</li>
        <li><strong>Detection</strong> — a listing, domain or item the Service flags as a possible infringement.</li>
        <li><strong>Takedown</strong> — a request to remove or disable allegedly infringing material.</li>
      </ul>

      <h2>3. Eligibility and accounts</h2>
      <p>
        The Service is intended for business use. Customer logins are provisioned by {COMPANY.brand};
        you are responsible for keeping credentials secure and for all activity under your account,
        and must notify us promptly of any unauthorized use.
      </p>

      <h2>4. The Service — and its limits</h2>
      <p>
        {COMPANY.brand} provides monitoring, detection assistance, evidence capture and takedown
        support. <strong>Important:</strong> the Service assists brand-protection work; it does{" "}
        <strong>not</strong> constitute legal advice and does not guarantee that infringements will be
        detected or that any takedown will succeed. AI-generated results may be incomplete or
        inaccurate. You are responsible for reviewing Detections and for deciding whether to act on
        them.
      </p>

      <h2>5. Your responsibilities and warranties</h2>
      <ul>
        <li>you own or are authorized to assert the trademarks, brands and rights you monitor;</li>
        <li>
          you will not use the Service to submit bad-faith, abusive or knowingly false takedown
          notices, or to harass or unfairly target competitors;
        </li>
        <li>you will use the Service lawfully and in line with our <Link to="/legal/acceptable-use">Acceptable Use Policy</Link>, which is incorporated into these Terms; and</li>
        <li>you are responsible for the accuracy of information you provide and for the legitimacy of any enforcement action you authorize.</li>
      </ul>

      <h2>6. Fees</h2>
      <p>
        Access is provided under the commercial terms agreed in your order form or quote, which govern
        fees and payment. Where no separate terms apply, use is subject to the plan communicated to
        you.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        {COMPANY.brand} and its licensors own all rights in the Service, including its software,
        models, and design. You retain all rights in your Customer Data. You grant {COMPANY.brand} a
        non-exclusive license to host, process and analyze Customer Data (including running AI
        analysis on it) solely to provide and improve the Service.
      </p>

      <h2>8. Third-party services and marketplaces</h2>
      <p>
        The Service interacts with third-party marketplaces, registrars and platforms that we do not
        control. Their availability, policies and outcomes are outside our control, and we are not
        responsible for their acts or omissions.
      </p>

      <h2>9. Data protection</h2>
      <p>
        Our handling of personal data is described in our <Link to="/legal/privacy">Privacy Policy</Link>.
        Where we process personal data on your behalf, our <Link to="/legal/dpa">Data Processing
        Agreement</Link> applies and is incorporated into these Terms.
      </p>

      <h2>10. Confidentiality</h2>
      <p>
        Each party will protect the other's confidential information and use it only as needed to
        perform under these Terms.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        The Service is provided "as is" and "as available". To the maximum extent permitted by law,
        we disclaim all warranties, express or implied, including merchantability, fitness for a
        particular purpose, and non-infringement, and we do not warrant that the Service will be
        uninterrupted, error-free, or that it will detect or remove any particular infringement.
      </p>

      <h2>12. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, neither party is liable for indirect, incidental,
        special, consequential or punitive damages, or lost profits or revenue. Our total aggregate
        liability arising out of or relating to the Service is limited to the fees paid by the
        Customer for the Service in the twelve (12) months before the event giving rise to the claim.
        Nothing limits liability that cannot be limited under applicable law.
      </p>

      <h2>13. Indemnification</h2>
      <p>
        You will indemnify and hold {COMPANY.brand} harmless from third-party claims arising out of
        your use of the Service, the rights you assert, or takedown notices you authorize, including
        claims that a notice was unfounded or that you lacked the rights asserted.
      </p>

      <h2>14. Suspension and termination</h2>
      <p>
        We may suspend or terminate access for breach of these Terms or the Acceptable Use Policy, for
        security reasons, or as required by law. You may stop using the Service at any time. Provisions
        that by their nature should survive termination will survive.
      </p>

      <h2>15. Changes to the Service or Terms</h2>
      <p>
        We may update the Service and these Terms. For material changes we will provide reasonable
        notice. Continued use after changes take effect constitutes acceptance.
      </p>

      <h2>16. Governing law and jurisdiction</h2>
      <p>
        These Terms are governed by the laws of {COMPANY.governingLaw}, and disputes are subject to
        the exclusive jurisdiction of {COMPANY.jurisdiction}, without prejudice to any mandatory
        consumer-protection rights.
      </p>

      <h2>17. General</h2>
      <p>
        If any provision is unenforceable, the rest remains in effect. You may not assign these Terms
        without our consent; we may assign them in connection with a merger or sale. These Terms,
        together with any order form, the Acceptable Use Policy, the Privacy Policy and the DPA, are
        the entire agreement between the parties.
      </p>

      <h2>18. Contact</h2>
      <p>
        Questions about these Terms: <a href={`mailto:${COMPANY.email.legal}`}>{COMPANY.email.legal}</a>.
      </p>

      <LegalDisclaimer />
    </LegalLayout>
  );
}
