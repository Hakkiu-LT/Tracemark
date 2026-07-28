import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Loader2, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { adminFetch } from "@/lib/api";
import { usePermission } from "@/lib/auth";
import { ensureAbsoluteUrl } from "@/lib/utils";
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

interface Lead {
  id: string;
  tier: "professional" | "enterprise";
  source: "pricing_modal" | "request_demo" | "call_request" | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  brand_count_range: string | null;
  message: string | null;
  status: "pending" | "contacted" | "closed";
  created_at: string;
  // Pre-demo qualification fields (from the /request-demo wizard)
  role: string | null;
  website: string | null;
  phone: string | null;
  regions: string[] | null;
  brand_names: string | null;
  marketplaces: string[] | null;
  current_solution: string | null;
  primary_goal: string[] | null;
}

const SOURCE_LABELS: Record<string, string> = {
  pricing_modal: "Pricing page",
  request_demo: "Demo wizard",
  call_request: "Call request",
};

function statusVariant(s: string) {
  if (s === "pending")   return "warning" as const;
  if (s === "contacted") return "secondary" as const;
  if (s === "closed")    return "success" as const;
  return "secondary" as const;
}

function tierVariant(t: string) {
  if (t === "enterprise")   return "destructive" as const;
  if (t === "professional") return "secondary" as const;
  return "secondary" as const;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function Leads() {
  const [statusFilter, setStatusFilter] = useState("");
  const [tierFilter, setTierFilter]     = useState("");
  const [expanded, setExpanded]         = useState<Set<string>>(new Set());
  const canEdit = usePermission("leads.edit");
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
  if (tierFilter)   params.set("tier", tierFilter);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["leads", statusFilter, tierFilter],
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Leads</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Professional &amp; Enterprise pricing requests
          </p>
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
          <Select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
            <option value="">All tiers</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </Select>
          {(statusFilter || tierFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(""); setTierFilter(""); }}>
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
            <ErrorState variant="inline" error={error} title="Failed to load leads" onRetry={() => refetch()} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Brands</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  {canEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 9 : 8} className="py-10 text-center text-muted-foreground">
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
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {lead.first_name || lead.last_name
                            ? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()
                            : <span className="text-muted-foreground">—</span>}
                        </div>
                        {lead.role && <div className="text-xs text-muted-foreground">{lead.role}</div>}
                        <div className="text-xs text-muted-foreground">{lead.email}</div>
                        {lead.phone && <div className="text-xs text-muted-foreground">{lead.phone}</div>}
                      </TableCell>
                      <TableCell>
                        <div>{lead.company ?? <span className="text-muted-foreground">—</span>}</div>
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
                      </TableCell>
                      <TableCell>
                        <Badge variant={tierVariant(lead.tier)} className="capitalize">
                          {lead.tier}
                        </Badge>
                      </TableCell>
                      <TableCell>{lead.brand_count_range ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(lead.status)} className="capitalize">
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(lead.created_at)}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            {lead.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={update.isPending}
                                onClick={() => update.mutate({ id: lead.id, status: "contacted" })}
                              >
                                {update.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Mark contacted"
                                )}
                              </Button>
                            )}
                            {lead.status !== "closed" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={update.isPending}
                                onClick={() => update.mutate({ id: lead.id, status: "closed" })}
                              >
                                Close
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell></TableCell>
                        <TableCell colSpan={canEdit ? 8 : 7} className="py-4">
                          <LeadDetails lead={lead} />
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
    </div>
  );
}

function LeadDetails({ lead }: { lead: Lead }) {
  const items: { label: string; value: React.ReactNode }[] = [
    { label: "Role", value: lead.role },
    { label: "Phone", value: lead.phone },
    { label: "Markets", value: lead.regions?.length ? lead.regions.join(", ") : null },
    { label: "Brand names", value: lead.brand_names },
    { label: "Marketplaces", value: lead.marketplaces?.length ? lead.marketplaces.join(", ") : null },
    { label: "Primary goals", value: lead.primary_goal?.length ? lead.primary_goal.join(", ") : null },
    { label: "Current solution", value: lead.current_solution },
  ];

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.label}>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{it.label}</div>
            <div>{it.value || <span className="text-muted-foreground">—</span>}</div>
          </div>
        ))}
      </div>
      {lead.message && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Message</div>
          <div className="whitespace-pre-wrap">{lead.message}</div>
        </div>
      )}
    </div>
  );
}
