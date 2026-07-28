import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  denyAnalytics,
  grantAnalytics,
  hasOptOutSignal,
  readConsent,
  writeConsent,
} from "@/lib/consent";
import { getConsentRequired } from "@/lib/consent-region";

/**
 * Cookie-consent manager + banner.
 *
 * Mounted once, on every page. Renders nothing during SSR (returns null until
 * mounted) so there is no hydration mismatch, and decides on the client:
 *
 *  - Returning visitor  → apply the stored choice (load GA if they accepted).
 *  - GPC / Do-Not-Track → treat as "reject", no banner.
 *  - First-time visitor → ask the server if consent is legally required:
 *        EEA/UK   → show the banner.
 *        elsewhere → enable analytics automatically (consent not required).
 */
export function ConsentManager() {
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  // Toggle state inside the "Customize" panel (analytics off by default).
  const [analyticsPref, setAnalyticsPref] = useState(false);

  useEffect(() => {
    // Footer "Cookie settings" link re-opens the banner in details mode.
    const reopen = () => {
      const stored = readConsent();
      setAnalyticsPref(stored?.analytics ?? false);
      setShowDetails(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);

    const stored = readConsent();
    if (stored) {
      // Returning visitor: re-apply their saved choice before anything else.
      setAnalyticsPref(stored.analytics);
      if (stored.analytics) grantAnalytics();
    } else if (hasOptOutSignal()) {
      // Browser opt-out signal → record a reject, stay silent.
      writeConsent(false);
    } else {
      // First-time visitor with no signal: is a banner legally required here?
      getConsentRequired()
        .then(({ consentRequired }) => {
          if (consentRequired) {
            setOpen(true);
          } else {
            // Outside the EEA/UK — analytics allowed without a banner.
            writeConsent(true);
            setAnalyticsPref(true);
            grantAnalytics();
          }
        })
        .catch(() => {
          // If the region check fails, be safe and ask for consent.
          setOpen(true);
        });
    }

    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  function acceptAll() {
    writeConsent(true);
    grantAnalytics();
    setAnalyticsPref(true);
    setOpen(false);
  }

  function rejectAll() {
    writeConsent(false);
    denyAnalytics();
    setAnalyticsPref(false);
    setOpen(false);
  }

  function savePreferences() {
    writeConsent(analyticsPref);
    if (analyticsPref) grantAnalytics();
    else denyAnalytics();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto max-w-4xl px-6 py-5">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              We value your privacy
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              We use strictly necessary cookies to run this site, and{" "}
              <strong>analytics cookies</strong> — only with your consent — to
              understand how it's used and improve it. You can accept, reject, or
              customise your choice. Read our{" "}
              <Link to="/legal/cookies" className="underline hover:text-foreground">
                Cookie Policy
              </Link>
              .
            </p>
          </div>

          {showDetails && (
            <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Analytics</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Google Analytics (GA4) — measures page views and traffic
                    sources. Off by default.
                  </p>
                </div>
                <Switch
                  checked={analyticsPref}
                  onCheckedChange={setAnalyticsPref}
                  aria-label="Analytics cookies"
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 border-t border-border/60 pt-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Strictly necessary
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Required for the site to work. Always on.
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  Always on
                </span>
              </div>
            </div>
          )}

          {/* Equal-prominence actions (GDPR/CNIL: reject as easy as accept). */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {!showDetails && (
              <Button
                variant="ghost"
                size="sm"
                className="sm:mr-auto"
                onClick={() => setShowDetails(true)}
              >
                Customise
              </Button>
            )}
            {showDetails ? (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={savePreferences}
              >
                Save preferences
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={rejectAll}
            >
              Reject all
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={acceptAll}
            >
              Accept all
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
