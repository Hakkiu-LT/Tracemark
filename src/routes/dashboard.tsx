import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, AlertTriangle, CheckCircle2, TrendingUp, ArrowUpRight } from "lucide-react";
import { useScopedMarks, useStore } from "@/lib/store";
import { InfringementAlertFeed } from "@/components/cases/InfringementAlertFeed";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { getInfringements } from "@/lib/api";
import { ClientBillingCard } from "@/components/ClientBillingCard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard - Tracemark" },
      { name: "description", content: "Overview of monitored marks, active infringements, and takedown performance." },
    ],
  }),
  component: Dashboard,
});

const trend = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  rate: Math.round(72 + Math.sin(i / 3) * 6 + i * 0.3),
}));

function Dashboard() {
  const marks = useScopedMarks();
  const persona = useStore((s) => s.persona);

  // Fetch actual live database infringements via FastAPI backend
  const { data: dbInfringementsData } = useQuery({
    queryKey: ["dashboard_infringements"],
    queryFn: () => getInfringements({ limit: 100 }),
  });
  const infringements = dbInfringementsData?.items ?? [];

  const active = infringements.filter((i) => i.status === "flagged" || i.status === "active").length;
  const takedowns = infringements.filter((i) => i.status === "reviewed" || i.status === "takedown_sent" || i.status === "resolved").length;
  const total = infringements.length;
  const successRate = total > 0 ? Math.round((takedowns / total) * 100) : 0;

  // Group by platform dynamically using actual backend data names
  const platformCounts: Record<string, number> = {};
  for (const item of infringements) {
    const rawName = item.platform || "unknown";
    const name = rawName.charAt(0).toUpperCase() + rawName.slice(1).replace("_", " ");
    platformCounts[name] = (platformCounts[name] || 0) + 1;
  }
  
  const platformData = Object.entries(platformCounts)
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0);

  const chartColors = ["oklch(0.58 0.18 255)", "oklch(0.62 0.15 155)", "oklch(0.72 0.17 65)", "oklch(0.58 0.22 27)", "oklch(0.45 0.12 280)", "oklch(0.5 0.1 200)"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Brand protection overview</h1>
          <p className="text-sm text-muted-foreground">
            {persona === "law_firm" ? "Aggregated infringement activity across your client portfolio." : "Live monitoring across every platform your marks are registered on."}
          </p>
        </div>
        <Button asChild>
          <Link to="/monitoring/new">+ Add monitored asset</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={ShieldCheck} label="Monitored marks" value={marks.length} sub="across all platforms" />
        <Metric icon={AlertTriangle} label="Active infringements" value={active} sub="awaiting review" tone="risk" />
        <Metric icon={CheckCircle2} label="Successful takedowns" value={takedowns} sub="this quarter" tone="success" />
        <Metric icon={TrendingUp} label="Success rate" value={`${successRate}%`} sub="30-day rolling avg" tone="accent" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Takedown success rate - last 30 days</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px] pr-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.58 0.18 255)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.58 0.18 255)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="oklch(0.6 0.02 257)" />
                <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.6 0.02 257)" domain={[60, 100]} unit="%" />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.05 260)", border: "none", borderRadius: 8, color: "white", fontSize: 12 }} />
                <Area type="monotone" dataKey="rate" stroke="oklch(0.58 0.18 255)" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Infringements by platform</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={platformData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} strokeWidth={0}>
                  {platformData.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {persona === "law_firm" && (
        <div className="grid grid-cols-1 gap-4">
          <ClientBillingCard />
        </div>
      )}

      <InfringementAlertFeed />
    </div>
  );
}

function Metric({
  icon: Icon, label, value, sub, tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub: string;
  tone?: "default" | "risk" | "success" | "accent";
}) {
  const toneCls = {
    default: "text-primary bg-primary/10",
    risk: "text-risk-high bg-risk-high/10",
    success: "text-success bg-success/10",
    accent: "text-accent bg-accent/10",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-md ${toneCls}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

