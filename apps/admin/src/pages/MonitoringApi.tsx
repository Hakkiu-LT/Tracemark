import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

interface ApiSummary {
  api_key: string;
  label: string;
  category: string;
  used_today: number;
  free_limit: number;
  remaining: number;
  percent_used: number;
  is_blocked: boolean;
}
interface UsageStats {
  summary: ApiSummary[];
  hourly: { hour: string; count: number }[];
  generated_at: string;
}

export function MonitoringApi() {
  const { data, isLoading } = useQuery({
    queryKey: ["usage-stats"],
    queryFn: () => adminFetch<UsageStats>("/monitoring/usage-stats"),
    refetchInterval: 30_000,
  });

  const blocked = data?.summary.filter((a) => a.is_blocked).length ?? 0;
  const warning = data?.summary.filter((a) => a.percent_used > 80 && !a.is_blocked).length ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API Usage</h1>
        <p className="text-sm text-muted-foreground">External API limits and call volume (auto-refresh 30s).</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase text-muted-foreground">APIs monitored</p>
                <p className="mt-2 text-3xl font-semibold">{data?.summary.length ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase text-muted-foreground">Warning (&gt;80%)</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--warning)]">{warning}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase text-muted-foreground">Blocked</p>
                <p className="mt-2 text-3xl font-semibold text-destructive">{blocked}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>API status</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>API</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Used / Limit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.summary.map((a) => (
                    <TableRow key={a.api_key}>
                      <TableCell className="font-medium">{a.label}</TableCell>
                      <TableCell className="text-muted-foreground">{a.category}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {a.free_limit >= 999999 ? a.used_today : `${a.used_today} / ${a.free_limit}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.is_blocked ? "destructive" : a.percent_used > 80 ? "warning" : "success"}>
                          {a.is_blocked ? "Blocked" : a.percent_used > 80 ? "Warning" : "Active"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>24h activity</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.hourly ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="hour" fontSize={10} />
                  <YAxis fontSize={10} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
