import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth/auth-screen";

export const Route = createFileRoute("/auth/sign-in")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Tracemark" },
      { name: "description", content: "Sign in to your Tracemark workspace." },
    ],
  }),
  component: SignInRoute,
});

function SignInRoute() {
  const { redirect } = Route.useSearch();
  return <AuthScreen initialMode="signin" redirect={redirect} />;
}
