import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "./settings";

export const Route = createFileRoute("/settings/clients")({
  head: () => ({
    meta: [
      { title: "Client Portfolio — Tracemark" },
      { name: "description", content: "Manage your client workspace portfolio." },
    ],
  }),
  component: () => <SettingsPage />,
});
