import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

import { adminFetch } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { ErrorState } from "@/components/error-state";

interface Delivery {
  id: string;
  event_type: string | null;
  status: "sent" | "failed" | "skipped" | null;
  error_message: string | null;
  delivered_at: string | null;
  created_at: string | null;
  infringement_id: string | null;
  case_id: string | null;
  organization_id: string | null;
  organization_name: string | null;
  recipient: string | null;
  payload: Record<string, unknown> | null;
}

// Every event_type the main API currently logs (services/*, routes/*).
const EVENT_TYPES = [
  "new_infringement",
  "takedown_generated",
  "takedown_submitted",
  "case_escalated",
  "case_dismissed",
];

const EVENT_LABELS: Record<string, string> = {
  new_infringement: "New infringement",
  takedown_generated: "Takedown generated",
  takedown_submitted: "Takedown submitted",
  case_escalated: "Case escalated",
  case_dismissed: "Case dismissed",
};

const PAGE_SIZE = 50;

function statusVariant(s: string | null) {
  if (s === "sent") return "success" as const;
  if (s === "failed") return "destructive" as const;
  if (s === "skipped") return "secondary" as const;
  return "secondary" as const;
}

function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString();
}

export function NotificationLog() {
  const [statusFilter, setStatusFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (statusFilter) params.set("status", statusFilter);
  if (eventFilter) params.set("event_type", eventFilter);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["notification-log", statusFilter, eventFilter, offset],
    queryFn: () =>
      adminFetch<{ deliveries: Delivery[]; offset: number; limit: number }>(
        `/notification-log?${params}`,
      ),
    placeholderData: keepPreviousData,
  });

  const rows = data?.deliveries ?? [];
  const hasNext = rows.length === PAGE_SIZE;
  const hasFilters = statusFilter !== "" || eventFilter !== "";

  function resetPaging<T>(setter: (v: T) => void) {
    return (v: T) => {
      setOffsetToZero();
      setter(v);
    };
  }
  function setOffsetToZero() {
    setOffset(0);
    setExpanded(new Set());
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notification Log</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Every notification dispatch attempt (email / webhook) across all organizations, newest first.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-4">
          <Select
            value={statusFilter}
            onChange={(e) => resetPaging(setStatusFilter)(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </Select>
          <Select
            value={eventFilter}
            onChange={(e) => resetPaging(setEventFilter)(e.target.value)}
            className="w-52"
          >
            <option value="">All event types</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_LABELS[t] ?? t}
              </option>
            ))}
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("");
                setEventFilter("");
                setOffsetToZero();
              }}
            >
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>{isLoading ? "Loading…" : `Deliveries (${rows.length})`}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState
              variant="inline"
              error={error}
              title="Failed to load the notification log"
              onRetry={() => refetch()}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        No notifications found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const isOpen = expanded.has(row.id);
                      return (
                        <Fragment key={row.id}>
                          <TableRow className="cursor-pointer" onClick={() => toggleExpanded(row.id)}>
                            <TableCell className="text-muted-foreground">
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {fmtDateTime(row.delivered_at ?? row.created_at)}
                            </TableCell>
                            <TableCell>
                              {row.organization_name ?? (
                                <span className="text-muted-foreground">System</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {row.event_type ? (EVENT_LABELS[row.event_type] ?? row.event_type) : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(row.status)} className="capitalize">
                                {row.status ?? "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {row.recipient ?? "—"}
                            </TableCell>
                            <TableCell className="max-w-[16rem] truncate text-xs text-destructive">
                              {row.error_message ?? ""}
                            </TableCell>
                          </TableRow>
                          {isOpen && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell></TableCell>
                              <TableCell colSpan={6} className="py-4">
                                <DeliveryDetails row={row} />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {/* Offset pagination */}
              {(offset > 0 || hasNext) && (
                <div className="flex items-center justify-between gap-2 border-t border-border p-3">
                  <span className="text-xs text-muted-foreground">
                    Showing {offset + 1}–{offset + rows.length}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={offset === 0 || isFetching}
                      onClick={() => {
                        setOffset((o) => Math.max(0, o - PAGE_SIZE));
                        setExpanded(new Set());
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!hasNext || isFetching}
                      onClick={() => {
                        setOffset((o) => o + PAGE_SIZE);
                        setExpanded(new Set());
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DeliveryDetails({ row }: { row: Delivery }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Case ID" value={row.case_id} mono />
        <Field label="Infringement ID" value={row.infringement_id} mono />
        <Field label="Organization ID" value={row.organization_id} mono />
        <Field label="Delivery ID" value={row.id} mono />
      </div>
      {row.error_message && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Error</div>
          <div className="whitespace-pre-wrap text-destructive">{row.error_message}</div>
        </div>
      )}
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payload</div>
        <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
          {row.payload && Object.keys(row.payload).length > 0
            ? JSON.stringify(row.payload, null, 2)
            : "No payload recorded."}
        </pre>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs" : "text-sm"}>
        {value ?? <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}
