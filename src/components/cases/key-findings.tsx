import { Card, CardContent } from "@/components/ui/card";
import type { DecisionResponse } from "@/lib/api.types";
import { TrendingUp } from "lucide-react";

export function KeyFindings({ decision }: { decision: DecisionResponse }) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardContent className="p-0 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
              Key Findings
            </h3>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground/50">
            {decision.key_findings.length} items
          </span>
        </div>

        <div className="divide-y divide-border/50">
          {decision.key_findings.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground text-center">No key findings.</p>
          ) : (
            decision.key_findings.map((f, i) => (
              <div
                key={i}
                className="flex gap-3 px-5 py-4 hover:bg-muted/20 transition-colors group animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
              >
                <span className="font-mono text-[11px] font-bold text-accent/60 shrink-0 tabular-nums w-5 pt-0.5 group-hover:text-accent transition-colors">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-xs text-foreground/80 leading-relaxed">{f}</p>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-border shrink-0">
          <p className="font-mono text-[10px] text-muted-foreground/40 text-center">
            Tracemark Vision API v2.4
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
