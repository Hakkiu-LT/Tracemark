import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { UsageStatsResponse, ApiUsageSummary } from "@/lib/types/api-usage";
import { useState } from "react";

// Lucide Icons
import { Activity, AlertTriangle, AlertCircle, ShieldCheck, RefreshCw, HelpCircle, HardDrive, Terminal } from "lucide-react";

// Shadcn/UI Components
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Recharts for hourly logs
import { BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/api-usage")({
  head: () => ({
    meta: [
      { title: "API Usage Monitor – Tracemark" },
      { name: "description", content: "Real-time surveillance and monitoring of Tracemark external APIs usage and limits." },
    ],
  }),
  component: ApiUsagePage,
});

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  try {
    const parsed = new Date(iso);
    const diffMs = Date.now() - parsed.getTime();
    if (isNaN(diffMs)) return "Never";

    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 10) return "just now";
    if (diffSecs < 60) return `${diffSecs}s ago`;

    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins} min ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  } catch {
    return "Never";
  }
}

const categoryStyles: Record<string, string> = {
  search: "bg-blue-500/10 text-blue-500 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400",
  whois: "bg-purple-500/10 text-purple-500 border border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400",
  ads: "bg-orange-500/10 text-orange-500 border border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400",
  ai: "bg-teal-500/10 text-teal-600 border border-teal-500/20 dark:bg-teal-500/20 dark:text-teal-400",
  scraper: "bg-slate-500/10 text-slate-600 border border-slate-500/20 dark:bg-slate-500/20 dark:text-slate-400",
};

function shouldHideLimit(api: ApiUsageSummary): boolean {
  return api.free_limit >= 999_999 || api.api_key === "whois";
}

function ApiUsagePage() {
  const [alertDismissed, setAlertDismissed] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<UsageStatsResponse, Error>({
    queryKey: ["api-usage-stats"],
    queryFn: () => apiFetch<UsageStatsResponse>("/usage-stats", { method: "GET" }),
    refetchInterval: 30_000,   // auto-refresh every 30 seconds
    staleTime: 20_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API Usage Monitor</h1>
          <p className="text-sm text-muted-foreground">Monitoring active connections, limits, and rates.</p>
        </div>

        {/* 4 Cards Skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-36" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full rounded-lg" />
          </CardContent>
        </Card>

        {/* Chart Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API Usage Monitor</h1>
          <p className="text-sm text-muted-foreground">Monitoring active connections, limits, and rates.</p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load usage stats</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4 mt-2">
            <span>{error?.message || "An unexpected error occurred while fetching telemetry data."}</span>
            <Button variant="outline" size="sm" className="bg-destructive/10 hover:bg-destructive/20 text-destructive-foreground" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Calculate stats from response
  const totalCallsToday = data.summary.reduce((acc, curr) => acc + (curr.reset_period === "midnight_utc" ? curr.used_today : 0), 0);
  const totalMonitored = data.summary.length;
  const warningsCount = data.summary.filter(a => a.percent_used > 80 && !a.is_blocked).length;
  const blockedCount = data.summary.filter(a => a.is_blocked).length;
  const blockedApis = data.summary.filter(a => a.is_blocked);

  // Dynamic keys for developer usage columns
  const apiKeys = data.summary.map(s => s.api_key);

  return (
    <div className="space-y-6">
      {/* Alert banner for blocked APIs */}
      {blockedCount > 0 && !alertDismissed && (
        <Alert variant="destructive" className="relative pr-10">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Rate Limits Exhausted</AlertTitle>
          <AlertDescription>
            ⛔ {blockedCount} API(s) have hit their free plan limit and are currently blocked:{" "}
            <strong>{blockedApis.map(a => a.label).join(", ")}</strong>.
            Calls to these APIs will be rejected until the next reset window.
          </AlertDescription>
          <button 
            onClick={() => setAlertDismissed(true)} 
            className="absolute top-3 right-3 text-destructive-foreground/75 hover:text-destructive-foreground text-xs font-semibold p-1"
          >
            Dismiss
          </button>
        </Alert>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API Usage Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Overview of monitored external APIs, current limits, and hourly rate breakdowns.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9">
          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Force Refresh
        </Button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Calls */}
        <Card>
          <CardContent className="p-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total API Calls Today</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{totalCallsToday}</p>
              <p className="mt-1 text-xs text-muted-foreground">Across all daily APIs</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-md text-primary bg-primary/10">
              <Terminal className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        {/* APIs Monitored */}
        <Card>
          <CardContent className="p-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">APIs Monitored</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{totalMonitored}</p>
              <p className="mt-1 text-xs text-muted-foreground">Configured in API registry</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 bg-slate-100 dark:bg-slate-800">
              <HardDrive className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        {/* Warning APIs */}
        <Card>
          <CardContent className="p-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Warning Capacity</p>
              <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${warningsCount > 0 ? "text-amber-500" : ""}`}>
                {warningsCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">APIs at &gt;80% capacity</p>
            </div>
            <div className={`flex h-9 w-9 items-center justify-center rounded-md ${warningsCount > 0 ? "text-amber-500 bg-amber-100 dark:bg-amber-950/30" : "text-slate-400 bg-slate-100 dark:bg-slate-800"}`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        {/* Blocked APIs */}
        <Card>
          <CardContent className="p-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">APIs Blocked</p>
              <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${blockedCount > 0 ? "text-destructive" : "text-emerald-500"}`}>
                {blockedCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Limits exhausted</p>
            </div>
            <div className={`flex h-9 w-9 items-center justify-center rounded-md ${blockedCount > 0 ? "text-destructive bg-destructive/10" : "text-emerald-500 bg-emerald-500/10"}`}>
              <ShieldCheck className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid: APIs Status List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">APIs Status Surveillance</CardTitle>
          <CardDescription>Metrics, warning thresholds, and configuration settings for our core services.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>API Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Reset Period</TableHead>
                  <TableHead className="w-1/4">Usage Progress</TableHead>
                  <TableHead className="text-right">Usage / Limit</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Last Called</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.summary.map((api) => {
                  const progressColor = 
                    api.percent_used > 80 ? "bg-red-500" :
                    api.percent_used > 50 ? "bg-amber-500" :
                    "bg-emerald-500";

                  const statusVariant = 
                    api.is_blocked ? "destructive" :
                    api.percent_used > 80 ? "warning" :
                    "secondary";

                  return (
                    <TableRow key={api.api_key}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{api.label}</span>
                          {api.requires_env_var && !api.env_var_present && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-amber-500 cursor-help select-none">⚠️</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Requires env var <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{api.requires_env_var}</code> (not set)
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${categoryStyles[api.category] || ""} font-medium shadow-none`}>
                          {api.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-medium capitalize">
                      {api.reset_period === "midnight_utc" ? "Resets daily" : "Resets monthly"}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={shouldHideLimit(api) ? 0 : api.percent_used} className={`h-2 [&>div]:${progressColor}`} />
                          {!shouldHideLimit(api) && (
                            <span className="text-[10px] text-muted-foreground font-medium">{api.percent_used.toFixed(1)}%</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums font-semibold">
                        {shouldHideLimit(api)
                          ? <span>{api.used_today}</span>
                          : <>{api.used_today} / {api.free_limit}</>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {shouldHideLimit(api) ? "—" : api.remaining}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant} className="font-semibold shadow-none">
                          {api.is_blocked ? "BLOCKED" : api.percent_used > 80 ? "Warning" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatRelativeTime(api.last_called_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Stacked Cards View */}
          <div className="md:hidden divide-y">
            {data.summary.map((api) => {
              const progressColor = 
                api.percent_used > 80 ? "bg-red-500" :
                api.percent_used > 50 ? "bg-amber-500" :
                "bg-emerald-500";

              return (
                <div key={api.api_key} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-sm flex items-center gap-1">
                        {api.label}
                        {api.requires_env_var && !api.env_var_present && (
                          <span className="text-amber-500 text-xs" title={`Requires env var ${api.requires_env_var} - not set`}>⚠️</span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`${categoryStyles[api.category]} text-[10px] py-0 px-1.5`}>
                          {api.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {api.reset_period === "midnight_utc" ? "daily" : "monthly"}
                        </span>
                      </div>
                    </div>
                    <Badge variant={api.is_blocked ? "destructive" : api.percent_used > 80 ? "warning" : "secondary"}>
                      {api.is_blocked ? "BLOCKED" : api.percent_used > 80 ? "Warning" : "Active"}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span>Progress{!shouldHideLimit(api) ? ` (${api.percent_used.toFixed(1)}%)` : ""}</span>
                      <span className="tabular-nums font-semibold">
                        {shouldHideLimit(api)
                          ? api.used_today
                          : `${api.used_today} / ${api.free_limit}`}
                      </span>
                    </div>
                    <Progress value={shouldHideLimit(api) ? 0 : api.percent_used} className={`h-2 [&>div]:${progressColor}`} />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Remaining: <strong className="font-mono tabular-nums text-foreground">{shouldHideLimit(api) ? "—" : api.remaining}</strong></span>
                    <span>Last called: <strong>{formatRelativeTime(api.last_called_at)}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Section 3: Usage by Developer (Table) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Usage by Developer</CardTitle>
            <CardDescription>Caller statistics and API usage breakdown for today (UTC).</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {data.by_developer.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No activity logged today.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Caller ID</TableHead>
                      <TableHead className="text-right">Total Calls</TableHead>
                      {apiKeys.map(key => (
                        <TableHead key={key} className="text-right text-xs capitalize">
                          {key.replace("_", " ")}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_developer.map((dev) => (
                      <TableRow key={dev.caller_id}>
                        <TableCell className="font-mono text-xs font-medium max-w-[150px] truncate">
                          {dev.caller_id}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                          {dev.total_calls_today}
                        </TableCell>
                        {apiKeys.map(key => (
                          <TableCell key={key} className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                            {dev.by_api[key] || "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4: 24h Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">24h System Activity</CardTitle>
            <CardDescription>Aggregated hourly API call frequencies over the last 24 hours (UTC).</CardDescription>
          </CardHeader>
          <CardContent className="h-[230px] pr-2 flex items-center justify-center">
            {data.hourly.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent logging history available.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" allowDecimals={false} />
                  <ChartTooltip 
                    contentStyle={{ 
                      background: "hsl(var(--popover))", 
                      border: "1px solid hsl(var(--border))", 
                      borderRadius: "var(--radius)",
                      color: "hsl(var(--popover-foreground))",
                      fontSize: "11px"
                    }} 
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
