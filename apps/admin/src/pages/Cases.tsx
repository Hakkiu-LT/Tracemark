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
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

interface CaseRow {
  id: string;
  brand_name: string;
  organization_id: string | null;
  status: string;
  created_at: string | null;
  risk_level: string | null;
  recommended_action: string | null;
  confidence_score: number | null;
  infringement_count: number;
}

function riskVariant(r: string | null) {
  if (r === "HIGH") return "destructive" as const;
  if (r === "MEDIUM") return "warning" as const;
  if (r === "LOW") return "success" as const;
  return "secondary" as const;
}

export function Cases() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: () => adminFetch<CaseRow[]>("/cases"),
  });
  const { data: orgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => adminFetch<{ id: string; name: string | null }[]>("/organizations"),
  });
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  const rows = (data ?? []).filter((c) => {
    if (status && c.status !== status) return false;
    if (q && !c.brand_name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const statuses = Array.from(new Set((data ?? []).map((c) => c.status))).sort();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cases</h1>
        <p className="text-sm text-muted-foreground">Every scan result across all customers.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>{isLoading ? "Loading…" : `${rows.length} cases`}</CardTitle>
          <div className="flex gap-2">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
              <option value="">All statuses</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input placeholder="Filter by brand…" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Conf.</TableHead>
                  <TableHead>Infr.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link to="/cases/$caseId" params={{ caseId: c.id }} className="text-accent hover:underline">
                        {c.brand_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.organization_id ? orgName.get(c.organization_id) || "—" : "—"}
                    </TableCell>
                    <TableCell><Badge variant={riskVariant(c.risk_level)}>{c.risk_level || "—"}</Badge></TableCell>
                    <TableCell className="text-xs">{c.recommended_action || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{c.status}</Badge></TableCell>
                    <TableCell className="tabular-nums">
                      {c.confidence_score != null ? `${Math.round(c.confidence_score * 100)}%` : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{c.infringement_count}</TableCell>
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
