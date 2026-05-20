import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScopedInfringements } from "@/lib/store";
import { RiskBadge, StatusBadge } from "@/components/risk-badge";
import { useState } from "react";

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

function CasesList() {
  const all = useScopedInfringements();
  const [tab, setTab] = useState("active");

  const filtered = all.filter((i) => {
    if (tab === "active") return i.status === "active" || i.status === "escalated";
    if (tab === "takedown") return i.status === "takedown_sent";
    if (tab === "resolved") return i.status === "resolved" || i.status === "safe";
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
        <p className="text-sm text-muted-foreground">Every detected infringement, organized by status.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">Active ({all.filter((i) => i.status === "active" || i.status === "escalated").length})</TabsTrigger>
          <TabsTrigger value="takedown">Takedown sent ({all.filter((i) => i.status === "takedown_sent").length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({all.filter((i) => i.status === "resolved" || i.status === "safe").length})</TabsTrigger>
          <TabsTrigger value="all">All ({all.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader><CardTitle className="text-base">{filtered.length} cases</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Listing</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow key={i.id} className="cursor-pointer">
                  <TableCell>
                    <Link to="/cases/$caseId" params={{ caseId: i.id }} className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 rounded-md" style={{ background: `linear-gradient(135deg, ${i.thumbnail}, oklch(0.3 0.05 260))` }} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{i.title}</p>
                        <p className="truncate text-xs text-muted-foreground font-mono">{i.evidence.url}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{i.brandName}</TableCell>
                  <TableCell className="text-sm">{i.platform}</TableCell>
                  <TableCell><RiskBadge risk={i.risk} /></TableCell>
                  <TableCell><StatusBadge status={i.status} /></TableCell>
                  <TableCell className="text-right font-mono text-sm">{i.analysis.confidence}%</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No cases in this view.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
