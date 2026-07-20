import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { adminFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";

interface Metric {
  timestamp: string;
  ram_percent: number;
  process_rss: number;
  scraper_rss: number;
  cpu_percent: number;
  child_browsers: number;
}

function mb(bytes: number) {
  return Number((bytes / (1024 * 1024)).toFixed(1));
}

export function MonitoringResources() {
  const { data, isLoading } = useQuery({
    queryKey: ["resource-metrics"],
    queryFn: () => adminFetch<Metric[]>("/monitoring/resources/metrics"),
    refetchInterval: 5000,
  });

  const chart = (data ?? []).map((m) => ({
    time: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    cpu: m.cpu_percent,
    ram: m.ram_percent,
    apiMB: mb(m.process_rss),
    scraperMB: mb(m.scraper_rss ?? 0),
    browsers: m.child_browsers,
  }));
  const latest = chart[chart.length - 1];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resource Usage</h1>
        <p className="text-sm text-muted-foreground">Live server CPU/RAM and scraper processes (auto-refresh 5s).</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : chart.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No monitoring samples yet. The recorder runs while brands are actively monitored.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase text-muted-foreground">CPU</p>
                <p className="mt-2 text-2xl font-semibold">{latest?.cpu.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase text-muted-foreground">System RAM</p>
                <p className="mt-2 text-2xl font-semibold">{latest?.ram.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase text-muted-foreground">API Process</p>
                <p className="mt-2 text-2xl font-semibold">{latest?.apiMB} MB</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase text-muted-foreground">Scrapers</p>
                <p className="mt-2 text-2xl font-semibold">{latest?.browsers}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>CPU & browsers</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="time" fontSize={9} />
                    <YAxis fontSize={9} />
                    <Tooltip />
                    <Line type="monotone" dataKey="cpu" stroke="var(--accent)" dot={false} name="CPU %" />
                    <Line type="monotone" dataKey="browsers" stroke="var(--warning)" dot={false} name="Browsers" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Memory (MB)</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="time" fontSize={9} />
                    <YAxis fontSize={9} />
                    <Tooltip />
                    <Line type="monotone" dataKey="apiMB" stroke="#14b8a6" dot={false} name="API MB" />
                    <Line type="monotone" dataKey="scraperMB" stroke="#f97316" dot={false} name="Scrapers MB" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
