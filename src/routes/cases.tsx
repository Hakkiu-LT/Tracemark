import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchCaseHistory, type CaseSummary } from "@/lib/supabase";
import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

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
  // If a child route is matched (e.g. /cases/i1), render only the outlet
  if (pathname !== "/cases") return <Outlet />;
  return <CasesList />;
}

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

function CasesList() {
  const [all, setAll] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetchCaseHistory()
      .then((cases) => {
        if (!cancelled) setAll(cases);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load cases");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const countByRisk = (risk: string) => all.filter((c) => c.risk_level === risk).length;

  const filtered = all.filter((c) => {
    if (tab === "all") return true;
    return c.risk_level === tab;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
        <p className="text-sm text-muted-foreground">Every brand check, organized by risk.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({all.length})</TabsTrigger>
          <TabsTrigger value="HIGH">High ({countByRisk("HIGH")})</TabsTrigger>
          <TabsTrigger value="MEDIUM">Medium ({countByRisk("MEDIUM")})</TabsTrigger>
          <TabsTrigger value="LOW">Low ({countByRisk("LOW")})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{filtered.length} cases</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detected</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead className="text-center">Case</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading &&
                !error &&
                filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        to="/monitoring/$caseId"
                        params={{ caseId: c.id }}
                        className="flex flex-col min-w-0"
                      >
                        <span className="truncate text-sm font-medium">{c.brand_name}</span>
                        <span className="truncate text-xs text-muted-foreground font-mono">
                          {c.id.slice(0, 8)}
                        </span>
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
                    <TableCell>
                      <CaseStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {c.confidence_score != null ? `${Math.round(c.confidence_score * 100)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/monitoring/$caseId" params={{ caseId: c.id }}>
                          See Case
                        </Link>
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
