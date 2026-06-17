import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { fetchCaseHistory, type CaseSummary } from "@/lib/supabase";
import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type SortField = "risk" | "confidence" | "date";
type SortDir = "asc" | "desc";

const RISK_ORDER: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  analyzing: "bg-risk-med/10 text-risk-med border-risk-med/30",
  complete: "bg-success/10 text-success border-success/30",
  error: "bg-risk-high/10 text-risk-high border-risk-high/30",
};

function CaseStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border"
      )}
    >
      {status}
    </span>
  );
}

export const Route = createFileRoute("/cases")({
  head: () => ({
    meta: [
      { title: "Cases — Tracemark" },
      { name: "description", content: "Review, triage, and act on every detected infringement." },
    ],
  }),
  component: CasesLayout,
});

function CasesLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  if (pathname !== "/cases") return <Outlet />;
  return <CasesList />;
}

function CasesList() {
  const [all, setAll] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    let cancelled = false;
    fetchCaseHistory()
      .then((cases) => { if (!cancelled) setAll(cases); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load cases"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggleSort = (field: SortField) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const countByRisk = (risk: string) => all.filter((c) => c.risk_level === risk).length;

  const filtered = all
    .filter((c) => {
      if (tab === "all") return true;
      return c.risk_level === tab;
    })
    .filter((c) => !search || c.brand_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "risk") cmp = (RISK_ORDER[a.risk_level ?? ""] ?? 0) - (RISK_ORDER[b.risk_level ?? ""] ?? 0);
      else if (sortBy === "confidence") cmp = (a.confidence_score ?? 0) - (b.confidence_score ?? 0);
      else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
        <p className="text-sm text-muted-foreground">Every brand check, organized by risk.</p>
      </div>

      <div className="flex items-center gap-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All ({all.length})</TabsTrigger>
            <TabsTrigger value="HIGH">High ({countByRisk("HIGH")})</TabsTrigger>
            <TabsTrigger value="MEDIUM">Medium ({countByRisk("MEDIUM")})</TabsTrigger>
            <TabsTrigger value="LOW">Low ({countByRisk("LOW")})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Search brand…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{filtered.length} cases</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("risk")}>
                  <span className="flex items-center">Risk <SortIcon field="risk" /></span>
                </TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detected</TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("confidence")}>
                  <span className="flex items-center justify-end">Confidence <SortIcon field="confidence" /></span>
                </TableHead>
                <TableHead className="text-center">Case</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && !error && filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell>
                    <Link to="/monitoring/$caseId" params={{ caseId: c.id }} className="flex flex-col min-w-0">
                      <span className="truncate text-sm font-medium">{c.brand_name}</span>
                      <span className="truncate text-xs text-muted-foreground font-mono">{c.id.slice(0, 8)}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {c.risk_level ? (
                      <RiskBadge risk={c.risk_level.toLowerCase() as "high" | "medium" | "low"} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{c.recommended_action ?? "—"}</TableCell>
                  <TableCell><CaseStatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {c.confidence_score != null ? `${Math.round(c.confidence_score * 100)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/monitoring/$caseId" params={{ caseId: c.id }}>See Case</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading cases…
                    </span>
                  </TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-risk-high">
                    Failed to load cases: {error}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No cases yet. Run a brand check from Monitoring to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
