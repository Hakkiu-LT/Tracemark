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
import { AuthProvider, RequireAuth } from "@/lib/auth";

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HAKKIU — Trademark & Brand Protection" },
      { name: "description", content: "Monitor your trademarks, detect infringements, and automate takedowns across Amazon, Shopify, and the web." },
      { property: "og:title", content: "HAKKIU — Trademark & Brand Protection" },
      { name: "twitter:title", content: "HAKKIU — Trademark & Brand Protection" },
      { property: "og:description", content: "Monitor your trademarks, detect infringements, and automate takedowns across Amazon, Shopify, and the web." },
      { name: "twitter:description", content: "Monitor your trademarks, detect infringements, and automate takedowns across Amazon, Shopify, and the web." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/02a1ed82-8227-4b72-ba6c-8a1653239b9e/id-preview-ce27147c--15c49e3c-cecc-4003-b12c-7f67ca80d572.lovable.app-1779024978982.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/02a1ed82-8227-4b72-ba6c-8a1653239b9e/id-preview-ce27147c--15c49e3c-cecc-4003-b12c-7f67ca80d572.lovable.app-1779024978982.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
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
        {/* Google Analytics (gtag.js) — GA4 property G-PH8369N5PD */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-PH8369N5PD" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-PH8369N5PD');`,
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
      </AuthProvider>
    </QueryClientProvider>
  );
}
