import React from "react";
import { createFileRoute, Link, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { DecisionCard } from "@/components/cases/decision-card";
import { KeyFindings } from "@/components/cases/key-findings";
import { EvidenceSection } from "@/components/cases/evidence-section";
import { ChevronRight, FileText, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/monitoring/$caseId")({
  head: ({ params }) => ({
    meta: [{ title: `Scan Result ${params.caseId.slice(0, 8)} — Tracemark` }],
  }),
  component: MonitoringCaseIdLayout,
});

function MonitoringCaseIdLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { caseId } = Route.useParams();
  if (pathname !== `/monitoring/${caseId}`) return <Outlet />;
  return <MonitoringScanResultPage />;
}

const ANIM = "animate-in fade-in-0 slide-in-from-bottom-3 duration-500";
const animStyle = (delay: number): React.CSSProperties => ({
  animationDelay: `${delay}ms`,
  animationFillMode: "both",
});

function MonitoringScanResultPage() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const result = useStore((s) => s.scanResults[caseId]);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-muted-foreground text-sm">Scan result not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/monitoring" })}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Monitoring
        </Button>
      </div>
    );
  }

  const scannedAt = new Date(result.evidence.timestamp).toLocaleString();
  const hasReports = result.takedown_reports.length > 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${ANIM}`} style={animStyle(0)}>
        <Link to="/monitoring" className="hover:text-accent transition-colors">Monitoring</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground font-mono">
          Check Brand Case #{caseId.slice(0, 8).toUpperCase()}
        </span>
      </div>

      {/* Header */}
      <div className={`flex flex-wrap items-start justify-between gap-4 ${ANIM}`} style={animStyle(80)}>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Scan Result</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Completed at {scannedAt} · Case ID{" "}
            <span className="font-mono">{caseId}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link to="/monitoring">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Monitoring
            </Link>
          </Button>
          <Button asChild={hasReports} disabled={!hasReports}>
            {hasReports ? (
              <Link to="/monitoring/$caseId/takedown" params={{ caseId }}>
                <FileText className="h-4 w-4 mr-2" />
                Takedown notices
                <span className="ml-2 rounded-full bg-primary text-primary-foreground text-xs px-2 py-0.5">
                  {result.takedown_reports.length}
                </span>
              </Link>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Takedown notices
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={`xl:col-span-3 ${ANIM}`} style={animStyle(160)}>
          <DecisionCard decision={result.decision} />
        </div>
        <div className={`xl:col-span-2 ${ANIM}`} style={animStyle(260)}>
          <EvidenceSection evidence={result.evidence} />
        </div>
        <div className={ANIM} style={animStyle(320)}>
          <KeyFindings decision={result.decision} />
        </div>
      </div>
    </div>
  );
}
