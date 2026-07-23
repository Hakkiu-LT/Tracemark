import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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

interface Lead {
  id: string;
  tier: "professional" | "enterprise";
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  brand_count_range: string;
  message: string | null;
  status: "pending" | "contacted" | "closed";
  created_at: string;
}

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
  const canEdit = usePermission("leads.edit");
  const qc = useQueryClient();

  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (tierFilter)   params.set("tier", tierFilter);

  const { data, isLoading, isError } = useQuery({
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
            <p className="p-4 text-sm text-destructive">Failed to load leads.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
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
                    <TableCell colSpan={canEdit ? 7 : 6} className="py-10 text-center text-muted-foreground">
                      No leads found.
                    </TableCell>
                  </TableRow>
                ) : (
                  (data ?? []).map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="font-medium">
                          {lead.first_name} {lead.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">{lead.email}</div>
                        {lead.message && (
                          <div className="mt-1 max-w-xs truncate text-xs text-muted-foreground" title={lead.message}>
                            {lead.message}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{lead.company}</TableCell>
                      <TableCell>
                        <Badge variant={tierVariant(lead.tier)} className="capitalize">
                          {lead.tier}
                        </Badge>
                      </TableCell>
                      <TableCell>{lead.brand_count_range}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(lead.status)} className="capitalize">
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(lead.created_at)}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
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
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
