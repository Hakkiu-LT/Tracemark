import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Every unmatched URL (at any depth) attaches its not-found flag to the ROOT
    // match instead of the nearest child-bearing layout (the "fuzzy" default).
    // This guarantees the 404 always renders at RootComponent's <Outlet/>, so it
    // can be shown as a standalone public page — never wrapped in the private
    // dashboard shell. Without this, e.g. /settings/xyz would land the flag on the
    // Outlet-less /settings route and render a chrome-less non-404 page.
    notFoundMode: "root",
  });

  return router;
};
