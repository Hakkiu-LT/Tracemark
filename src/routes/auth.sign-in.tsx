import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth/auth-screen";

export const Route = createFileRoute("/auth/sign-in")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const raw = typeof search.redirect === "string" ? search.redirect : undefined;
    // Only allow relative paths — block open-redirect to external URLs
    const isRelative = raw && raw.startsWith("/") && !raw.startsWith("//");
    return { redirect: isRelative ? raw : undefined };
  },
  head: () => ({
    meta: [
      { title: "Sign in — HAKKIU" },
      { name: "description", content: "Sign in to your HAKKIU workspace." },
    ],
  }),
  component: SignInRoute,
});

function SignInRoute() {
  const { redirect } = Route.useSearch();
  return <AuthScreen initialMode="signin" redirect={redirect} />;
}
