import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { adminFetch } from "@/lib/api";
import {
  Badge,
  Button,
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
import { ErrorState } from "@/components/error-state";

interface PlatformHealth {
  platform: string;
  total: number;
  failed: number;
  success_rate: number; // 0..1
  avg_latency_ms: number;
  last_failure_category: string | null;
  last_failure_detail: string | null;
  last_failure_at: string | null;
  last_checked_at: string | null;
  is_degraded: boolean;
}
interface ScraperHealthResponse {
  window: string;
  platforms: PlatformHealth[];
  firecrawl_credits_used: number;
}

type Window = "24h" | "7d";

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function ScraperHealth() {
  const [window, setWindow] = useState<Window>("24h");
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["scraper-health", window],
    queryFn: () => adminFetch<ScraperHealthResponse>(`/scraper-health?window=${window}`),
    refetchInterval: 60_000,
  });

  const platforms = data?.platforms ?? [];
  const degraded = platforms.filter((p) => p.is_degraded).length;
  const overallRate =
    platforms.length > 0
      ? platforms.reduce((s, p) => s + p.success_rate, 0) / platforms.length
      : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scraper Health</h1>
          <p className="text-sm text-muted-foreground">
            Per-platform success rate, latency and recent failures across all scans
            (auto-refresh 60s).
          </p>
        </div>
        <div className="flex gap-1">
          {(["24h", "7d"] as Window[]).map((w) => (
            <Button
              key={w}
              size="sm"
              variant={window === w ? "default" : "outline"}
              onClick={() => setWindow(w)}
            >
              {w}
            </Button>
          ))}
        </div>
      </div>

      {isError ? (
        <Card>
          <CardContent>
            <ErrorState variant="block" error={error} title="Failed to load scraper health" onRetry={() => refetch()} />
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase text-muted-foreground">Overall success rate</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{pct(overallRate)}</p>
              </CardContent>
            </Card>
            <Card className={degraded > 0 ? "border-destructive/40" : undefined}>
              <CardContent className="p-5">
                <p className="text-xs uppercase text-muted-foreground">Degraded platforms</p>
                <p className={`mt-2 text-3xl font-semibold tabular-nums ${degraded > 0 ? "text-destructive" : ""}`}>
                  {degraded}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase text-muted-foreground">Firecrawl credits used</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">
                  {data?.firecrawl_credits_used ?? 0}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Platforms</CardTitle>
            </CardHeader>
            <CardContent>
              {platforms.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No scraper activity in this window yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Success rate</TableHead>
                      <TableHead>Runs (failed)</TableHead>
                      <TableHead>Avg latency</TableHead>
                      <TableHead>Last failure</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {platforms.map((p) => (
                      <TableRow key={p.platform} className={p.is_degraded ? "bg-destructive/5" : undefined}>
                        <TableCell className="font-medium capitalize">
                          <span className="flex items-center gap-2">
                            {p.is_degraded && <AlertTriangle className="h-4 w-4 text-destructive" />}
                            <Link
                              to="/monitoring/scrapers/$platform"
                              params={{ platform: p.platform }}
                              className="text-accent hover:underline"
                            >
                              {p.platform.replace(/_/g, " ")}
                            </Link>
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              p.is_degraded ? "destructive" : p.success_rate < 0.95 ? "warning" : "success"
                            }
                          >
                            {pct(p.success_rate)}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {p.total} <span className="text-muted-foreground">({p.failed})</span>
                        </TableCell>
                        <TableCell className="tabular-nums">{p.avg_latency_ms} ms</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.last_failure_category ? (
                            <span title={p.last_failure_detail ?? undefined}>
                              <span className="font-medium">{p.last_failure_category}</span>
                              {p.last_failure_at
                                ? ` · ${new Date(p.last_failure_at).toLocaleString()}`
                                : ""}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
