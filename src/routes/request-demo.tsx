import { createFileRoute, redirect } from "@tanstack/react-router";

// The old multi-step "Request a demo" wizard has been replaced by the compact
// Book-a-demo modal (see src/components/landing/book-demo-modal.tsx). We keep
// this route so existing links, bookmarks and campaigns still work — it just
// sends visitors to the landing page with the demo modal auto-opened.
export const Route = createFileRoute("/request-demo")({
  beforeLoad: () => {
    throw redirect({ to: "/", search: { book: "demo" } as never });
  },
});
