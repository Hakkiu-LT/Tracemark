import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy path — auth now lives under /auth/*.
export const Route = createFileRoute("/legacy/login")({
  beforeLoad: () => {
    throw redirect({ to: "/auth/sign-in" });
  },
});
