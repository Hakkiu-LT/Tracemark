import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { updateInfringementStatus, type InfringementFeedItem } from "@/lib/api";

/** Raw-status aliases → canonical workflow key used for display and sorting. */
const STATUS_ALIASES: Record<string, string> = {
  flagged: "pending",
  reviewed: "analyzing",
  active: "analyzing",
  completed: "complete",
  resolved: "complete",
  dismissed: "safe",
};

export function normalizeStatusKey(status: string | null | undefined): string {
  const norm = (status || "pending").toLowerCase();
  return STATUS_ALIASES[norm] ?? norm;
}

/** User-facing label for each canonical status key. */
export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  analyzing: "In Analysis",
  escalated: "Escalated",
  takedown_sent: "Takedown Sent",
  complete: "Completed",
  safe: "Safe",
  declined: "Rejected",
  error: "Capture Failed",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground border-border font-mono",
  analyzing: "bg-blue-500/10 text-blue-600 border-blue-500/30 font-semibold",
  escalated: "bg-purple-500/10 text-purple-600 border-purple-500/30 font-semibold",
  takedown_sent: "bg-amber-500/10 text-amber-600 border-amber-500/30 font-semibold",
  complete: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-semibold",
  safe: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  declined: "bg-red-500/10 text-red-600 border-red-500/30 font-semibold",
  error: "bg-red-500/10 text-red-600 border-red-500/30",
};

const FALLBACK_STYLE = "bg-muted text-muted-foreground border-border";

/** Statuses the user can pick from the inline dropdown (Jira-like workflow). */
export const CASE_STATUS_OPTIONS = [
  "pending",
  "analyzing",
  "escalated",
  "complete",
  "safe",
  "declined",
] as const;

export function statusLabel(status: string | null | undefined): string {
  const key = normalizeStatusKey(status);
  return STATUS_LABELS[key] ?? key.replace(/_/g, " ");
}

export function CaseStatusBadge({ status }: { status: string }) {
  const key = normalizeStatusKey(status);
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold capitalize",
        STATUS_STYLES[key] ?? FALLBACK_STYLE,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

/**
 * Jira-like inline status control for a single copycat case: renders the
 * status as a colored pill that opens a dropdown; the choice is persisted to
 * the database via the API and reported back through `onUpdated`.
 */
export function CaseStatusSelect({
  caseItem,
  onUpdated,
}: {
  caseItem: InfringementFeedItem;
  onUpdated: (updated: InfringementFeedItem) => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const key = normalizeStatusKey(caseItem.status);

  const handleChange = async (next: string) => {
    if (next === key || isPending) return;
    setIsPending(true);
    try {
      const updated = await updateInfringementStatus(caseItem.id, next);
      onUpdated(updated);
      toast.success(`Status updated to ${statusLabel(updated.status)}`);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Select value={key} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger
        // Stop the row's link/navigation handlers from firing when triaging.
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "h-auto w-auto gap-1.5 rounded-md border px-2 py-0.5 text-xs capitalize shadow-none",
          "focus:ring-0 focus:ring-offset-0 [&>svg]:h-3 [&>svg]:w-3",
          STATUS_STYLES[key] ?? FALLBACK_STYLE,
        )}
      >
        {isPending ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {statusLabel(caseItem.status)}
          </span>
        ) : (
          statusLabel(caseItem.status)
        )}
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        {CASE_STATUS_OPTIONS.map((option) => (
          <SelectItem key={option} value={option} className="text-xs">
            <span
              className={cn(
                "inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold",
                STATUS_STYLES[option] ?? FALLBACK_STYLE,
              )}
            >
              {STATUS_LABELS[option]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
