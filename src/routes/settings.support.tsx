import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "./settings";

export const Route = createFileRoute("/settings/support")({
  head: () => ({
    meta: [
      { title: "Contact Support — HAKKIU" },
      { name: "description", content: "Get in touch with the HAKKIU support team." },
    ],
  }),
  component: () => <SettingsPage />,
});
