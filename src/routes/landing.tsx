import { createFileRoute, redirect } from "@tanstack/react-router";

// The landing page now lives at the site root ("/"). This route is kept so old
// links, bookmarks, sitemaps and campaigns pointing at /landing keep working —
// it permanently redirects to "/", preserving any ?book=demo|sales deep link.
export const Route = createFileRoute("/landing")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/", search: search as never, replace: true });
  },
});
