import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { getInfringements, type InfringementFeedItem } from "@/lib/api";
import { deleteInfringementFromSupabase } from "@/lib/supabase";

import { CaseStatusBadge, CaseStatusSelect, normalizeStatusKey } from "@/components/cases/CaseStatus";
import { RiskBadge } from "@/components/risk-badge";
import { PlatformLogo } from "@/components/platform-logo";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search, X, Info } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { consumeCasesView, saveCasesView, type SortDir, type SortField } from "@/lib/cases-view";
import { toast } from "sonner";
import { getRegionForId, getMacroRegionForCountry, COUNTRY_BY_CODE } from "@/lib/regions";
import { useStore } from "@/lib/store";

const PAGE_SIZE = 20;

/** Build a compact page list with ellipsis for large page counts. */
function pageItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

const RISK_ORDER: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const STATUS_ORDER: Record<string, number> = {
  pending: 1,
  flagged: 1,
  analyzing: 2,
  active: 2,
  escalated: 3,
  takedown_sent: 3,
  complete: 4,
  completed: 4,
  resolved: 4,
  declined: 5,
  safe: 6,
  dismissed: 6,
  error: 7,
};

function inDateRange(dateStr: string, range: DateRange | undefined) {
  if (!range?.from) return true;
  const d = new Date(dateStr).getTime();
  const from = new Date(range.from);
  from.setHours(0, 0, 0, 0);
  const to = new Date(range.to ?? range.from);
  to.setHours(23, 59, 59, 999);
  return d >= from.getTime() && d <= to.getTime();
}

/** Filter trigger button + popover. Selections apply instantly; Clear resets the filter. */
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
        <Button variant="outline" size="sm" className="gap-2">
          {label}
          {active && <span className="h-2 w-2 rounded-full bg-success" aria-hidden />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <div className="space-y-3">
          {children}
          <div className="flex items-center justify-center border-t pt-3">
            <Button variant="ghost" size="sm" disabled={!active} onClick={onClear}>
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const Route = createFileRoute("/cases")({
  head: () => ({
    meta: [
      { title: "Cases — HAKKIU" },
      { name: "description", content: "Review, triage, and act on every detected infringement." },
    ],
  }),
  component: CasesLayout,
});

function CasesLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  if (pathname !== "/cases") return <Outlet />;
  return <CasesList />;
}

function CasesList() {
  const [all, setAll] = useState<InfringementFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Hold the raw error object (not just its message) so <ErrorState> can read
  // the HTTP status and pick the matching illustration.
  const [error, setError] = useState<unknown>(null);
  // Restore the saved view only when returning from a case detail; otherwise start fresh.
  const [initialView] = useState(consumeCasesView);

  const [search, setSearch] = useState(initialView.search);
  const [sortBy, setSortBy] = useState<SortField>(initialView.sortBy);
  const [sortDir, setSortDir] = useState<SortDir>(initialView.sortDir);
  const [page, setPage] = useState(initialView.page);

  // Filters (applied instantly on change)
  const [riskFilter, setRiskFilter] = useState<string[]>(initialView.riskFilter);
  const [statusFilter, setStatusFilter] = useState<string[]>(initialView.statusFilter);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialView.dateRange);
  const [minConfidence, setMinConfidence] = useState(initialView.minConfidence);
  const [selectedMacroRegion, setSelectedMacroRegion] = useState("ALL");

  const persona = useStore((s) => s.persona);
  const activeClientId = useStore((s) => s.activeClientId);
  // Bumped by the retry button to re-run the loader below.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // One row per copycat: the backend persists an infringement per detected item,
    // so the list shows each copycat as its own case while scans stay a single
    // case + single AI prompt in the backend.
    getInfringements({
      limit: 200,
      client_id: persona === "law_firm" && activeClientId ? activeClientId : undefined,
    })
      .then((res) => {
        if (!cancelled) {
          setAll(res.items);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e ?? new Error("Failed to load cases"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [persona, activeClientId, reloadKey]);

  const handleDeleteCase = async (infringementId: string) => {
    try {
      const ok = await deleteInfringementFromSupabase(infringementId);
      if (!ok) throw new Error("Could not complete delete operation.");
      setAll((prev) => prev.filter((c) => c.id !== infringementId));
      toast.success("Case deleted successfully");
    } catch (err: any) {
      console.error("Failed to delete case:", err);
      toast.error("Couldn't delete the case. Please try again.");
    }
  };

  // Merge a status change (inline dropdown or case detail) into the loaded
  // list so the new status is reflected instantly — and it stays on refetch
  // because the API persisted it to the database.
  const handleStatusUpdated = (updated: InfringementFeedItem) => {
    setAll((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
  };

  const renderCaseRow = (c: InfringementFeedItem) => {
    // Prefer the real detection region; fall back to the legacy hash for rows
    // persisted before per-copycat regions were stored.
    const cCode = c.detection_region || getRegionForId(c.case_id || c.id);
    const country = COUNTRY_BY_CODE[cCode];
    const macroReg = getMacroRegionForCountry(cCode);
    return (
      <TableRow key={c.id} className="group cursor-pointer">
        <TableCell>
          <Link
            to="/cases/$caseId"
            params={{ caseId: c.id }}
            className="flex flex-col min-w-0"
          >
            <span className="truncate text-sm font-medium flex items-center gap-1.5">
              {c.brand_name ?? "Unknown brand"}
              <span
                className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-muted border border-border/40 text-[9px] text-muted-foreground font-medium font-sans"
                title={`${macroReg} (${country?.name || cCode}) Proxy Location`}
              >
                <span>{country?.flag || "🌐"}</span>
                <span>{cCode}</span>
              </span>
            </span>
            <span className="truncate text-xs text-muted-foreground font-mono" title={c.source_url}>
              {c.source_url}
            </span>
          </Link>
        </TableCell>
        <TableCell className="text-sm capitalize">
          <span className="flex items-center gap-2">
            <PlatformLogo platform={c.platform} className="h-5 w-5 rounded" imgClassName="p-0.5" />
            {c.platform.replace(/_/g, " ")}
          </span>
        </TableCell>
        <TableCell>
          <RiskBadge risk={c.risk_level.toLowerCase() as "high" | "medium" | "low"} />
        </TableCell>
        <TableCell>
          <CaseStatusSelect caseItem={c} onUpdated={handleStatusUpdated} />
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {new Date(c.flagged_at || c.created_at).toLocaleDateString()}
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {`${Math.round(c.match_score * 100)}%`}
        </TableCell>
        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
            >
              <Link to="/cases/$caseId" params={{ caseId: c.id }}>
                See Case
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteCase(c.id);
              }}
              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
              title="Delete Case"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  const SortableHead = ({
    field,
    label,
    align = "left",
    className,
  }: {
    field: SortField;
    label: string;
    align?: "left" | "right" | "center";
    className?: string;
  }) => (
    <TableHead
      className={cn("cursor-pointer select-none", className)}
      onClick={() => toggleSort(field)}
    >
      <span
        className={cn(
          "flex items-center",
          align === "right" && "justify-end",
          align === "center" && "justify-center",
        )}
      >
        {label} <SortIcon field={field} />
      </span>
    </TableHead>
  );

  const countByRisk = (risk: string) => all.filter((c) => c.risk_level === risk).length;

  // Filter by canonical status key so legacy aliases (reviewed → analyzing,
  // dismissed → safe, …) group into a single option per workflow state.
  const statusOptions = Array.from(new Set(all.map((c) => normalizeStatusKey(c.status)))).sort(
    (a, b) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99),
  );

  const riskActive = riskFilter.length > 0;
  const statusActive = statusFilter.length > 0;
  const dateActive = dateRange?.from != null;
  const confActive = minConfidence > 0;

  const filtered = all
    .filter((c) => riskFilter.length === 0 || riskFilter.includes(c.risk_level ?? ""))
    .filter(
      (c) =>
        !search ||
        (c.brand_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        c.source_url.toLowerCase().includes(search.toLowerCase()),
    )
    .filter((c) => statusFilter.length === 0 || statusFilter.includes(normalizeStatusKey(c.status)))
    .filter((c) => inDateRange(c.flagged_at || c.created_at, dateRange))
    .filter((c) => (c.match_score ?? 0) * 100 >= minConfidence)
    .filter((c) => {
      if (selectedMacroRegion === "ALL") return true;
      const cCode = c.detection_region || getRegionForId(c.case_id || c.id);
      const mReg = getMacroRegionForCountry(cCode);
      return mReg === selectedMacroRegion;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "brand") cmp = (a.brand_name ?? "").localeCompare(b.brand_name ?? "");
      else if (sortBy === "platform") cmp = a.platform.localeCompare(b.platform);
      else if (sortBy === "risk")
        cmp = (RISK_ORDER[a.risk_level ?? ""] ?? 0) - (RISK_ORDER[b.risk_level ?? ""] ?? 0);
      else if (sortBy === "status")
        cmp =
          (STATUS_ORDER[normalizeStatusKey(a.status)] ?? 99) -
          (STATUS_ORDER[normalizeStatusKey(b.status)] ?? 99);
      else if (sortBy === "confidence") cmp = (a.match_score ?? 0) - (b.match_score ?? 0);
      else
        cmp =
          new Date(a.flagged_at || a.created_at).getTime() -
          new Date(b.flagged_at || b.created_at).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

  const pendingCases = filtered.filter((c) => normalizeStatusKey(c.status) === "pending");
  const otherCases = filtered.filter((c) => normalizeStatusKey(c.status) !== "pending");

  const totalPages = Math.max(1, Math.ceil(otherCases.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedOthers = otherCases.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to the first page whenever the result set changes (but keep a restored page on mount).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPage(1);
  }, [search, sortBy, sortDir, riskFilter, statusFilter, dateRange, minConfidence]);

  // Persist the current view so it can be restored when returning from a case detail.
  useEffect(() => {
    saveCasesView({
      search,
      sortBy,
      sortDir,
      page,
      riskFilter,
      statusFilter,
      dateRange,
      minConfidence,
    });
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <p className="text-sm text-muted-foreground">Every detected copycat as its own case, organized by risk.</p>
        </div>
        <div className="bg-muted/50 border border-border px-4 py-2.5 rounded-lg flex items-center gap-3 text-xs text-muted-foreground max-w-md shadow-sm">
          <Info className="h-4 w-4 text-accent shrink-0" />
          <div>
            <span className="font-semibold text-foreground">Storage Policy:</span> Screenshots and other heavy evidence files are hosted for a maximum of 100 days after a case is completed.
          </div>
        </div>
      </div>

      {/* Region Tabs */}
      <div className="flex border-b border-border gap-2">
        {["ALL", "North America", "Europe", "APAC", "LATAM"].map((region) => {
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by brand or URL…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <span className="ml-1 text-xs font-medium text-muted-foreground">Filters:</span>

        {/* Risk filter */}
        <FilterPopover label="Risk" active={riskActive} onClear={() => setRiskFilter([])}>
          <div className="space-y-2">
            {(["HIGH", "MEDIUM", "LOW"] as const).map((risk) => (
              <label
                key={risk}
                className="flex cursor-pointer items-center gap-2 text-sm capitalize"
              >
                <Checkbox
                  checked={riskFilter.includes(risk)}
                  onCheckedChange={(checked) =>
                    setRiskFilter((prev) =>
                      checked ? [...prev, risk] : prev.filter((r) => r !== risk),
                    )
                  }
                />
                <RiskBadge risk={risk.toLowerCase() as "high" | "medium" | "low"} />
                <span className="text-xs text-muted-foreground">({countByRisk(risk)})</span>
              </label>
            ))}
          </div>
        </FilterPopover>

        {/* Status filter */}
        <FilterPopover label="Status" active={statusActive} onClear={() => setStatusFilter([])}>
          <div className="space-y-2">
            {statusOptions.length === 0 && (
              <p className="text-sm text-muted-foreground">No statuses available.</p>
            )}
            {statusOptions.map((status) => (
              <label
                key={status}
                className="flex cursor-pointer items-center gap-2 text-sm capitalize"
              >
                <Checkbox
                  checked={statusFilter.includes(status)}
                  onCheckedChange={(checked) =>
                    setStatusFilter((prev) =>
                      checked ? [...prev, status] : prev.filter((s) => s !== status),
                    )
                  }
                />
                <CaseStatusBadge status={status} />
              </label>
            ))}
          </div>
        </FilterPopover>

        {/* Detected date filter */}
        <FilterPopover label="Detected" active={dateActive} onClear={() => setDateRange(undefined)}>
          <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={1} />
        </FilterPopover>

        {/* Confidence filter */}
        <FilterPopover label="Confidence" active={confActive} onClear={() => setMinConfidence(0)}>
          <div className="w-56 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Minimum confidence</span>
              <span className="font-mono font-medium">{minConfidence}%</span>
            </div>
            <Slider
              value={[minConfidence]}
              onValueChange={(v) => setMinConfidence(v[0])}
              min={0}
              max={100}
              step={5}
            />
          </div>
        </FilterPopover>
      </div>

      {/* Pending Reviews Block */}
      {!loading && !error && pendingCases.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pending Review ({pendingCases.length})</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <SortableHead field="brand" label="Brand / Copycat" />
                    <SortableHead field="platform" label="Platform" />
                    <SortableHead field="risk" label="Risk" />
                    <SortableHead field="status" label="Status" />
                    <SortableHead field="date" label="Detected" />
                    <SortableHead
                      field="confidence"
                      label="Confidence"
                      align="right"
                      className="text-right"
                    />
                    <TableHead className="text-center">Case</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCases.map((c) => renderCaseRow(c))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Table Block: Triage History */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Triage History</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <SortableHead field="brand" label="Brand / Copycat" />
                  <SortableHead field="platform" label="Platform" />
                  <SortableHead field="risk" label="Risk" />
                  <SortableHead field="status" label="Status" />
                  <SortableHead field="date" label="Detected" />
                  <SortableHead
                    field="confidence"
                    label="Confidence"
                    align="right"
                    className="text-right"
                  />
                  <TableHead className="text-center">Case</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading &&
                  !error &&
                  pagedOthers.map((c) => renderCaseRow(c))}
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading cases…
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {error != null && (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <ErrorState
                        variant="inline"
                        error={error}
                        title="Failed to load cases"
                        onRetry={() => setReloadKey((k) => k + 1)}
                        retryLabel="Retry"
                      />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !error && otherCases.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      {filtered.length === 0 && (riskActive || statusActive || dateActive || confActive || search)
                        ? "No cases match your filters."
                        : "No copycats detected yet — run a scan to find them."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {!loading && !error && otherCases.length > 0 && (
              <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  {otherCases.length} {otherCases.length === 1 ? "case" : "cases"}
                </span>
                {totalPages > 1 && (
                  <Pagination className="mx-0 w-auto justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          aria-disabled={currentPage === 1}
                          className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage((p) => Math.max(1, p - 1));
                          }}
                        />
                      </PaginationItem>
                      {pageItems(currentPage, totalPages).map((item, i) =>
                        item === "ellipsis" ? (
                          <PaginationItem key={`ellipsis-${i}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={item}>
                            <PaginationLink
                              href="#"
                              isActive={item === currentPage}
                              onClick={(e) => {
                                e.preventDefault();
                                setPage(item);
                              }}
                            >
                              {item}
                            </PaginationLink>
                          </PaginationItem>
                        ),
                      )}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          aria-disabled={currentPage === totalPages}
                          className={cn(
                            currentPage === totalPages && "pointer-events-none opacity-50",
                          )}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage((p) => Math.min(totalPages, p + 1));
                          }}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
