import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

// Direct registration is disabled — accounts are created only via the
// self-serve checkout flow or provisioned by staff.
export const Route = createFileRoute("/auth/sign-up")({
  head: () => ({
    meta: [{ title: "HAKKIU — Get Access" }],
  }),
  component: SignUpRedirect,
});

function SignUpRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/plans", replace: true });
  }, [navigate]);
  return null;
}
