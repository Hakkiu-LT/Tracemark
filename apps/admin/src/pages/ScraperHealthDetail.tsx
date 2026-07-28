import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { adminFetch } from "@/lib/api";
import { PlatformLogo } from "@/components/platform-logo";
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

interface ScraperEvent {
  platform: string | null;
  brand_name: string | null;
  country: string | null;
  success: boolean | null;
  latency_ms: number | null;
  error_category: string | null;
  error_detail: string | null;
  source: string | null;
  caller_id: string | null;
  checked_at: string | null;
}

interface ScraperEventsResponse {
  platform: string;
  window: string;
  events: ScraperEvent[];
}

type Window = "24h" | "7d";
type Status = "all" | "failed";
type Source = "all" | "live" | "probe";

export function ScraperHealthDetail() {
  const { platform } = useParams({ strict: false }) as { platform: string };
  const [window, setWindow] = useState<Window>("24h");
  const [status, setStatus] = useState<Status>("all");
  const [source, setSource] = useState<Source>("all");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["scraper-health-events", platform, window, status, source],
    queryFn: () =>
      adminFetch<ScraperEventsResponse>(
        `/scraper-health/${platform}/events?window=${window}&status=${status}&source=${source}`,
      ),
    refetchInterval: 60_000,
  });

  const platformLabel = platform.replace(/_/g, " ");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/monitoring/scrapers"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Scraper Health
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold capitalize tracking-tight">
            <PlatformLogo platform={platform} className="h-7 w-7" />
            {platformLabel}
          </h1>
          <p className="text-sm text-muted-foreground">
            Individual scrape events — brand scanned, country, outcome, error detail (auto-refresh
            60s).
          </p>
        </div>
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-wrap gap-4">
        {/* Window */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">Window:</span>
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

        {/* Status */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">Status:</span>
          {(["all", "failed"] as Status[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "default" : "outline"}
              onClick={() => setStatus(s)}
            >
              {s === "all" ? "All" : "Failed only"}
            </Button>
          ))}
        </div>

        {/* Source */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">Source:</span>
          {(["all", "live", "probe"] as Source[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={source === s ? "default" : "outline"}
              onClick={() => setSource(s)}
            >
              {s === "all" ? "All" : s}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isError ? (
        <Card>
          <CardContent>
            <ErrorState variant="block" error={error} title="Failed to load scrape events" onRetry={() => refetch()} />
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Events{" "}
              <span className="font-normal text-muted-foreground">
                ({data?.events.length ?? 0})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data || data.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events in this window.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Error type</TableHead>
                    <TableHead>Error detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.events.map((ev, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {ev.checked_at ? new Date(ev.checked_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {ev.brand_name ?? "—"}
                      </TableCell>
                      <TableCell>{ev.country ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={ev.success ? "success" : "destructive"}>
                          {ev.success ? "ok" : "fail"}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {ev.latency_ms != null ? `${ev.latency_ms} ms` : "—"}
                      </TableCell>
                      <TableCell>{ev.error_category ?? "—"}</TableCell>
                      <TableCell className="max-w-xs break-words font-mono text-xs text-muted-foreground">
                        {ev.error_detail ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
