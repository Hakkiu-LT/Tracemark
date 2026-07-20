import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { adminFetch } from "@/lib/api";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => adminFetch<CustomerRow[]>("/customers"),
  });
  const { data: orgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => adminFetch<{ id: string; name: string | null }[]>("/organizations"),
  });
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  const rows = (data ?? []).filter((u) => {
    if (filter === "paying") return u.plan !== "free";
    if (filter === "free") return u.plan === "free";
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Individual login accounts. Each belongs to a company.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{isLoading ? "Loading…" : `${rows.length} customer(s)`}</CardTitle>
          <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-40">
            <option value="all">All</option>
            <option value="paying">Paying</option>
            <option value="free">Free</option>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
