import { Card, CardContent } from "@/components/ui/card";
import type { DecisionResponse } from "@/lib/api.types";
import { ShieldAlert, Eye, CheckCircle } from "lucide-react";

const RISK_CONFIG = {
  HIGH:   { label: "High Risk",   className: "bg-destructive/10 text-destructive border-destructive/30" },
  MEDIUM: { label: "Medium Risk", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  LOW:    { label: "Low Risk",    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
};

const ACTION_CONFIG = {
  TAKEDOWN: { label: "Takedown Recommended", icon: ShieldAlert, className: "text-destructive" },
  MONITOR:  { label: "Continue Monitoring",  icon: Eye,         className: "text-amber-600" },
  DISMISS:  { label: "No Action Required",   icon: CheckCircle, className: "text-emerald-600" },
};

const QUALITY_CONFIG = {
  STRONG:   { label: "Strong",   className: "text-emerald-600" },
  MODERATE: { label: "Moderate", className: "text-amber-600" },
  WEAK:     { label: "Weak",     className: "text-muted-foreground" },
};

export function DecisionCard({ decision }: { decision: DecisionResponse }) {
  const risk = RISK_CONFIG[decision.risk_level];
  const action = ACTION_CONFIG[decision.recommended_action];
  const quality = QUALITY_CONFIG[decision.evidence_quality];
  const ActionIcon = action.icon;

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex gap-6">
          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex justify-between">
              <div className="flex items-center gap-3">
                <ActionIcon className={`h-6 w-6 shrink-0 ${action.className}`} />
                <h3 className={`text-lg font-bold ${action.className}`}>{action.label}</h3>
              </div>
              <span className={`inline-block text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border ${risk.className}`}>
                {risk.label}
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{decision.case_summary}</p>
          </div>

          <div className="shrink-0 w-44 space-y-4 pt-1 border-l border-border pl-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Confidence</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{ width: `${decision.confidence_score * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {Math.round(decision.confidence_score * 100)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Evidence Quality</p>
              <span className={`text-sm font-semibold ${quality.className}`}>{quality.label}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
