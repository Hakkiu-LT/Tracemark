import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { adminFetch } from "@/lib/api";
import { CustomerEditDialog, type EditableCustomer } from "@/components/CustomerEditDialog";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

interface CustomerRow {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
  plan: string;
  persona: string | null;
}

export function Customers() {
  const [filter, setFilter] = useState<"all" | "paying" | "free">("all");
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["customers"],
    queryFn: () => adminFetch<CustomerRow[]>("/customers"),
  });
  const { data: orgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => adminFetch<{ id: string; name: string | null }[]>("/organizations"),
  });
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const [editing, setEditing] = useState<EditableCustomer | null>(null);

  const rows = (data ?? []).filter((u) => {
    if (filter === "paying" && u.plan === "free") return false;
    if (filter === "free" && u.plan !== "free") return false;
    if (search && !u.email.toLowerCase().includes(search.toLowerCase()) && !(u.full_name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Individual login accounts. Each belongs to a company.</p>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{isLoading ? "Loading…" : `${rows.length} customer(s)`}</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="Search by email or name…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" />
            <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-36">
              <option value="all">All</option>
              <option value="paying">Paying</option>
              <option value="free">Free</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Failed to load customers. Check your connection.</p>
              <Button size="sm" variant="outline" onClick={() => refetch()} className="mt-3">Retry</Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/customers/$userId"
                        params={{ userId: u.id }}
                        className="text-accent hover:underline"
                      >
                        {u.full_name || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {u.organization_id ? (
                        <Link to="/organizations/$orgId" params={{ orgId: u.organization_id }} className="text-accent hover:underline">
                          {orgName.get(u.organization_id) || "—"}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.plan === "free" ? "secondary" : "success"} className="capitalize">
                        {u.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {u.persona === "law_firm" ? "Law Firm" : "Brand Owner"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEditing({
                            id: u.id, full_name: u.full_name, email: u.email,
                            persona: u.persona, plan: u.plan, organization_id: u.organization_id,
                          })
                        }
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {editing && <CustomerEditDialog customer={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
