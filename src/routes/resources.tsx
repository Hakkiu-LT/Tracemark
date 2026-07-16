import { createFileRoute } from "@tanstack/react-router";
import { ResourcesPage } from "@/components/ResourcesPage";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "System Resources — Tracemark" },
      { name: "description", content: "Real-time system CPU, memory, and browser processes monitoring." },
    ],
  }),
  component: ResourcesPage,
});
