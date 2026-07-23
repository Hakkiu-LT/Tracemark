import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "./settings";

export const Route = createFileRoute("/settings/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Settings — HAKKIU" },
      { name: "description", content: "Configure notification email settings and view logs." },
    ],
  }),
  component: () => <SettingsPage />,
});
