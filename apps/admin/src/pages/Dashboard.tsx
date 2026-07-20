import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Building2, FileWarning, Package, Users } from "lucide-react";

import { adminFetch } from "@/lib/api";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { Can } from "@/components/Can";

interface CaseRow {
  id: string;
  brand_name: string;
  organization_id: string | null;
  status: string;
  created_at: string | null;
  risk_level: string | null;
  recommended_action: string | null;
  infringement_count: number;
}
interface AuditRow {
  id: string;
  staff_email: string | null;
  action: string;
  created_at: string;
}

const OPEN_STATUSES = new Set(["pending", "analyzing", "reviewed", "active", "escalated"]);

export function Dashboard() {
  const { data: orgs } = useQuery({ queryKey: ["organizations"], queryFn: () => adminFetch<unknown[]>("/organizations") });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => adminFetch<{ plan: string }[]>("/customers") });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => adminFetch<unknown[]>("/brands") });
  const { data: cases, isLoading } = useQuery({ queryKey: ["cases"], queryFn: () => adminFetch<CaseRow[]>("/cases") });
  const { data: audit } = useQuery({ queryKey: ["audit-log"], queryFn: () => adminFetch<AuditRow[]>("/audit-log?limit=8") });

  const openCases = (cases ?? []).filter((c) => OPEN_STATUSES.has(c.status));
  const highRisk = (cases ?? []).filter((c) => c.risk_level === "HIGH" && OPEN_STATUSES.has(c.status));
  const recent = (cases ?? []).slice(0, 8);

  const kpis = [
    { label: "Companies", value: orgs?.length ?? 0, icon: Building2, to: "/organizations" },
    { label: "Customers", value: customers?.length ?? 0, icon: Users, to: "/customers" },
    { label: "Brands", value: brands?.length ?? 0, icon: Package, to: undefined },
    { label: "Open cases", value: openCases.length, icon: FileWarning, to: "/cases" },
    { label: "High-risk open", value: highRisk.length, icon: AlertTriangle, to: "/cases", alert: highRisk.length > 0 },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Operations Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview across all customer accounts.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => {
          const Icon = k.icon;
          const inner = (
            <Card className={k.alert ? "border-destructive/40" : undefined}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
                  <p className={`mt-1 text-2xl font-semibold tabular-nums ${k.alert ? "text-destructive" : ""}`}>{k.value}</p>
                </div>
                <div className={`flex h-8 w-8 items-center justify-center rounded-md ${k.alert ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          );
          return k.to ? <Link key={k.label} to={k.to}>{inner}</Link> : <div key={k.label}>{inner}</div>;
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* High-risk + recent cases */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent cases</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cases yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Infr.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link to="/cases/$caseId" params={{ caseId: c.id }} className="text-accent hover:underline">{c.brand_name}</Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.risk_level === "HIGH" ? "destructive" : c.risk_level === "MEDIUM" ? "warning" : "secondary"}>
                          {c.risk_level || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{c.status}</Badge></TableCell>
                      <TableCell className="tabular-nums">{c.infringement_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent staff activity */}
        <Can permission="audit.view" fallback={<div />}>
          <Card>
            <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(audit ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity.</p>
              ) : (
                (audit ?? []).map((a) => (
                  <div key={a.id} className="text-xs">
                    <span className="font-medium">{a.action}</span>
                    <span className="text-muted-foreground"> · {a.staff_email || "—"}</span>
                    <div className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </Can>
      </div>
    </div>
  );
}
