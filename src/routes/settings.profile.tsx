import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "./settings";

export const Route = createFileRoute("/settings/profile")({
  head: () => ({
    meta: [
      { title: "Profile Settings — HAKKIU" },
      { name: "description", content: "Configure your user profile and organization details." },
    ],
  }),
  component: () => <SettingsPage />,
});
