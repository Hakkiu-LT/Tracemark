import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout, LegalDisclaimer } from "@/components/legal/legal-layout";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — HAKKIU" },
      {
        name: "description",
        content: "How HAKKIU collects, uses, shares and protects personal data, and your rights under the GDPR.",
      },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.baseUrl}/legal/privacy` }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How we handle personal data as a data controller, and your rights under the GDPR."
    >
      <h2>1. Who we are</h2>
      <p>
        This Privacy Policy explains how {COMPANY.legalName} ("{COMPANY.brand}", "we", "us")
        processes personal data when you visit {COMPANY.baseUrl}, request a demo, or use our
        brand-protection platform. {COMPANY.brand} is the <strong>data controller</strong> for the
        processing described here. Our registration and contact details are in our{" "}
        <Link to="/legal/imprint">Legal Notice</Link>.
      </p>
      <p>
        For data-protection matters you can contact us at{" "}
        <a href={`mailto:${COMPANY.email.privacy}`}>{COMPANY.email.privacy}</a>.
      </p>

      <h2>2. Controller vs. processor — two roles</h2>
      <p>
        We wear two hats. This policy covers data for which we are the <strong>controller</strong>:
        website visitors, demo/leads, marketing contacts, and customer account data. For personal
        data contained in the material our customers monitor and push through the platform (for
        example, data about alleged infringers or sellers), we act as a{" "}
        <strong>processor</strong> on our customer's behalf — that processing is governed by our{" "}
        <Link to="/legal/dpa">Data Processing Agreement</Link> and the customer's own privacy notice.
      </p>

      <h2>3. Personal data we collect</h2>
      <ul>
        <li>
          <strong>Website &amp; analytics data</strong> — pages viewed, approximate location, device
          and browser information, and identifiers set by cookies (see our{" "}
          <Link to="/legal/cookies">Cookie Policy</Link>).
        </li>
        <li>
          <strong>Demo / lead data</strong> — name, work email, phone, company, role, and the
          details you provide in the demo form.
        </li>
        <li>
          <strong>Account &amp; authentication data</strong> — email, name, hashed credentials, and
          organization membership for platform users.
        </li>
        <li>
          <strong>Support &amp; communications</strong> — the content of emails and messages you send
          us.
        </li>
        <li>
          <strong>Server logs</strong> — IP address, timestamps and technical logs used for security
          and reliability.
        </li>
        <li>
          <strong>Data collected indirectly</strong> — in delivering the service we process
          information from public marketplaces and the open web that may include personal data of
          third parties (e.g. seller or listing contact details). See section 9.
        </li>
      </ul>

      <h2>4. Why we process it and our legal basis</h2>
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Legal basis (GDPR Art. 6)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Providing and operating the platform and accounts</td>
            <td>Performance of a contract — Art. 6(1)(b)</td>
          </tr>
          <tr>
            <td>Responding to demo requests and sales enquiries</td>
            <td>Steps prior to a contract / legitimate interests — Art. 6(1)(b)/(f)</td>
          </tr>
          <tr>
            <td>Security, fraud prevention, and service reliability</td>
            <td>Legitimate interests — Art. 6(1)(f)</td>
          </tr>
          <tr>
            <td>Analytics and product improvement</td>
            <td>Consent (analytics cookies) / legitimate interests — Art. 6(1)(a)/(f)</td>
          </tr>
          <tr>
            <td>Marketing emails to business contacts</td>
            <td>Consent or legitimate interests — Art. 6(1)(a)/(f)</td>
          </tr>
          <tr>
            <td>Complying with legal, tax and accounting obligations</td>
            <td>Legal obligation — Art. 6(1)(c)</td>
          </tr>
        </tbody>
      </table>
      <p>
        Where we rely on <strong>legitimate interests</strong>, those interests are running and
        securing our business, understanding how our site is used, and protecting brands from online
        abuse. You can object to processing based on legitimate interests (see section 10).
      </p>

      <h2>5. Cookies and tracking</h2>
      <p>
        We use cookies and similar technologies, including Google Analytics 4. Non-essential cookies
        are only set with your consent. Full details, categories and durations are in our{" "}
        <Link to="/legal/cookies">Cookie Policy</Link>.
      </p>

      <h2>6. Who we share data with</h2>
      <p>
        We share personal data with vetted service providers (sub-processors) that host our
        infrastructure, send our email, run AI analysis, and provide analytics. We do not sell your
        personal data. A current list of sub-processors, their purpose and location is on our{" "}
        <Link to="/legal/subprocessors">Sub-processors</Link> page. Where takedowns are filed, we
        also share relevant information with the marketplaces, registrars or authorities that action
        them, on our customer's instruction.
      </p>

      <h2>7. International transfers</h2>
      <p>
        Some of our providers are located outside the European Economic Area (for example in the
        United States). Where personal data is transferred internationally, we rely on appropriate
        safeguards — the EU–US Data Privacy Framework and/or the European Commission's Standard
        Contractual Clauses. You can request a copy of the relevant safeguard by emailing{" "}
        <a href={`mailto:${COMPANY.email.privacy}`}>{COMPANY.email.privacy}</a>.
      </p>

      <h2>8. How long we keep data</h2>
      <p>
        We keep personal data only as long as necessary for the purposes above: account data for the
        life of the account and a reasonable period afterwards; lead data for as long as we are in
        contact plus a limited follow-up window; logs for a short security-retention period; and
        records required by law (e.g. accounting) for the statutory period. Specific retention
        periods are available on request.
      </p>

      <h2>9. Data we did not collect from you (Art. 14)</h2>
      <p>
        To deliver brand protection, we process information from{" "}
        <strong>publicly accessible sources</strong> — online marketplaces (such as Amazon, Shopify,
        eBay and Alibaba) and other public websites. This may include personal data of sellers or
        others associated with potentially infringing listings. We process it on the legal basis of
        legitimate interests (protecting brands and consumers from counterfeiting and abuse) and, for
        customer-directed activity, as a processor under our{" "}
        <Link to="/legal/dpa">DPA</Link>. If you are an individual whose data appears in our
        systems through this route, you have the rights in section 10, and you can contact us at{" "}
        <a href={`mailto:${COMPANY.email.privacy}`}>{COMPANY.email.privacy}</a>.
      </p>

      <h2>10. Your rights</h2>
      <p>Under the GDPR you have the right to:</p>
      <ul>
        <li>access the personal data we hold about you;</li>
        <li>have inaccurate data corrected;</li>
        <li>have your data erased in certain circumstances;</li>
        <li>restrict or object to processing (including profiling);</li>
        <li>data portability;</li>
        <li>withdraw consent at any time, where processing is based on consent; and</li>
        <li>
          lodge a complaint with a supervisory authority — in our case the{" "}
          {COMPANY.supervisoryAuthority.name} (
          <a href={COMPANY.supervisoryAuthority.url} target="_blank" rel="noopener noreferrer">
            {COMPANY.supervisoryAuthority.url}
          </a>
          ).
        </li>
      </ul>
      <p>
        To exercise any right, email{" "}
        <a href={`mailto:${COMPANY.email.privacy}`}>{COMPANY.email.privacy}</a>. We respond within
        one month. If your data was submitted by one of our customers (we act as processor), we will
        refer you to that customer, who is the controller.
      </p>

      <h2>11. Automated decision-making and AI</h2>
      <p>
        Our platform uses AI (including image/vision analysis) to <em>score</em> and flag likely
        infringements. These scores support human review; {COMPANY.brand} does not use them to make
        decisions producing legal or similarly significant effects about individuals without human
        involvement. Customers remain responsible for verifying results and for any enforcement
        action they choose to take.
      </p>

      <h2>12. Security</h2>
      <p>
        We apply technical and organizational measures appropriate to the risk, including encryption
        in transit, access controls and EU-based hosting. More detail is on our{" "}
        <Link to="/legal/security">Trust &amp; Security</Link> page.
      </p>

      <h2>13. Children</h2>
      <p>
        Our service is a business tool and is not directed to children. We do not knowingly collect
        personal data from children.
      </p>

      <h2>14. US state privacy rights (e.g. California)</h2>
      <p>
        Depending on where you live, you may have additional rights under laws such as the California
        Consumer Privacy Act (CCPA/CPRA) — including rights to know, delete, correct, and opt out of
        the "sale" or "sharing" of personal information. We do not sell personal information. To
        exercise US state rights, contact{" "}
        <a href={`mailto:${COMPANY.email.privacy}`}>{COMPANY.email.privacy}</a>.
      </p>

      <h2>15. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. We will change the "last updated" date above and,
        for material changes, provide additional notice. The current version always lives at{" "}
        {COMPANY.baseUrl}/legal/privacy.
      </p>

      <h2>16. Contact</h2>
      <p>
        {COMPANY.legalName} — <a href={`mailto:${COMPANY.email.privacy}`}>{COMPANY.email.privacy}</a>.
        Postal and registration details are in our <Link to="/legal/imprint">Legal Notice</Link>.
      </p>

      <LegalDisclaimer />
    </LegalLayout>
  );
}
