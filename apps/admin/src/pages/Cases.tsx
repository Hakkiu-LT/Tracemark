import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { adminFetch } from "@/lib/api";
import { usePermission } from "@/lib/auth";
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

type SortCol = "brand_name" | "risk_level" | "status" | "infringement_count" | null;

const RISK_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function riskVariant(r: string | null) {
  if (r === "HIGH") return "destructive" as const;
  if (r === "MEDIUM") return "warning" as const;
  if (r === "LOW") return "success" as const;
  return "secondary" as const;
}

function SortIcon({ col, sort }: { col: SortCol; sort: { col: SortCol; dir: "asc" | "desc" } }) {
  if (sort.col !== col) return <ChevronsUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
  return sort.dir === "asc"
    ? <ChevronUp className="ml-1 inline h-3 w-3" />
    : <ChevronDown className="ml-1 inline h-3 w-3" />;
}

export function Cases() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [sort, setSort] = useState<{ col: SortCol; dir: "asc" | "desc" }>({ col: null, dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const canEdit = usePermission("customers.edit");
  const qc = useQueryClient();

  const params = new URLSearchParams();
  if (status) params.set("status", status);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["cases", status],
    queryFn: () => adminFetch<CaseRow[]>(`/cases${params.toString() ? `?${params}` : ""}`),
  });
  const { data: orgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => adminFetch<{ id: string; name: string | null }[]>("/organizations"),
  });
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  const bulk = useMutation({
    mutationFn: (newStatus: string) =>
      adminFetch<{ updated: number; not_found: string[] }>("/cases/bulk", {
        method: "PATCH",
        body: JSON.stringify({ case_ids: [...selected], status: newStatus }),
      }),
    onSuccess: (res) => {
      toast.success(
        `Updated ${res.updated} case${res.updated === 1 ? "" : "s"}` +
          (res.not_found.length ? ` · ${res.not_found.length} skipped` : "")
      );
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  let rows = (data ?? []).filter((c) => {
    if (riskFilter && c.risk_level !== riskFilter) return false;
    if (q && !c.brand_name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  if (sort.col) {
    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sort.col === "brand_name") cmp = a.brand_name.localeCompare(b.brand_name);
      else if (sort.col === "risk_level") cmp = (RISK_ORDER[a.risk_level ?? ""] ?? 3) - (RISK_ORDER[b.risk_level ?? ""] ?? 3);
      else if (sort.col === "status") cmp = a.status.localeCompare(b.status);
      else if (sort.col === "infringement_count") cmp = a.infringement_count - b.infringement_count;
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }

  function toggleSort(col: SortCol) {
    setSort((prev) =>
      prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }
    );
  }

  const visibleIds = rows.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = visibleIds.some((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const statuses = Array.from(new Set((data ?? []).map((c) => c.status))).sort();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cases</h1>
        <p className="text-sm text-muted-foreground">Every scan result across all customers.</p>
      </div>

      {/* Bulk action bar — only visible when items are selected */}
      {canEdit && selected.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-3 rounded-md border border-border bg-background/95 p-3 shadow-sm backdrop-blur">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={bulk.isPending}
              onClick={() => bulk.mutate("reviewed")}
            >
              {bulk.isPending && bulk.variables === "reviewed" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Mark reviewed
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulk.isPending}
              onClick={() => bulk.mutate("escalated")}
            >
              {bulk.isPending && bulk.variables === "escalated" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Escalate
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulk.isPending}
              onClick={() => bulk.mutate("dismissed")}
            >
              {bulk.isPending && bulk.variables === "dismissed" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Dismiss
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{isLoading ? "Loading…" : `${rows.length} cases`}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
              <option value="">All statuses</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="w-32">
              <option value="">All risk</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </Select>
            <Input placeholder="Filter by brand…" value={q} onChange={(e) => setQ(e.target.value)} className="w-44" />
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Failed to load cases. Check your connection.</p>
              <Button size="sm" variant="outline" onClick={() => refetch()} className="mt-3">Retry</Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {canEdit && (
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allVisibleSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                        }}
                        onChange={toggleAllVisible}
                        className="h-4 w-4 cursor-pointer accent-accent"
                      />
                    </TableHead>
                  )}
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("brand_name")}>
                    Brand <SortIcon col="brand_name" sort={sort} />
                  </TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("risk_level")}>
                    Risk <SortIcon col="risk_level" sort={sort} />
                  </TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")}>
                    Status <SortIcon col="status" sort={sort} />
                  </TableHead>
                  <TableHead>Conf.</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("infringement_count")}>
                    Infr. <SortIcon col="infringement_count" sort={sort} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} className={selected.has(c.id) ? "bg-accent/5" : undefined}>
                    {canEdit && (
                      <TableCell className="w-8">
                        <input
                          type="checkbox"
                          aria-label={`Select ${c.brand_name}`}
                          checked={selected.has(c.id)}
                          onChange={() => toggleOne(c.id)}
                          className="h-4 w-4 cursor-pointer accent-accent"
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      <Link to="/cases/$caseId" params={{ caseId: c.id }} className="text-accent hover:underline">
                        {c.brand_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {c.organization_id ? (
                        <Link to="/organizations/$orgId" params={{ orgId: c.organization_id }} className="text-accent hover:underline text-sm">
                          {orgName.get(c.organization_id) || "—"}
                        </Link>
                      ) : <span className="text-muted-foreground">—</span>}
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
