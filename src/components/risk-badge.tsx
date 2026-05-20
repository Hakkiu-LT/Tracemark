import type { RiskLevel } from "@/lib/store";
import { cn } from "@/lib/utils";

const map: Record<RiskLevel, { label: string; cls: string }> = {
  high: { label: "High", cls: "bg-risk-high/10 text-risk-high border-risk-high/30" },
  medium: { label: "Medium", cls: "bg-risk-med/10 text-risk-med border-risk-med/30" },
  low: { label: "Low", cls: "bg-risk-low/10 text-risk-low border-risk-low/30" },
};

export function RiskBadge({ risk, className }: { risk: RiskLevel; className?: string }) {
  const m = map[risk];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        m.cls,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {m.label} risk
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-risk-high/10 text-risk-high border-risk-high/30",
    takedown_sent: "bg-accent/10 text-accent border-accent/30",
    escalated: "bg-risk-med/10 text-risk-med border-risk-med/30",
    resolved: "bg-success/10 text-success border-success/30",
    safe: "bg-muted text-muted-foreground border-border",
  };
  const labels: Record<string, string> = {
    active: "Active",
    takedown_sent: "Takedown sent",
    escalated: "Escalated",
    resolved: "Resolved",
    safe: "Marked safe",
  };
  return (
    <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", map[status])}>
      {labels[status] ?? status}
    </span>
  );
}
