import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth/auth-screen";

export const Route = createFileRoute("/auth/sign-up")({
  head: () => ({
    meta: [
      { title: "Create account — Tracemark" },
      { name: "description", content: "Create your Tracemark workspace." },
    ],
  }),
  component: () => <AuthScreen initialMode="signup" />,
});
