import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { adminFetch } from "@/lib/api";
import { ACTION_LABELS } from "@/lib/utils";
import { CopyableId } from "@/components/CopyableId";
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
import { ErrorState } from "@/components/error-state";

interface AuditRow {
  id: string;
  staff_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_org_id: string | null;
  created_at: string;
}

function TargetCell({ type, id, orgId }: { type: string | null; id: string | null; orgId: string | null }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  if (!id) return <span className="font-mono text-xs text-muted-foreground">{type}</span>;

  const label = <><span className="text-muted-foreground">{type}:</span> <CopyableId id={id} /></>;

  if (type === "customer") return <Link to="/customers/$userId" params={{ userId: id }} className="text-accent hover:underline text-xs">{label}</Link>;
  if (type === "organization") return <Link to="/organizations/$orgId" params={{ orgId: id }} className="text-accent hover:underline text-xs">{label}</Link>;
  if (type === "staff") return <Link to="/staff/$staffId" params={{ staffId: id }} className="text-accent hover:underline text-xs">{label}</Link>;
  if (orgId && (type === "brand" || type === "case" || type === "decision")) {
    return <Link to="/organizations/$orgId" params={{ orgId }} className="text-accent hover:underline text-xs">{label}</Link>;
  }
  return <span className="font-mono text-xs text-muted-foreground">{type}:<CopyableId id={id} /></span>;
}

export function Audit() {
  const [actionFilter, setActionFilter] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [limit, setLimit] = useState(100);

  const params = new URLSearchParams({ limit: String(limit) });
  if (actionFilter) params.set("action", actionFilter);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["audit-log", actionFilter, limit],
    queryFn: () => adminFetch<AuditRow[]>(`/audit-log?${params}`),
  });

  const rows = staffSearch
    ? (data ?? []).filter((r) => (r.staff_email ?? "").toLowerCase().includes(staffSearch.toLowerCase()))
    : (data ?? []);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Every admin action, newest first.</p>
      </div>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{isLoading ? "Loading…" : `${rows.length} entries`}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="w-48">
              <option value="">All actions</option>
              {Object.keys(ACTION_LABELS).sort().map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a]}</option>
              ))}
            </Select>
            <Input placeholder="Filter by staff email…" value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} className="w-44" />
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <ErrorState variant="block" error={error} title="Failed to load audit log" onRetry={() => refetch()} />
          ) : isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{r.staff_email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" title={r.action}>{ACTION_LABELS[r.action] ?? r.action}</Badge>
                      </TableCell>
                      <TableCell>
                        <TargetCell type={r.target_type} id={r.target_id} orgId={r.target_org_id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(data?.length ?? 0) >= limit && (
                <div className="mt-4 text-center">
                  <Button size="sm" variant="outline" onClick={() => setLimit((l) => l + 100)}>
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
