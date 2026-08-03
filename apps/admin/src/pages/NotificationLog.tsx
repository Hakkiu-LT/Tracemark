import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { ChevronRight, ChevronDown, Trash2, Loader2 } from "lucide-react";

import { adminFetch } from "@/lib/api";
import { usePermission } from "@/lib/auth";
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
  brand_name: string | null;
  recipient: string | null;
  recipient_name: string | null;
  subject: string | null;
  body_html: string | null;
  payload: Record<string, unknown> | null;
}

// Every event_type the main API currently logs (services/*, routes/*).
const EVENT_TYPES = [
  "new_infringement",
  "takedown_generated",
  "takedown_submitted",
  "case_escalated",
  "case_dismissed",
  "weekly_digest",
  "welcome",
  "new_lead",
  "lead_confirmation",
  "demo_confirmed",
  "support_contact",
  "password_reset",
  "test",
];

const EVENT_LABELS: Record<string, string> = {
  new_infringement: "New infringement",
  takedown_generated: "Takedown generated",
  takedown_submitted: "Takedown submitted",
  case_escalated: "Case escalated",
  case_dismissed: "Case dismissed",
  weekly_digest: "Weekly digest",
  welcome: "Welcome",
  new_lead: "New lead (staff alert)",
  lead_confirmation: "Lead confirmation",
  demo_confirmed: "Demo confirmed",
  support_contact: "Support request",
  password_reset: "Admin password reset",
  test: "Test email",
};

// The view control maps to the backend's status / hide_skipped params. "" is the
// default "real emails" view (sent + failed; the intentional no-send "skipped" rows
// are hidden so the log shows what was actually dispatched).
const VIEWS = [
  { value: "", label: "Sent & failed" },
  { value: "sent", label: "Delivered only" },
  { value: "failed", label: "Failed only" },
  { value: "skipped", label: "Skipped only" },
  { value: "all", label: "Everything" },
];

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
  const [view, setView] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const canDelete = usePermission("notification_log.delete");

  const del = useMutation({
    mutationFn: (id: string) => adminFetch(`/notification-log/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-log"] }),
  });

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) =>
      adminFetch<{ deleted: number }>("/notification-log/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["notification-log"] });
    },
  });

  function handleDelete(id: string) {
    if (window.confirm("Delete this log entry? This removes the record only — it does not unsend the email.")) {
      del.mutate(id);
    }
  }

  function handleBulkDelete() {
    if (selected.size === 0) return;
    const n = selected.size;
    if (window.confirm(`Delete ${n} log ${n === 1 ? "entry" : "entries"}? This removes the records only — it does not unsend anything.`)) {
      bulkDelete.mutate([...selected]);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (view === "sent" || view === "failed" || view === "skipped") params.set("status", view);
  else if (view === "") params.set("hide_skipped", "true");
  // view === "all" → no status constraint
  if (eventFilter) params.set("event_type", eventFilter);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["notification-log", view, eventFilter, offset],
    queryFn: () =>
      adminFetch<{ deliveries: Delivery[]; offset: number; limit: number }>(
        `/notification-log?${params}`,
      ),
    placeholderData: keepPreviousData,
  });

  const rows = data?.deliveries ?? [];
  const hasNext = rows.length === PAGE_SIZE;
  const hasFilters = view !== "" || eventFilter !== "";

  const visibleIds = rows.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = visibleIds.some((id) => selected.has(id));

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function clearPageState() {
    setExpanded(new Set());
    setSelected(new Set());
  }

  function setOffsetToZero() {
    setOffset(0);
    clearPageState();
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notification Log</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Every email HAKKIU sends — to customers, sales leads and staff — newest first. Shows who
          received it, for which brand, and the exact message. Defaults to real sends; switch the view
          to inspect skipped (intentionally not sent) rows.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-4">
          <Select
            value={view}
            onChange={(e) => {
              setOffsetToZero();
              setView(e.target.value);
            }}
            className="w-44"
          >
            {VIEWS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </Select>
          <Select
            value={eventFilter}
            onChange={(e) => {
              setOffsetToZero();
              setEventFilter(e.target.value);
            }}
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
                setView("");
                setEventFilter("");
                setOffsetToZero();
              }}
            >
              Reset
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Bulk action bar — only when the staff can delete AND rows are selected */}
      {canDelete && selected.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-3 rounded-md border border-border bg-background/95 p-3 shadow-sm backdrop-blur">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button
            variant="destructive"
            size="sm"
            disabled={bulkDelete.isPending}
            onClick={handleBulkDelete}
          >
            {bulkDelete.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Delete selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

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
                    {canDelete && (
                      <TableHead className="w-8">
                        <input
                          type="checkbox"
                          aria-label="Select all"
                          checked={allVisibleSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                          }}
                          onChange={toggleAllVisible}
                          className="h-4 w-4 cursor-pointer accent-accent"
                        />
                      </TableHead>
                    )}
                    <TableHead className="w-8"></TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    {canDelete && <TableHead className="w-8"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canDelete ? 10 : 8} className="py-10 text-center text-muted-foreground">
                        No emails found for this view.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const isOpen = expanded.has(row.id);
                      return (
                        <Fragment key={row.id}>
                          <TableRow
                            className={`cursor-pointer${selected.has(row.id) ? " bg-accent/5" : ""}`}
                            onClick={() => toggleExpanded(row.id)}
                          >
                            {canDelete && (
                              <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  aria-label="Select row"
                                  checked={selected.has(row.id)}
                                  onChange={() => toggleSelected(row.id)}
                                  className="h-4 w-4 cursor-pointer accent-accent"
                                />
                              </TableCell>
                            )}
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
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {row.organization_id ? (
                                <Link
                                  to="/organizations/$orgId"
                                  params={{ orgId: row.organization_id }}
                                  className="text-accent hover:underline"
                                >
                                  {row.organization_name || "Unknown org"}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">System</span>
                              )}
                            </TableCell>
                            <TableCell
                              className="text-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row.brand_name ? (
                                row.case_id ? (
                                  <Link
                                    to="/cases/$caseId"
                                    params={{ caseId: row.case_id }}
                                    className="text-accent hover:underline"
                                  >
                                    {row.brand_name}
                                  </Link>
                                ) : (
                                  row.brand_name
                                )
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {row.recipient_name || row.recipient ? (
                                <div className="leading-tight">
                                  {row.recipient_name && (
                                    <div className="text-sm font-medium">{row.recipient_name}</div>
                                  )}
                                  {row.recipient && (
                                    <div className="text-xs text-muted-foreground">{row.recipient}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {row.event_type ? (EVENT_LABELS[row.event_type] ?? row.event_type) : "—"}
                            </TableCell>
                            <TableCell className="max-w-[20rem]">
                              <div className="truncate text-xs" title={row.subject ?? undefined}>
                                {row.subject ?? <span className="text-muted-foreground">—</span>}
                              </div>
                              {row.error_message && row.status !== "sent" && (
                                <div
                                  className="truncate text-xs text-destructive"
                                  title={row.error_message}
                                >
                                  {row.error_message}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(row.status)} className="capitalize">
                                {row.status ?? "—"}
                              </Badge>
                            </TableCell>
                            {canDelete && (
                              <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={del.isPending}
                                  onClick={() => handleDelete(row.id)}
                                  title="Delete this log entry"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                          {isOpen && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={canDelete ? 10 : 8} className="py-4">
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
                        clearPageState();
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
                        clearPageState();
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
  const [showPayload, setShowPayload] = useState(false);

  return (
    <div className="space-y-4 text-sm">
      {/* The actual email, exactly as the recipient received it. Rendered in a
          sandboxed iframe (no scripts / same-origin) so stored HTML can never
          run or restyle the admin app. */}
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Email preview
        </div>
        {row.body_html ? (
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={row.body_html}
            className="h-96 w-full rounded-md border border-border bg-white"
          />
        ) : (
          <p className="rounded-md border border-dashed border-border p-4 text-muted-foreground">
            No email body stored for this row
            {row.status === "skipped"
              ? " (no email was sent — see the skip reason below)."
              : row.event_type === "password_reset"
                ? " (reset emails are logged without their body — the link is a secret)."
                : " (sent before body capture was added)."}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Recipient" value={row.recipient} />
        <Field label="Case ID" value={row.case_id} mono />
        <Field label="Infringement ID" value={row.infringement_id} mono />
        <Field label="Organization ID" value={row.organization_id} mono />
      </div>

      {row.error_message && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {row.status === "skipped" ? "Skip reason" : "Error"}
          </div>
          <div className="whitespace-pre-wrap text-destructive">{row.error_message}</div>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowPayload((v) => !v)}
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          {showPayload ? "▾" : "▸"} Technical payload
        </button>
        {showPayload && (
          <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
            {row.payload && Object.keys(row.payload).length > 0
              ? JSON.stringify(row.payload, null, 2)
              : "No payload recorded."}
          </pre>
        )}
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
