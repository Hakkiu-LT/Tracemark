import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { AdminLayout } from "@/components/layout";
import { SignIn } from "@/pages/SignIn";
import { Dashboard } from "@/pages/Dashboard";
import { Customers } from "@/pages/Customers";
import { CustomerDetail } from "@/pages/CustomerDetail";
import { Organizations } from "@/pages/Organizations";
import { OrganizationDetail } from "@/pages/OrganizationDetail";
import { Cases } from "@/pages/Cases";
import { CaseDetail } from "@/pages/CaseDetail";
import { Staff } from "@/pages/Staff";
import { StaffDetail } from "@/pages/StaffDetail";
import { MonitoringApi } from "@/pages/MonitoringApi";
import { MonitoringResources } from "@/pages/MonitoringResources";
import { Audit } from "@/pages/Audit";
import { Brands } from "@/pages/Brands";
import { Integrations } from "@/pages/Integrations";
import { ScraperHealth } from "@/pages/ScraperHealth";
import { ScraperHealthDetail } from "@/pages/ScraperHealthDetail";

const rootRoute = createRootRoute({ component: () => <Outlet /> });

// Public: staff sign-in (no layout).
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/sign-in",
  component: SignIn,
});

// "/" redirects into the app.
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});

// Authenticated layout: guards access and renders the shell.
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppGuard,
});

function AppGuard() {
  const { loading, session, staff, notStaff } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  // Not logged in, or logged in but not a staff account → back to sign-in
  // (SignIn shows the "not authorized" state when notStaff is true).
  if (!session || notStaff || !staff) {
    return <Navigate to="/auth/sign-in" />;
  }
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}

const dashboardRoute = createRoute({ getParentRoute: () => appRoute, path: "/dashboard", component: Dashboard });
const organizationsRoute = createRoute({ getParentRoute: () => appRoute, path: "/organizations", component: Organizations });
const organizationDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/organizations/$orgId",
  component: OrganizationDetail,
});
const customersRoute = createRoute({ getParentRoute: () => appRoute, path: "/customers", component: Customers });
const customerDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/customers/$userId",
  component: CustomerDetail,
});
const casesRoute = createRoute({ getParentRoute: () => appRoute, path: "/cases", component: Cases });
const caseDetailRoute = createRoute({ getParentRoute: () => appRoute, path: "/cases/$caseId", component: CaseDetail });
const staffRoute = createRoute({ getParentRoute: () => appRoute, path: "/staff", component: Staff });
const staffDetailRoute = createRoute({ getParentRoute: () => appRoute, path: "/staff/$staffId", component: StaffDetail });
const monitoringApiRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/monitoring/api",
  component: MonitoringApi,
});
const monitoringResourcesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/monitoring/resources",
  component: MonitoringResources,
});
const auditRoute = createRoute({ getParentRoute: () => appRoute, path: "/audit", component: Audit });
const brandsRoute = createRoute({ getParentRoute: () => appRoute, path: "/brands", component: Brands });
const integrationsRoute = createRoute({ getParentRoute: () => appRoute, path: "/integrations", component: Integrations });
const scraperHealthRoute = createRoute({ getParentRoute: () => appRoute, path: "/monitoring/scrapers", component: ScraperHealth });
const scraperHealthDetailRoute = createRoute({ getParentRoute: () => appRoute, path: "/monitoring/scrapers/$platform", component: ScraperHealthDetail });

const routeTree = rootRoute.addChildren([
  signInRoute,
  indexRoute,
  appRoute.addChildren([
    dashboardRoute,
    organizationsRoute,
    organizationDetailRoute,
    customersRoute,
    customerDetailRoute,
    casesRoute,
    caseDetailRoute,
    staffRoute,
    staffDetailRoute,
    monitoringApiRoute,
    monitoringResourcesRoute,
    auditRoute,
    brandsRoute,
    integrationsRoute,
    scraperHealthRoute,
    scraperHealthDetailRoute,
  ]),
]);

export const router = createRouter({ routeTree, defaultPreloadStaleTime: 0 });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
