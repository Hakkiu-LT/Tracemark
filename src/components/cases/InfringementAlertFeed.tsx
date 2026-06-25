import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/risk-badge";
import { getInfringements, type InfringementFeedItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import {
  Search,
  X,
  Calendar as CalendarIcon,
  RefreshCw,
  ArrowUpRight,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";

// Platform icons or logo colors mapping
const PLATFORM_THEMES: Record<string, { bg: string; text: string }> = {
  amazon: { bg: "bg-amber-500/10", text: "text-amber-500" },
  shopify: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  instagram: { bg: "bg-pink-500/10", text: "text-pink-500" },
  facebook: { bg: "bg-blue-600/10", text: "text-blue-600" },
  ebay: { bg: "bg-blue-400/10", text: "text-blue-400" },
  aliexpress: { bg: "bg-orange-500/10", text: "text-orange-500" },
  tiktok: { bg: "bg-zinc-800/10", text: "text-zinc-400" },
  google: { bg: "bg-red-500/10", text: "text-red-500" },
  google_ads: { bg: "bg-red-500/10", text: "text-red-500" },
  meta_ads: { bg: "bg-blue-500/10", text: "text-blue-500" },
  domain: { bg: "bg-teal-500/10", text: "text-teal-500" },
};

function getPlatformTheme(platform: string) {
  const norm = platform.toLowerCase();
  for (const k of Object.keys(PLATFORM_THEMES)) {
    if (norm.includes(k)) return PLATFORM_THEMES[k];
  }
  return { bg: "bg-primary/10", text: "text-primary" };
}

function inDateRange(dateStr: string, range: DateRange | undefined) {
  if (!range?.from) return true;
  const d = new Date(dateStr).getTime();
  const from = new Date(range.from);
  from.setHours(0, 0, 0, 0);
  const to = new Date(range.to ?? range.from);
  to.setHours(23, 59, 59, 999);
  return d >= from.getTime() && d <= to.getTime();
}

function FilterPopover({
  label,
  active,
  onClear,
  children,
}: {
  label: string;
  active: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 border-dashed">
          <span>{label}</span>
          {active && (
            <span className="flex h-4 items-center justify-center rounded-full bg-success/20 px-1.5 text-[10px] font-semibold text-success">
              Active
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <div className="space-y-3">
          {children}
          <div className="flex items-center justify-center border-t pt-2">
            <Button variant="ghost" size="sm" disabled={!active} onClick={onClear} className="h-7 text-xs">
              Clear Filter
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function InfringementAlertFeed() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string[]>([]);
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["infringements", riskFilter, platformFilter, statusFilter],
    queryFn: () =>
      getInfringements({
        risk_level: riskFilter.length === 1 ? riskFilter[0] : undefined,
        status: statusFilter.length === 1 ? statusFilter[0] : undefined,
        platform: platformFilter.length === 1 ? platformFilter[0] : undefined,
        limit: 100,
      }),
    refetchInterval: 30000, // Auto refresh every 30s
  });

  useEffect(() => {
    setLastRefreshed(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }, [data, isFetching]);

  const items = data?.items ?? [];

  // Clientside filtering fallback for multiple selections and date / search
  const filteredItems = items
    .filter((i) => riskFilter.length === 0 || riskFilter.includes(i.risk_level))
    .filter((i) => statusFilter.length === 0 || statusFilter.includes(i.status))
    .filter((i) => platformFilter.length === 0 || platformFilter.some((p) => i.platform.toLowerCase().includes(p.toLowerCase())))
    .filter(
      (i) =>
        !search ||
        i.platform.toLowerCase().includes(search.toLowerCase()) ||
        i.source_url.toLowerCase().includes(search.toLowerCase())
    )
    .filter((i) => inDateRange(i.flagged_at || i.created_at, dateRange));

  const riskActive = riskFilter.length > 0;
  const platformActive = platformFilter.length > 0;
  const statusActive = statusFilter.length > 0;
  const dateActive = dateRange?.from != null;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Live infringement alert feed</CardTitle>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Auto-refreshing every 30s • Last checked at {lastRefreshed || "..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} className="h-8 w-8">
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", isFetching && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/cases">
              View all cases <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search feed…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-7 h-8 text-xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground/60 hidden sm:block" />

          {/* Risk Level Filter */}
          <FilterPopover label="Risk" active={riskActive} onClear={() => setRiskFilter([])}>
            <div className="space-y-2">
              {["HIGH", "MEDIUM", "LOW"].map((risk) => (
                <label key={risk} className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <Checkbox
                    checked={riskFilter.includes(risk)}
                    onCheckedChange={(checked) =>
                      setRiskFilter((prev) => (checked ? [...prev, risk] : prev.filter((r) => r !== risk)))
                    }
                  />
                  <RiskBadge risk={risk.toLowerCase() as any} />
                </label>
              ))}
            </div>
          </FilterPopover>

          {/* Platform Filter */}
          <FilterPopover label="Platform" active={platformActive} onClear={() => setPlatformFilter([])}>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {["Amazon", "Shopify", "eBay", "AliExpress", "Instagram", "Facebook", "TikTok", "Google", "Domain"].map(
                (platform) => (
                  <label key={platform} className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                    <Checkbox
                      checked={platformFilter.includes(platform.toLowerCase())}
                      onCheckedChange={(checked) =>
                        setPlatformFilter((prev) =>
                          checked
                            ? [...prev, platform.toLowerCase()]
                            : prev.filter((p) => p !== platform.toLowerCase())
                        )
                      }
                    />
                    <span>{platform}</span>
                  </label>
                )
              )}
            </div>
          </FilterPopover>

          {/* Status Filter */}
          <FilterPopover label="Status" active={statusActive} onClear={() => setStatusFilter([])}>
            <div className="space-y-2">
              {["flagged", "reviewed", "dismissed"].map((status) => (
                <label key={status} className="flex cursor-pointer items-center gap-2 text-xs font-medium capitalize">
                  <Checkbox
                    checked={statusFilter.includes(status)}
                    onCheckedChange={(checked) =>
                      setStatusFilter((prev) => (checked ? [...prev, status] : prev.filter((s) => s !== status)))
                    }
                  />
                  <span>{status}</span>
                </label>
              ))}
            </div>
          </FilterPopover>

          {/* Date Filter */}
          <FilterPopover label="Date Detected" active={dateActive} onClear={() => setDateRange(undefined)}>
            <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={1} />
          </FilterPopover>

          {/* Active indicator */}
          {(riskActive || platformActive || statusActive || dateActive || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setRiskFilter([]);
                setPlatformFilter([]);
                setStatusFilter([]);
                setDateRange(undefined);
              }}
              className="h-8 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              Reset Filters
            </Button>
          )}
        </div>

        {/* Feed List Container */}
        <div className="rounded-lg border bg-card text-card-foreground">
          {isLoading ? (
            <div className="divide-y">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-20 hidden md:block" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <ShieldAlert className="h-8 w-8 text-risk-high" />
              <div>
                <p className="text-sm font-medium">Failed to load infringements</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {error instanceof Error ? error.message : "Internal API Connection Error"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry connection
              </Button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <div className="rounded-full bg-muted p-2">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No infringements found</p>
              <p className="text-xs text-muted-foreground max-w-[280px]">
                No live alerts match your selected filters. Try broadening your query parameters.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredItems.map((item) => {
                const theme = getPlatformTheme(item.platform);
                const detectDate = new Date(item.flagged_at || item.created_at);
                const timeString = detectDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const dateString = detectDate.toLocaleDateString([], { month: "short", day: "numeric" });
                
                // Construct details link
                const targetCaseId = item.case_id || item.id;
                
                return (
                  <Link
                    key={item.id}
                    to="/monitoring/$caseId"
                    params={{ caseId: targetCaseId }}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 group"
                  >
                    {/* Platform Emblem */}
                    <div
                      className={cn(
                        "h-10 w-10 shrink-0 rounded-md border flex items-center justify-center font-bold text-sm select-none",
                        theme.bg,
                        theme.text
                      )}
                    >
                      {item.platform.slice(0, 2).toUpperCase()}
                    </div>

                    {/* Meta Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <RiskBadge risk={item.risk_level.toLowerCase() as any} className="text-[10px] px-1.5 py-0" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 text-[10px]">
                          {item.platform}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          • {dateString} at {timeString}
                        </span>
                        <span className="inline-flex rounded-md border px-1.5 py-0 text-[10px] font-medium capitalize bg-muted text-muted-foreground">
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {item.source_url}
                      </p>
                      <p className="truncate text-xs text-muted-foreground font-mono mt-0.5">
                        Match: {item.match_type} (Score: {Math.round(item.match_score * 100)}%)
                      </p>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center gap-2">
                      <div className="hidden text-right md:block">
                        <p className="text-xs text-muted-foreground">Case reference</p>
                        <p className="text-xs font-mono font-medium">{targetCaseId.slice(0, 8)}</p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
