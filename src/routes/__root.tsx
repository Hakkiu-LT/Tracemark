import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/sonner";
import { ErrorState } from "@/components/error-state";
import { ConsentManager } from "@/components/consent/consent-banner";
import { LeadModalsProvider } from "@/components/landing/lead-modals";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import { COMPANY, TEAM } from "@/lib/company";

import appCss from "../styles.css?url";

const PUBLIC_PATHS = new Set([
  "/",
  "/landing",
  "/legacy/login",
  "/legacy/signup",
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/callback",
  "/request-demo",
  "/about",
  "/contact",
  "/solutions/law-firms",
  "/solutions/brand-owners",
  "/legal/privacy",
  "/legal/terms",
  "/legal/cookies",
  "/legal/acceptable-use",
  "/legal/dpa",
  "/legal/subprocessors",
  "/legal/security",
  "/legal/imprint",
]);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <Link to="/dashboard" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <ErrorState
        variant="page"
        error={error}
        onRetry={() => {
          router.invalidate();
          reset();
        }}
      />
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Let search engines and AI answer engines use full-length text snippets
      // and large image previews (the default silently caps snippet length).
      // max-video-preview:-1 is harmless today (no video) and future-proofs.
      { name: "robots", content: "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1" },
      { title: "HAKKIU — Trademark & Brand Protection" },
      { name: "description", content: "Monitor your trademarks, detect infringements, and automate takedowns across Amazon, Shopify, and the web." },
      { property: "og:title", content: "HAKKIU — Trademark & Brand Protection" },
      { name: "twitter:title", content: "HAKKIU — Trademark & Brand Protection" },
      { property: "og:description", content: "Monitor your trademarks, detect infringements, and automate takedowns across Amazon, Shopify, and the web." },
      { name: "twitter:description", content: "Monitor your trademarks, detect infringements, and automate takedowns across Amazon, Shopify, and the web." },
      // Self-hosted OG image (was an external r2.dev UUID URL). Served from
      // public/og-image.png → https://hakkiu.com/og-image.png. Absolute URL is
      // required — social scrapers reject relative paths.
      { property: "og:image", content: `${COMPANY.baseUrl}/og-image.png` },
      // Explicit dimensions let social scrapers render the card without first
      // downloading the image (match the real file: public/og-image.png).
      { property: "og:image:width", content: "1920" },
      { property: "og:image:height", content: "1080" },
      { name: "twitter:image", content: `${COMPANY.baseUrl}/og-image.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      // Site-wide structured data — Organization + WebSite. Rendered into
      // <head> by the router's built-in script:ld+json handler (SSR-safe,
      // auto-escaped). Facts come from src/lib/company.ts (single source of
      // truth) so they stay in sync with the legal/footer pages.
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${COMPANY.baseUrl}/#organization`,
              name: COMPANY.brand,
              url: COMPANY.baseUrl,
              // ImageObject (not a bare URL string) with real pixel dimensions
              // — Google's logo Knowledge-Panel eligibility prefers this shape.
              // Matches the actual file public/hakkiu-mark.png (512×421).
              logo: {
                "@type": "ImageObject",
                url: `${COMPANY.baseUrl}/hakkiu-mark.png`,
                width: 512,
                height: 421,
              },
              description:
                "AI-powered trademark and brand-protection platform. Continuous monitoring across marketplaces, social channels, app stores and domains, with forensic evidence capture and automated takedowns.",
              foundingDate: COMPANY.foundedYear,
              email: COMPANY.email.general,
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "sales",
                email: COMPANY.email.general,
                url: `${COMPANY.baseUrl}/contact`,
                areaServed: "Worldwide",
                availableLanguage: "English",
              },
              // Named people + their LinkedIn profiles strengthen the entity
              // graph (a key AI-citation signal). No jobTitle — roles TBD.
              employee: TEAM.map((m) => ({
                "@type": "Person",
                name: m.name,
                sameAs: [m.linkedin],
              })),
              sameAs: [COMPANY.linkedin, COMPANY.instagram],
            },
            {
              "@type": "WebSite",
              "@id": `${COMPANY.baseUrl}/#website`,
              url: COMPANY.baseUrl,
              name: COMPANY.brand,
              publisher: { "@id": `${COMPANY.baseUrl}/#organization` },
            },
          ],
        },
      },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
      // Fonts are now self-hosted (@font-face in styles.css, files in
      // public/fonts/). Preload ONLY the two above-the-fold faces — hero H1
      // (Sora 800) + body (Inter 400) — so they download in parallel with the
      // CSS instead of waiting for it to parse. Everything else loads on
      // demand. This removed the render-blocking fonts.googleapis.com request
      // (~820ms off mobile LCP). crossOrigin is required for font preloads.
      { rel: "preload", href: "/fonts/sora-800.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: "/fonts/inter-400.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/*
          Google Consent Mode v2 — default state. This runs FIRST, before any
          Google tag, and denies everything (EU ePrivacy "prior consent" rule).
          gtag.js itself is NOT loaded here — it is injected only after the user
          grants analytics consent (see src/lib/consent.ts + ConsentManager).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'denied',
  personalization_storage: 'denied',
  security_storage: 'granted',
  wait_for_update: 500
});`,
          }}
        />
        {/*
          Force light mode — the app ships a single light theme (no toggle).
          Strip any stale `.dark` class and persisted preference from earlier
          builds before hydration so returning visitors never see dark mode.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.classList.remove('dark');localStorage.removeItem('theme');}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isPublic = PUBLIC_PATHS.has(pathname);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LeadModalsProvider>
          {isPublic ? (
            <>
              <Outlet />
              <Toaster />
            </>
          ) : (
            <RequireAuth>
              <SidebarProvider>
                <div className="flex min-h-screen w-full">
                  <AppSidebar />
                  <SidebarInset className="flex min-w-0 flex-1 flex-col">
                    <AppHeader />
                    <main className="flex-1 p-4 md:p-6">
                      <Outlet />
                    </main>
                  </SidebarInset>
                </div>
                <Toaster />
              </SidebarProvider>
            </RequireAuth>
          )}
          <ConsentManager />
        </LeadModalsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
