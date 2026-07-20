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
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

interface OrgRow {
  id: string;
  name: string | null;
  industry: string | null;
  persona: string | null;
  plan: string;
  member_count: number;
  brand_count: number;
  mrr: number;
}

export function Organizations() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => adminFetch<OrgRow[]>("/organizations"),
  });

  const rows = (data ?? []).filter((o) =>
    !q ? true : (o.name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
        <p className="text-sm text-muted-foreground">Every customer organization, its members and usage.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{isLoading ? "Loading…" : `${rows.length} companies`}</CardTitle>
          <Input placeholder="Filter by name…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
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
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Brands</TableHead>
                  <TableHead>MRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      <Link to="/organizations/$orgId" params={{ orgId: o.id }} className="text-accent hover:underline">
                        {o.name || "—"}
                      </Link>
                      {o.industry && <span className="ml-2 text-xs text-muted-foreground">{o.industry}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{o.persona === "law_firm" ? "Law Firm" : "Brand Owner"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={o.plan === "free" ? "secondary" : "success"} className="capitalize">
                        {o.plan}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{o.member_count}</TableCell>
                    <TableCell className="tabular-nums">{o.brand_count}</TableCell>
                    <TableCell className="tabular-nums">{o.mrr ? `$${o.mrr}` : "—"}</TableCell>
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
