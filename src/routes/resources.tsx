import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

// Lucide Icons
import { Activity, AlertTriangle, Cpu, HardDrive, Layout, RefreshCw, Terminal, Layers } from "lucide-react";

// Shadcn/UI Components
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

// Recharts
import { LineChart, Line, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "System Resources — Tracemark" },
      { name: "description", content: "Real-time system CPU, memory, and browser processes monitoring." },
    ],
  }),
  component: ResourcesPage,
});

interface MetricEntry {
  timestamp: string;
  ram_total: number;
  ram_used: number;
  ram_percent: number;
  process_rss: number;       // FastAPI process only
  scraper_rss: number;       // sum of all child Playwright/Chromium processes
  cpu_percent: number;
  child_browsers: number;
}

function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return isoStr;
  }
}

export function ResourcesPage() {
  const { profile } = useAuth();
  const [autoRefresh, setAutoRefresh] = useState(true);

  const isAdmin = !!profile?.is_admin || profile?.plan === "admin";

  const { data, isLoading, error, refetch } = useQuery<MetricEntry[], Error>({
    queryKey: ["admin-resource-metrics"],
    queryFn: () => apiFetch<MetricEntry[]>("/admin/resources/metrics"),
    refetchInterval: autoRefresh ? 5000 : false,
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/20 bg-destructive/5 text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-10 w-10 text-destructive animate-pulse" />
            </div>
            <CardTitle className="text-lg font-bold text-destructive">Access Denied</CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              You do not have permission to view the System Resource Monitor.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground leading-relaxed px-6 pb-6">
            This administration tab contains system-level infrastructure stats, memory allocations, and worker process counts.
          </CardContent>
        </Card>
      </div>
    );
  }

  const chartData = (data || []).map((d) => ({
    ...d,
    timeLabel: formatTime(d.timestamp),
    ramGB:    Number((d.ram_used    / (1024 * 1024 * 1024)).toFixed(2)),
    rssMB:    Number((d.process_rss / (1024 * 1024)).toFixed(1)),
    scraperMB: Number(((d.scraper_rss ?? 0) / (1024 * 1024)).toFixed(1)),
  }));

  const latest = chartData[chartData.length - 1] || null;

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Resource Usage</h1>
          <p className="text-sm text-muted-foreground">
            Monitor real-time RAM, CPU, Process RSS, and Chromium scraper instances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? "animate-spin text-success" : ""}`} />
            {autoRefresh ? "Live Sync (5s)" : "Paused"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9">
            Refresh Now
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5 text-destructive p-4 flex gap-3 items-start">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Failed to retrieve server metrics</h4>
            <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
          </div>
        </Card>
      )}

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CPU */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Server CPU</CardTitle>
            <Cpu className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">{latest ? `${latest.cpu_percent.toFixed(1)}%` : "0.0%"}</div>
            )}
            <CardDescription className="text-[10px] mt-1">Host usage capacity</CardDescription>
          </CardContent>
        </Card>

        {/* System Memory */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">System RAM</CardTitle>
            <HardDrive className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <>
                <div className="text-2xl font-bold">{latest ? `${latest.ram_percent.toFixed(1)}%` : "0.0%"}</div>
                <CardDescription className="text-[10px] mt-1">
                  {latest ? `${formatBytes(latest.ram_used)} / ${formatBytes(latest.ram_total)}` : "—"}
                </CardDescription>
              </>
            )}
          </CardContent>
        </Card>

        {/* FastAPI Process RSS */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">API Process RSS</CardTitle>
            <Terminal className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-2xl font-bold">{latest ? formatBytes(latest.process_rss) : "0 MB"}</div>
            )}
            <CardDescription className="text-[10px] mt-1">FastAPI daemon only</CardDescription>
          </CardContent>
        </Card>

        {/* Scraper processes RSS */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Scraper RAM</CardTitle>
            <Layers className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                {latest ? formatBytes(latest.scraper_rss ?? 0) : "0 MB"}
              </div>
            )}
            <CardDescription className="text-[10px] mt-1">
              {latest ? `${latest.child_browsers} Playwright process${latest.child_browsers !== 1 ? "es" : ""}` : "Playwright processes"}
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Visual Charts */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 h-[300px]">
            <Skeleton className="w-full h-full" />
          </Card>
          <Card className="p-6 h-[300px]">
            <Skeleton className="w-full h-full" />
          </Card>
        </div>
      ) : chartData.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed min-h-[300px]">
          <Activity className="h-8 w-8 text-muted-foreground animate-pulse mb-3" />
          <h3 className="font-semibold text-sm">Waiting for monitoring session</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            Recorder triggers automatically when at least one brand status is set to "Active". Check standard monitoring settings.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* CPU & Browsers Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">CPU Usage & Child Browsers</CardTitle>
              <CardDescription className="text-[11px]">Surveillance log history</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="timeLabel" fontSize={9} />
                  <YAxis fontSize={9} />
                  <ChartTooltip
                    contentStyle={{ backgroundColor: "hsl(var(--background))", borderRadius: "6px" }}
                    labelStyle={{ fontSize: "10px", fontWeight: "bold" }}
                  />
                  <Line type="monotone" dataKey="cpu_percent" stroke="hsl(var(--primary))" name="CPU %" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="child_browsers" stroke="hsl(var(--warning))" name="Chromium Count" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Memory Chart — System vs API vs Scrapers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Memory Breakdown</CardTitle>
              <CardDescription className="text-[11px]">
                System RAM vs API process vs Scraper processes
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="timeLabel" fontSize={9} />
                  <YAxis fontSize={9} unit=" MB" />
                  <ChartTooltip
                    contentStyle={{ backgroundColor: "hsl(var(--background))", borderRadius: "6px" }}
                    labelStyle={{ fontSize: "10px", fontWeight: "bold" }}
                    formatter={(val: any, name?: string | number | symbol) => {
                      const nameStr = String(name || "");
                      if (nameStr.includes("GB")) {
                        return [`${val} GB`, nameStr];
                      }
                      return [`${val} MB`, nameStr];
                    }}
                  />
                  <Line type="monotone" dataKey="ramGB" stroke="#8b5cf6" name="System RAM (GB)" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="rssMB" stroke="#14b8a6" name="API Process (MB)" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="scraperMB" stroke="#f97316" name="Scrapers (MB)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Metrics History Table */}
      {!isLoading && chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Recorded Metrics Logs</CardTitle>
            <CardDescription className="text-[11px]">Chronological buffer listing</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[300px] overflow-y-auto pt-4 p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 text-[10px] uppercase">Timestamp</TableHead>
                  <TableHead className="text-[10px] uppercase">CPU Usage</TableHead>
                  <TableHead className="text-[10px] uppercase">System RAM</TableHead>
                  <TableHead className="text-[10px] uppercase">Process RSS</TableHead>
                  <TableHead className="text-[10px] uppercase pr-6 text-right">Child Browsers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartData
                  .slice()
                  .reverse()
                  .map((log, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="pl-6 font-mono text-[10px] text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{log.cpu_percent.toFixed(1)}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.ram_percent.toFixed(1)}% ({formatBytes(log.ram_used)})
                      </TableCell>
                      <TableCell className="text-xs font-mono">{formatBytes(log.process_rss)}</TableCell>
                      <TableCell className="text-xs font-medium pr-6 text-right text-warning">
                        {log.child_browsers}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
