import React, { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { fetchCaseFromSupabase } from "@/lib/supabase";
import { markCasesViewForRestore } from "@/lib/cases-view";
import { Button } from "@/components/ui/button";
import { DecisionCard } from "@/components/cases/decision-card";
import { KeyFindings } from "@/components/cases/key-findings";
import { EvidenceSection } from "@/components/cases/evidence-section";
import { ChevronRight, FileText, ArrowLeft, Loader2, ShieldCheck, RefreshCw, Gavel } from "lucide-react";
import { toast } from "sonner";
import { updateCaseStatusBackend } from "@/lib/api";

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
  const setScanResult = useStore((s) => s.setScanResult);
  // Only show a loading state when we don't already have the result locally and
  // still need to try fetching it from Supabase.
  const [loading, setLoading] = useState(!result);
  const [updating, setUpdating] = useState<string | null>(null);

  const handleUpdateStatus = async (status: string) => {
    setUpdating(status);
    try {
      await updateCaseStatusBackend(caseId, status);
      const updatedCase = await fetchCaseFromSupabase(caseId);
      if (updatedCase) {
        setScanResult(caseId, updatedCase);
      }
      if (status === "safe") toast.success("Marked as safe");
      else if (status === "escalated") toast.success("Escalated to counsel");
      else toast.success("Status updated to analyzing");
      markCasesViewForRestore();
      navigate({ to: "/cases" });
    } catch (err) {
      toast.error("Failed to update status", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setUpdating(null);
    }
  };

  // Fallback: if the case isn't in the local store (e.g. created elsewhere or a
  // hard refresh after the persisted state was cleared), load it from Supabase
  // and hydrate the store so the takedown sub-route works too.
  useEffect(() => {
    if (result) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchCaseFromSupabase(caseId)
      .then((data) => {
        if (cancelled || !data) return;
        setScanResult(caseId, data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, result, setScanResult]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Loading case…</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-muted-foreground text-sm">Scan result not found.</p>
        <Button
          variant="outline"
          onClick={() => {
            markCasesViewForRestore();
            navigate({ to: "/cases" });
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to cases
        </Button>
      </div>
    );
  }

  const scannedAt = new Date(result.evidence.timestamp).toLocaleString();


  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${ANIM}`} style={animStyle(0)}>
        <Link
          to="/cases"
          onClick={() => markCasesViewForRestore()}
          className="hover:text-accent transition-colors"
        >
          Cases
        </Link>
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
          <Button
            variant="outline"
            disabled={updating !== null}
            onClick={() => handleUpdateStatus("safe")}
            className="flex items-center gap-2"
          >
            {updating === "safe" ? (
              <Loader2 className="h-4 w-4 animate-spin text-success" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-success" />
            )}
            Mark as Safe
          </Button>
          <Button
            variant="outline"
            disabled={updating !== null}
            onClick={() => handleUpdateStatus("analyzing")}
            className="flex items-center gap-2"
          >
            {updating === "analyzing" ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            ) : (
              <RefreshCw className="h-4 w-4 text-amber-500" />
            )}
            Analyzing
          </Button>
          <Button
            variant="outline"
            disabled={updating !== null}
            onClick={() => handleUpdateStatus("escalated")}
            className="flex items-center gap-2"
          >
            {updating === "escalated" ? (
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            ) : (
              <Gavel className="h-4 w-4 text-accent" />
            )}
            Escalate to Counsel
          </Button>
          <Button asChild>
            <Link to="/monitoring/$caseId/takedown" params={{ caseId }}>
              <FileText className="h-4 w-4 mr-2" />
              Takedown notices
              {result.takedown_reports.length > 0 && (
                <span className="ml-2 rounded-full bg-primary text-primary-foreground text-xs px-2 py-0.5">
                  {result.takedown_reports.length}
                </span>
              )}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/cases" onClick={() => markCasesViewForRestore()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to cases
            </Link>
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
