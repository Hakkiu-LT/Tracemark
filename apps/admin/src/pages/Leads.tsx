import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import {
  Loader2,
  ChevronRight,
  ChevronDown,
  Trash2,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { adminFetch } from "@/lib/api";
import { usePermission } from "@/lib/auth";
import { ensureAbsoluteUrl } from "@/lib/utils";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
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

interface Lead {
  id: string;
  source: "pricing_modal" | "request_demo" | "call_request" | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  brand_count_range: string | null;
  message: string | null;
  status: "pending" | "contacted" | "closed";
  created_at: string;
  // Fields the live demo/call forms actually submit.
  website: string | null; // Book-a-demo
  phone: string | null; // Talk-to-sales
  primary_goal: string[] | null; // Book-a-demo ("what would you like to protect?")
  // Demo scheduling (Book-a-demo "Select a Date & Time" step).
  proposed_slots: string[] | null; // times the visitor offered (UTC ISO)
  scheduled_at: string | null; // the ONE slot staff confirmed (UTC ISO)
  scheduled_timezone: string | null; // IANA tz the visitor picked in
  meeting_link: string | null; // set by staff on confirm
  confirmed_at: string | null; // set when staff confirmed + emailed
}

// "Our" timezone — every slot is shown ALSO in this zone next to the visitor's,
// so staff never convert in their head. Kept in sync with COMPANY_TIMEZONE (API).
const COMPANY_TIMEZONE = "Europe/Vilnius";

/** Format one UTC instant in a given IANA timezone, with the zone name appended. */
function fmtInTz(iso: string, tz: string, note?: string) {
  const when = new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
  return `${when} (${note ? `${tz}, ${note}` : tz})`;
}

/**
 * Render a stored UTC slot in the visitor's timezone AND ours (Europe/Vilnius),
 * so staff see both. Only one label when the visitor is already in our zone.
 * Falls back to the browser's local time if the visitor tz is missing/invalid.
 */
function fmtSlot(iso: string, tz: string | null) {
  try {
    if (!tz) return new Date(iso).toLocaleString();
    const visitor = fmtInTz(iso, tz);
    if (tz === COMPANY_TIMEZONE) return visitor;
    return `${visitor}  ·  ${fmtInTz(iso, COMPANY_TIMEZONE, "our time")}`;
  } catch {
    return new Date(iso).toLocaleString();
  }
}

const SOURCE_LABELS: Record<string, string> = {
  pricing_modal: "Pricing enquiry",
  request_demo: "Book a demo",
  call_request: "Talk to sales",
};

function statusVariant(s: string) {
  if (s === "pending") return "warning" as const;
  if (s === "contacted") return "secondary" as const;
  if (s === "closed") return "success" as const;
  return "secondary" as const;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function Leads() {
  const [statusFilter, setStatusFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const canEdit = usePermission("leads.edit");
  const canConfirm = usePermission("leads.confirm");
  const canDelete = usePermission("leads.delete");
  const showActions = canEdit || canDelete;
  const confirm = useConfirm();
  const qc = useQueryClient();

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["leads", statusFilter],
    queryFn: () =>
      adminFetch<{ leads: Lead[] }>(`/leads${params.toString() ? `?${params}` : ""}`).then(
        (r) => r.leads,
      ),
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminFetch(`/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (_d, { status }) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Lead marked as ${status}`);
    },
    onError: (err: any) => toast.error(err.message ?? "Update failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminFetch(`/leads/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead deleted");
    },
    onError: (err: any) => toast.error(err.message ?? "Delete failed"),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Leads</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Demo bookings &amp; call requests</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-4">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </Select>
          {statusFilter && (
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter("")}>
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leads {data ? `(${data.length})` : ""}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState
              variant="inline"
              error={error}
              title="Failed to load leads"
              onRetry={() => refetch()}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Brands</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  {showActions && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={showActions ? 8 : 7}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No leads found.
                    </TableCell>
                  </TableRow>
                ) : (
                  (data ?? []).map((lead) => {
                    const isOpen = expanded.has(lead.id);
                    return (
                      <Fragment key={lead.id}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => toggleExpanded(lead.id)}
                        >
                          <TableCell className="text-muted-foreground">
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {lead.first_name || lead.last_name ? (
                                `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{lead.email}</div>
                            {lead.phone && (
                              <div className="text-xs text-muted-foreground">{lead.phone}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              {lead.company ?? <span className="text-muted-foreground">—</span>}
                            </div>
                            {lead.website && (
                              <a
                                href={ensureAbsoluteUrl(lead.website)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {lead.website}
                              </a>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {lead.source ? (SOURCE_LABELS[lead.source] ?? lead.source) : "—"}
                            {(lead.confirmed_at ||
                              lead.scheduled_at ||
                              lead.proposed_slots?.length) && (
                              <div
                                className={`mt-1 flex items-center gap-1 text-xs ${
                                  lead.confirmed_at ? "text-emerald-600" : "text-amber-600"
                                }`}
                                title={
                                  lead.confirmed_at && lead.scheduled_at
                                    ? fmtSlot(lead.scheduled_at, lead.scheduled_timezone)
                                    : `${lead.proposed_slots?.length ?? 1} time(s) offered`
                                }
                              >
                                {lead.confirmed_at ? (
                                  <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                  <CalendarClock className="h-3 w-3" />
                                )}
                                {lead.confirmed_at ? "Confirmed" : "Requested"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.brand_count_range ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(lead.status)} className="capitalize">
                              {lead.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {fmtDate(lead.created_at)}
                          </TableCell>
                          {showActions && (
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                {canEdit && lead.status === "pending" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={update.isPending}
                                    onClick={() =>
                                      update.mutate({ id: lead.id, status: "contacted" })
                                    }
                                  >
                                    {update.isPending ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      "Mark contacted"
                                    )}
                                  </Button>
                                )}
                                {canEdit && lead.status !== "closed" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={update.isPending}
                                    onClick={() => update.mutate({ id: lead.id, status: "closed" })}
                                  >
                                    Close
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    disabled={remove.isPending}
                                    aria-label="Delete lead"
                                    title="Delete lead"
                                    onClick={() =>
                                      confirm.open({
                                        title: "Delete this lead?",
                                        description: `Permanently removes the lead from ${
                                          lead.first_name || lead.last_name
                                            ? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()
                                            : lead.email
                                        }. This cannot be undone.`,
                                        confirmLabel: "Delete lead",
                                        destructive: true,
                                        onConfirm: async () => {
                                          await remove.mutateAsync(lead.id);
                                        },
                                      })
                                    }
                                  >
                                    {remove.isPending && remove.variables === lead.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                        {isOpen && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell></TableCell>
                            <TableCell colSpan={showActions ? 7 : 6} className="py-4">
                              <LeadDetails lead={lead} canConfirm={canConfirm} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {confirm.element}
    </div>
  );
}

function LeadDetails({ lead, canConfirm }: { lead: Lead; canConfirm: boolean }) {
  const goals = lead.primary_goal?.length ? lead.primary_goal.join(", ") : null;

  const hasScheduling = !!(lead.confirmed_at || lead.scheduled_at || lead.proposed_slots?.length);

  return (
    <div className="space-y-3 text-sm">
      {hasScheduling && <DemoScheduling lead={lead} canConfirm={canConfirm} />}
      {goals && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Wants to protect
          </div>
          <div>{goals}</div>
        </div>
      )}
      {!goals && !lead.message && !hasScheduling && (
        <p className="text-muted-foreground">No additional details submitted.</p>
      )}
      {lead.message && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Message
          </div>
          <div className="whitespace-pre-wrap">{lead.message}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Demo scheduling panel. The visitor offers several times they're free
 * (`proposed_slots`); staff with `leads.confirm` pick the ONE that suits us,
 * paste a video link, and Confirm — which writes `scheduled_at` and emails the
 * customer. Confirming an already-confirmed lead re-sends the same slot.
 */
function DemoScheduling({ lead, canConfirm }: { lead: Lead; canConfirm: boolean }) {
  const qc = useQueryClient();
  const [meetingLink, setMeetingLink] = useState(lead.meeting_link ?? "");

  // Times the visitor offered (fall back to a legacy single slot).
  const offered = lead.proposed_slots?.length
    ? lead.proposed_slots
    : lead.scheduled_at
      ? [lead.scheduled_at]
      : [];
  // Which offered slot staff will confirm — default to the confirmed one, else the first.
  const [chosen, setChosen] = useState<string | null>(lead.scheduled_at ?? offered[0] ?? null);

  const confirm = useMutation({
    mutationFn: () =>
      adminFetch(`/leads/${lead.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          meeting_link: meetingLink || null,
          scheduled_at: chosen,
          scheduled_timezone: lead.scheduled_timezone,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(lead.confirmed_at ? "Confirmation re-sent" : "Demo confirmed — email sent");
    },
    onError: (err: any) => toast.error(err.message ?? "Confirm failed"),
  });

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        {lead.confirmed_at ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <CalendarClock className="h-4 w-4 text-amber-600" />
        )}
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {lead.confirmed_at ? "Demo confirmed" : `Availability offered (${offered.length})`}
        </span>
      </div>

      {lead.confirmed_at ? (
        <>
          <div className="mt-1 text-base font-semibold">
            {fmtSlot(lead.scheduled_at!, lead.scheduled_timezone)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Confirmed {fmtDate(lead.confirmed_at)}
            {lead.meeting_link && (
              <>
                {" · "}
                <a
                  href={ensureAbsoluteUrl(lead.meeting_link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Meeting link
                </a>
              </>
            )}
          </div>
        </>
      ) : (
        // Pick-one radio list of the times the visitor offered.
        <div className="mt-2 space-y-1.5">
          {offered.map((iso) => (
            <label
              key={iso}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                chosen === iso ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"
              } ${canConfirm ? "" : "cursor-default"}`}
            >
              <input
                type="radio"
                name={`slot-${lead.id}`}
                checked={chosen === iso}
                onChange={() => setChosen(iso)}
                disabled={!canConfirm}
                className="accent-foreground"
              />
              {fmtSlot(iso, lead.scheduled_timezone)}
            </label>
          ))}
        </div>
      )}

      {canConfirm && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder="Video meeting link (Meet / Zoom)"
            className="h-9 flex-1"
          />
          <Button
            size="sm"
            disabled={confirm.isPending || !chosen}
            onClick={() => confirm.mutate()}
          >
            {confirm.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : lead.confirmed_at ? (
              "Re-send confirmation"
            ) : (
              "Confirm & email"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
