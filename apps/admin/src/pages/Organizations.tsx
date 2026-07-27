import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { adminFetch } from "@/lib/api";
import {
  Badge,
  Button,
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
  member_count: number;
  brand_count: number;
}

export function Organizations() {
  const [q, setQ] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => adminFetch<OrgRow[]>("/organizations"),
  });

  const rows = (data ?? []).filter((o) => {
    if (q && !(o.name ?? "").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
        <p className="text-sm text-muted-foreground">Every customer organization, its members and usage.</p>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{isLoading ? "Loading…" : `${rows.length} companies`}</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="Filter by name…" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Failed to load companies. Check your connection.</p>
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
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Brands</TableHead>
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
                    <TableCell className="tabular-nums">{o.member_count}</TableCell>
                    <TableCell className="tabular-nums">{o.brand_count}</TableCell>
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
