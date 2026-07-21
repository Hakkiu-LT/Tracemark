import { createFileRoute } from "@tanstack/react-router";
import { ClientsPage } from "@/components/ClientsPage";

export const Route = createFileRoute("/clients")({
  head: () => ({ meta: [{ title: "Clients — HAKKIU" }, { name: "description", content: "Manage your law-firm client portfolio and billing." }] }),
  component: ClientsPage,
});
