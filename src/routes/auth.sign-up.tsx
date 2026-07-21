import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth/auth-screen";

export const Route = createFileRoute("/auth/sign-up")({
  head: () => ({
    meta: [
      { title: "Create account — HAKKIU" },
      { name: "description", content: "Create your HAKKIU workspace." },
    ],
  }),
  component: () => <AuthScreen initialMode="signup" />,
});
