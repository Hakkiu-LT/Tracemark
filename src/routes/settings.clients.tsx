import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "./settings";

export const Route = createFileRoute("/settings/clients")({
  head: () => ({
    meta: [
      { title: "Client Portfolio — HAKKIU" },
      { name: "description", content: "Manage your client workspace portfolio." },
    ],
  }),
  component: () => <SettingsPage />,
});
