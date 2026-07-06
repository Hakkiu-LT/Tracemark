import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "./settings";

export const Route = createFileRoute("/settings/profile")({
  head: () => ({
    meta: [
      { title: "Profile Settings — Tracemark" },
      { name: "description", content: "Configure your user profile and organization details." },
    ],
  }),
  component: () => <SettingsPage />,
});
