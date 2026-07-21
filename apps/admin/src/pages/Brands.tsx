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
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

interface BrandRow {
  id: string;
  brand_name: string;
  organization_id: string | null;
  status: string;
  website: string | null;
  platforms: string[] | null;
  target_regions: string[] | null;
  created_at: string | null;
}

interface OrgRow {
  id: string;
  name: string | null;
  plan: string;
}

export function Brands() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["brands"],
    queryFn: () => adminFetch<BrandRow[]>("/brands"),
  });
  const { data: orgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => adminFetch<OrgRow[]>("/organizations"),
  });
  const orgMap = new Map((orgs ?? []).map((o) => [o.id, o]));

  const rows = (data ?? []).filter((b) => {
    if (statusFilter && b.status !== statusFilter) return false;
    if (q && !b.brand_name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const statuses = Array.from(new Set((data ?? []).map((b) => b.status))).sort();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Brands</h1>
        <p className="text-sm text-muted-foreground">All brands across every organization.</p>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{isLoading ? "Loading…" : `${rows.length} brand(s)`}</CardTitle>
          <div className="flex gap-2">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
              <option value="">All statuses</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input placeholder="Filter by name…" value={q} onChange={(e) => setQ(e.target.value)} className="w-44" />
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Failed to load brands. Check your connection.</p>
              <Button size="sm" variant="outline" onClick={() => refetch()} className="mt-3">Retry</Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No brands found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Platforms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => {
                  const org = b.organization_id ? orgMap.get(b.organization_id) : undefined;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.brand_name}</TableCell>
                      <TableCell>
                        {org && b.organization_id ? (
                          <Link to="/organizations/$orgId" params={{ orgId: b.organization_id }} className="text-accent hover:underline">
                            {org.name || "—"}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{b.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{b.website || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {b.platforms?.length ? b.platforms.join(", ") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
