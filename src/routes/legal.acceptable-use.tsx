import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout, LegalDisclaimer } from "@/components/legal/legal-layout";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/legal/acceptable-use")({
  head: () => ({
    meta: [
      { title: "Acceptable Use Policy — HAKKIU" },
      { name: "description", content: "Rules for acceptable use of the HAKKIU platform." },
    ],
  }),
  component: AcceptableUsePage,
});

function AcceptableUsePage() {
  return (
    <LegalLayout
      title="Acceptable Use Policy"
      subtitle="How the platform may and may not be used. Part of our Terms of Service."
    >
      <h2>1. Scope</h2>
      <p>
        This Acceptable Use Policy ("AUP") applies to everyone who uses the {COMPANY.brand} Service
        and is incorporated into our <Link to="/legal/terms">Terms of Service</Link>. Because our
        Service can prepare and deliver enforcement actions, responsible use matters — misuse can
        harm real businesses and people.
      </p>

      <h2>2. Prohibited conduct</h2>
      <p>You must not use the Service to:</p>
      <ul>
        <li>
          submit <strong>bad-faith, abusive, or knowingly false takedown notices</strong>, or
          otherwise misrepresent your rights;
        </li>
        <li>
          assert trademarks, copyrights or other rights that you do not own or are not authorized to
          enforce;
        </li>
        <li>harass, intimidate, or unfairly target competitors or other third parties;</li>
        <li>break any applicable law or regulation, or facilitate anyone else doing so;</li>
        <li>
          collect, scrape or process data in a way that violates applicable law or a third party's
          rights;
        </li>
        <li>infringe the intellectual-property or privacy rights of others.</li>
      </ul>

      <h2>3. Platform integrity and security</h2>
      <p>You must not:</p>
      <ul>
        <li>probe, scan, or test the vulnerability of the Service without authorization, or breach security or authentication measures;</li>
        <li>interfere with or disrupt the Service, its infrastructure, or other users;</li>
        <li>circumvent rate limits, usage quotas, or access controls;</li>
        <li>reverse engineer, decompile, or attempt to extract source code or models, except where the law expressly permits;</li>
        <li>introduce malware or use the Service to distribute harmful code.</li>
      </ul>

      <h2>4. Responsible use of AI outputs</h2>
      <p>
        Detections and scores are decision-support, not verdicts. You must review results before
        acting, must not present AI outputs as definitive legal findings, and must not use outputs to
        defame or make unsupported public accusations.
      </p>

      <h2>5. Consequences of violations</h2>
      <p>
        We may investigate suspected violations and may suspend or terminate access, remove content,
        and cooperate with law enforcement where appropriate. Serious or repeated violations may
        result in immediate termination.
      </p>

      <h2>6. Reporting abuse</h2>
      <p>
        To report misuse of the Service, contact{" "}
        <a href={`mailto:${COMPANY.email.legal}`}>{COMPANY.email.legal}</a>. Security issues should go
        to <a href={`mailto:${COMPANY.email.security}`}>{COMPANY.email.security}</a> (see{" "}
        <Link to="/legal/security">Trust &amp; Security</Link>).
      </p>

      <LegalDisclaimer />
    </LegalLayout>
  );
}
