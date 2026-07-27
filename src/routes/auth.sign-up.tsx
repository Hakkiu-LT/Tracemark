import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

// Self-serve registration is disabled — new accounts are provisioned by staff.
// Send anyone hitting the sign-up route back to the landing page to book a demo.
export const Route = createFileRoute("/auth/sign-up")({
  head: () => ({
    meta: [{ title: "HAKKIU — Get Access" }],
  }),
  component: SignUpRedirect,
});

function SignUpRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/landing", replace: true });
  }, [navigate]);
  return null;
}
