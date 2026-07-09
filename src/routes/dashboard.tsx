import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, AlertTriangle, CheckCircle2, TrendingUp, ArrowUpRight } from "lucide-react";
import { useScopedMarks, useStore } from "@/lib/store";
import { InfringementAlertFeed } from "@/components/cases/InfringementAlertFeed";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { getInfringements } from "@/lib/api";
import { fetchCaseHistory } from "@/lib/supabase";
import { ClientBillingCard } from "@/components/ClientBillingCard";
import { cn } from "@/lib/utils";
import { getRegionForId, getMacroRegionForCountry } from "@/lib/regions";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard - Tracemark" },
      { name: "description", content: "Overview of monitored marks, active infringements, and takedown performance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const marks = useScopedMarks();
  const persona = useStore((s) => s.persona);
  const [selectedMacroRegion, setSelectedMacroRegion] = useState("ALL");

  // Fetch actual live database cases via Supabase
  const { data: dbCasesData } = useQuery({
    queryKey: ["dashboard_cases", persona],
    queryFn: () => fetchCaseHistory(100, persona),
  });
  const cases = dbCasesData ?? [];

  // Fetch actual live database infringements for platform distribution
  const { data: dbInfringementsData } = useQuery({
    queryKey: ["dashboard_infringements"],
    queryFn: () => getInfringements({ limit: 100 }),
  });
  const infringements = dbInfringementsData?.items ?? [];

  const filteredCases = cases.filter((c) => {
    if (selectedMacroRegion === "ALL") return true;
    const cCode = getRegionForId(c.id);
    const mReg = getMacroRegionForCountry(cCode);
    return mReg === selectedMacroRegion;
  });

  const filteredInfringements = infringements.filter((i) => {
    if (selectedMacroRegion === "ALL") return true;
    const cCode = getRegionForId(i.case_id || i.id);
    const mReg = getMacroRegionForCountry(cCode);
    return mReg === selectedMacroRegion;
  });

  const active = filteredCases.filter(
    (c) => c.status === "pending" || c.status === "analyzing" || c.status === "reviewed" || c.status === "active"
  ).length;
  
  // Successful takedowns: status is complete, completed, or resolved
  const successfulTakedowns = filteredCases.filter(
    (c) => c.status === "complete" || c.status === "completed" || c.status === "resolved"
  ).length;

  // Declined takedowns
  const declinedTakedowns = filteredCases.filter((c) => c.status === "declined").length;

  // Success rate is calculated over the cases that have been resolved/finalized (complete or declined)
  const totalResolved = successfulTakedowns + declinedTakedowns;
  const successRate = totalResolved > 0 ? Math.round((successfulTakedowns / totalResolved) * 100) : 100;

  // Compute real success rate trend over the last 30 days using cases
  const trend = Array.from({ length: 30 }, (_, i) => {
    // Generate dates from 29 days ago to today
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() - (29 - i));
    dayDate.setHours(23, 59, 59, 999);

    // Get all cases created or updated to resolved/declined up to this day
    const historicalCases = filteredCases.filter((item) => {
      const isResolved = item.status === "complete" || item.status === "completed" || item.status === "resolved" || item.status === "declined";
      const caseDate = new Date(
        (isResolved && item.updated_at) ? item.updated_at : item.created_at
      );
      return caseDate <= dayDate;
    });

    // Count completes/resolved vs declined up to this day
    const completes = historicalCases.filter(
      (item) => item.status === "complete" || item.status === "completed" || item.status === "resolved"
    ).length;
    const declineds = historicalCases.filter((item) => item.status === "declined").length;

    const historicalResolved = completes + declineds;
    const rate = historicalResolved > 0 ? Math.round((completes / historicalResolved) * 100) : 100;

    return {
      day: dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      rate,
    };
  });

  // Group by platform dynamically using actual backend data names
  const platformCounts: Record<string, number> = {};
  for (const item of filteredInfringements) {
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

      {/* Region Tabs */}
      <div className="flex border-b border-border gap-2">
        {["ALL", "North America", "EMEA", "APAC", "LATAM"].map((region) => {
          const active = selectedMacroRegion === region;
          return (
            <button
              key={region}
              onClick={() => setSelectedMacroRegion(region)}
              className={cn(
                "pb-2.5 px-4 text-sm font-semibold border-b-2 -mb-[2px] transition-all cursor-pointer select-none",
                active
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {region === "ALL" ? "All Regions" : region}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={ShieldCheck} label="Monitored marks" value={marks.length} sub="across all platforms" />
        <Metric icon={AlertTriangle} label="Active infringements" value={active} sub="awaiting review" tone="risk" />
        <Metric icon={CheckCircle2} label="Successful takedowns" value={successfulTakedowns} sub="this quarter" tone="success" />
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
                <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.6 0.02 257)" domain={[0, 100]} unit="%" />
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

      <InfringementAlertFeed regionFilter={selectedMacroRegion} />
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

