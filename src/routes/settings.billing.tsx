import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "./settings";

export const Route = createFileRoute("/settings/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Plans — Tracemark" },
      { name: "description", content: "Manage your subscription, plans, and invoices." },
    ],
  }),
  component: () => <SettingsPage />,
});
