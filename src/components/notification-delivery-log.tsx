import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ListFilter, CheckCircle2, ShieldAlert } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { formatDistanceToNow, parseISO } from "date-fns";

interface DeliveryLog {
  id: string;
  event_type: string;
  status: "sent" | "failed" | "skipped";
  error_message: string | null;
  delivered_at: string;
  payload: Record<string, any> | null;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  new_infringement: "New Infringement Alert",
  takedown_generated: "Takedown Draft Created",
  takedown_submitted: "Takedown Notice Sent",
  case_escalated: "Case Escalated Alert",
  case_dismissed: "Case Dismissed Alert",
  test: "SMTP Connection Test",
};

export function NotificationDeliveryLog() {
  const { data: logs = [], isLoading, error, refetch, isFetching } = useQuery<DeliveryLog[]>({
    queryKey: ["notification-deliveries"],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error: err } = await supabase
        .from("notification_deliveries")
        .select("id, event_type, status, error_message, delivered_at, payload")
        .order("delivered_at", { ascending: false })
        .limit(20);

      if (err) throw err;
      return (data || []) as DeliveryLog[];
    },
  });

  function formatEventType(type: string) {
    if (EVENT_TYPE_LABELS[type]) return EVENT_TYPE_LABELS[type];
    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getRecipient(log: DeliveryLog): string {
    if (log.payload?.recipient) return log.payload.recipient;
    if (log.payload?.email) return log.payload.email;
    if (log.event_type === "test") return log.payload?.email || "Test Recipient";
    return "Workspace Recipient";
  }

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <ListFilter className="h-5 w-5 text-accent" />
            Notification Delivery Log
          </CardTitle>
          <CardDescription>
            Audit trail of the last 20 notification dispatches.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="h-8 shrink-0 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <ErrorState
            variant="inline"
            error={error}
            title="Failed to load delivery logs"
            onRetry={() => refetch()}
            retryLabel="Retry"
          />
        ) : logs.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground mb-2" />
            <p>No notification dispatches recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Delivered At</TableHead>
                  <TableHead>Notification Type</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="max-w-[200px]">Details / Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  let relativeTime = "";
                  try {
                    relativeTime = formatDistanceToNow(parseISO(log.delivered_at), { addSuffix: true });
                  } catch (e) {
                    relativeTime = log.delivered_at;
                  }

                  return (
                    <TableRow key={log.id} className="hover:bg-muted/40">
                      <TableCell className="font-medium text-xs text-muted-foreground">
                        <span title={new Date(log.delivered_at).toLocaleString()}>
                          {relativeTime}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatEventType(log.event_type)}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {getRecipient(log)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={log.status === "failed" ? "destructive" : log.status === "sent" ? "outline" : "secondary"}
                          className={
                            log.status === "sent"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 capitalize font-medium"
                              : "capitalize font-medium"
                          }
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {log.status === "failed" ? (
                          <span className="flex items-center gap-1 text-destructive font-medium" title={log.error_message || "Unknown error"}>
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
                            {log.error_message || "Delivery failed"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {log.event_type === "takedown_submitted"
                              ? `Takedown Notice ID: ${log.payload?.takedown_report_id?.slice(0, 8) || "..."}`
                              : "Dispatched successfully"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
