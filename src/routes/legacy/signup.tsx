import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy path — auth now lives under /auth/*.
export const Route = createFileRoute("/legacy/signup")({
  beforeLoad: () => {
    throw redirect({ to: "/auth/sign-up" });
  },
});
