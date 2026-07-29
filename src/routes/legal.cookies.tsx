import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout, LegalDisclaimer } from "@/components/legal/legal-layout";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — HAKKIU" },
      { name: "description", content: "What cookies HAKKIU uses, why, and how to manage your consent." },
      { property: "og:url", content: `${COMPANY.baseUrl}/legal/cookies` },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.baseUrl}/legal/cookies` }],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      subtitle="What cookies and similar technologies we use, and how you control them."
    >
      <h2>1. What cookies are</h2>
      <p>
        Cookies are small text files stored on your device when you visit a website. They let a site
        remember your actions and preferences, and help site owners understand how the site is used.
        We also use similar technologies such as local storage; we refer to all of these as
        "cookies".
      </p>

      <h2>2. Categories we use</h2>
      <ul>
        <li>
          <strong>Strictly necessary</strong> — required for the site and app to function (e.g.
          keeping you signed in, security). These do not require consent.
        </li>
        <li>
          <strong>Analytics</strong> — help us understand how visitors use the site so we can improve
          it. These are <strong>non-essential</strong> and are only set with your consent.
        </li>
      </ul>

      <h2>3. Cookies on this site</h2>
      <table>
        <thead>
          <tr>
            <th>Cookie</th>
            <th>Provider</th>
            <th>Purpose</th>
            <th>Category</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Authentication / session</td>
            <td>{COMPANY.brand} (first-party)</td>
            <td>Keeps you signed in and secures your session</td>
            <td>Strictly necessary</td>
            <td>Session / up to ~1 year</td>
          </tr>
          <tr>
            <td>
              <code>_ga</code>
            </td>
            <td>Google Analytics (third-party)</td>
            <td>Distinguishes unique visitors</td>
            <td>Analytics</td>
            <td>Up to 2 years</td>
          </tr>
          <tr>
            <td>
              <code>_ga_&lt;container-id&gt;</code>
            </td>
            <td>Google Analytics (third-party)</td>
            <td>Persists session state for GA4</td>
            <td>Analytics</td>
            <td>Up to 2 years</td>
          </tr>
        </tbody>
      </table>
      <p>
        Analytics cookies are provided by Google and may involve transferring data to the United
        States under appropriate safeguards (see our{" "}
        <Link to="/legal/privacy">Privacy Policy</Link>, section 7).
      </p>

      <h2>4. Your consent and how to manage it</h2>
      <p>
        Non-essential (analytics) cookies are set only with your consent. When consent is required,
        we show a cookie banner on your first visit with equally prominent <strong>"Accept all"</strong>{" "}
        and <strong>"Reject all"</strong> options, plus a "Customise" panel to choose per category.
        Analytics is off until you opt in. You can change or withdraw your choice at any time using
        the <strong>"Cookie settings"</strong> link in the site footer. Rejecting analytics cookies
        does not affect your access to the site.
      </p>

      <h2>5. Do Not Track / Global Privacy Control</h2>
      <p>
        Where your browser sends a recognized "Do Not Track" or Global Privacy Control signal, we aim
        to treat it as a request not to set non-essential cookies.
      </p>

      <h2>6. Changes</h2>
      <p>
        We may update this Cookie Policy as our use of cookies changes. The "last updated" date above
        reflects the current version.
      </p>

      <h2>7. Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${COMPANY.email.privacy}`}>{COMPANY.email.privacy}</a>.
      </p>

      <LegalDisclaimer />
    </LegalLayout>
  );
}
