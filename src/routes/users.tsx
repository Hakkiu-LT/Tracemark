import { createFileRoute } from "@tanstack/react-router";
import { UsersPage } from "@/components/UsersPage";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "User Management – Tracemark" },
      { name: "description", content: "Administrative panel for managing users." },
    ],
  }),
  component: UsersPage,
});
