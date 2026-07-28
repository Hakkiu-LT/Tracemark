import { useState } from "react";
import { createFileRoute, Link, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/error-state";
import { BoundingBoxOverlay } from "@/components/BoundingBoxOverlay";
import evidencePlaceholder from "@/images/evidence-placeholder.png";
import { toast } from "sonner";
import { ensureAbsoluteUrl } from "@/lib/utils";
import { getRegionForId, getMacroRegionForCountry, COUNTRY_BY_CODE } from "@/lib/regions";
import {
  ChevronRight,
  ShieldCheck,
  Gavel,
  FileText,
  AlertTriangle,
  Copy,
  Camera,
  ExternalLink,
  Clock,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  ImageOff,
} from "lucide-react";
import { getInfringementById, getInfringementEvidence, updateInfringementStatus } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { openEscalationEmail, buildInfringementEscalationText } from "@/lib/escalation-email";
import { CaseTimeline, type TimelineEvent } from "@/components/cases/CaseTimeline";

export const Route = createFileRoute("/cases/$caseId")({
  head: ({ params }) => ({
    meta: [{ title: `Case ${params.caseId} — HAKKIU` }],
  }),
  component: CaseDetailLayout,
});

function CaseDetailLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { caseId } = Route.useParams();

  if (pathname !== `/cases/${caseId}`) {
    return <Outlet />;
  }
  return <CaseDetail />;
}

function CaseDetail() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: i, isLoading: isCaseLoading, error: caseError, refetch: refetchCase } = useQuery({
    queryKey: ["infringement", caseId],
    queryFn: () => getInfringementById(caseId),
  });

  const { data: evidenceList, isLoading: isEvidenceLoading } = useQuery({
    queryKey: ["infringement_evidence", caseId],
    queryFn: () => getInfringementEvidence(caseId),
  });

  const [reviews, setReviews] = useState<Record<number, "accepted" | "disputed" | null>>({});

  const setReview = (idx: number, val: "accepted" | "disputed") =>
    setReviews((r) => ({ ...r, [idx]: r[idx] === val ? null : val }));

  const reviewedCount = Object.values(reviews).filter(Boolean).length;

  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const updateStatusMutation = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) =>
      updateInfringementStatus(caseId, status, reason),
    onSuccess: (data, variables) => {
      const { status } = variables;
      queryClient.setQueryData(["infringement", caseId], data);
      queryClient.invalidateQueries({ queryKey: ["dashboard_cases"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_infringements"] });
      queryClient.invalidateQueries({ queryKey: ["infringements"] });
      if (status === "dismissed" || status === "safe") {
        toast.success("Marked as safe");
      } else if (status === "declined") {
        toast.success("Case declined");
      } else if (status === "analyzing" || status === "active") {
        toast.success(`Status updated to ${status}`);
      } else if (status === "resolved" || status === "complete") {
        toast.success("Marked as completed");
      } else {
        toast.success("Status escalated");
        if (data) {
          const { subject, body } = buildInfringementEscalationText(data);
          openEscalationEmail({
            emailPreference: user?.email || "",
            subject,
            body,
          });
        }
      }
    },
    onError: (err) => {
      toast.error("Failed to update status");
    },
  });

  if (caseError) {
    return (
      <div className="py-10">
        <ErrorState
          variant="block"
          error={caseError}
          title="Couldn't load this case"
          onRetry={() => refetchCase()}
        />
        <div className="mt-2 text-center">
          <Button asChild variant="link">
            <Link to="/cases">Back to cases</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isCaseLoading || !i) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 xl:col-span-3 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
          <div className="col-span-12 xl:col-span-6">
            <Skeleton className="h-[500px] w-full" />
          </div>
          <div className="col-span-12 xl:col-span-3">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const handleUpdateStatus = (status: string, reason?: string) => {
    updateStatusMutation.mutate({ status, reason });
  };

  const handleRetryCapture = () => {
    const promise = new Promise((resolve) => setTimeout(resolve, 3000));
    toast.promise(promise, {
      loading: "Recapturing evidence screenshot...",
      success: "Screenshot recaptured successfully",
      error: "Failed to recapture screenshot",
    });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
      case "flagged":
        return "Awaiting Action";
      case "escalated":
        return "Escalated to Counsel";
      case "takedown_sent":
        return "Takedown Notice Sent";
      case "resolved":
      case "complete":
      case "completed":
        return "Completed";
      case "safe":
      case "dismissed":
        return "Marked as Safe";
      case "declined":
        return "Declined";
      case "error":
        return "Capture Failed";
      default:
        return "Awaiting Action";
    }
  };

  const latestEvidence = evidenceList?.[0];

  // The screenshot to display: prefer the newest evidence_items capture, else fall
  // back to the infringement's own (API-signed) screenshot. null → show the
  // "no screenshot" placeholder empty-state.
  const screenshotUrl = latestEvidence?.screenshot_url ?? i?.screenshot_url ?? null;

  const boxes = latestEvidence?.ai_analysis?.boxes || [
    {
      x: 5, y: 8, w: 42, h: 18,
      label: "Trademark use", color: "#ef4444",
      title: "Direct Trademark Use",
      description: `Detected potential trademark violation on ${i.platform}.`,
    }
  ];

  const timelineEvents: TimelineEvent[] = [
    { id: "flagged", type: "flagged", timestamp: i.flagged_at, title: "Infringement Flagged", description: `Detected on ${i.platform}` }
  ];
  if (evidenceList) {
    evidenceList.forEach((ev, idx) => {
      timelineEvents.push({
        id: `ev-${ev.id}`,
        type: "analyzing",
        timestamp: ev.captured_at,
        title: "Evidence Captured",
        description: "Automated screenshot captured"
      });
    });
  }
  if (i.status !== "flagged") {
    timelineEvents.push({
      id: "status-change",
      type: i.status as TimelineEvent["type"],
      timestamp: i.created_at, // rough approx
      title: `Status: ${i.status}`
    });
  }

  const isUpdating = updateStatusMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Page Header & Action Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-2 text-sm">
            <Link to="/cases" className="hover:text-accent transition-colors">
              Cases
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">Case #{i.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-1">
            Suspicious Activity on {i.platform}
          </h2>
          <p className="text-sm text-muted-foreground">
            Detected on {new Date(i.flagged_at).toLocaleDateString()} · {getStatusText(i.status)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={isUpdating}
            onClick={() => handleUpdateStatus("safe")}
            className="flex items-center gap-2"
          >
            {isUpdating && updateStatusMutation.variables?.status === "safe" ? (
              <Loader2 className="h-4 w-4 animate-spin text-success" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-success" />
            )}
            Safe
          </Button>
          <Button
            variant="outline"
            disabled={isUpdating}
            onClick={() => handleUpdateStatus("active")}
            className="flex items-center gap-2"
          >
            {isUpdating && updateStatusMutation.variables?.status === "active" ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            ) : (
              <RefreshCw className="h-4 w-4 text-amber-500" />
            )}
            Mark Active
          </Button>
          <Button
            variant="outline"
            disabled={isUpdating}
            onClick={() => handleUpdateStatus("escalated")}
            className="flex items-center gap-2"
          >
            {isUpdating && updateStatusMutation.variables?.status === "escalated" ? (
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            ) : (
              <Gavel className="h-4 w-4 text-accent" />
            )}
            Escalate to Counsel
          </Button>
          <Button
            variant="outline"
            disabled={isUpdating}
            onClick={() => handleUpdateStatus("resolved")}
            className="flex items-center gap-2"
          >
            {isUpdating && updateStatusMutation.variables?.status === "resolved" ? (
              <Loader2 className="h-4 w-4 animate-spin text-success" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-success" />
            )}
            Complete
          </Button>
          <Button
            variant="outline"
            disabled={isUpdating}
            onClick={() => setShowDeclineDialog(true)}
            className="flex items-center gap-2"
          >
            {isUpdating && updateStatusMutation.variables?.status === "declined" ? (
              <Loader2 className="h-4 w-4 animate-spin text-destructive" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            Declined
          </Button>
          <Button
            onClick={() =>
              navigate({
                to: "/cases/$caseId/takedown",
                params: { caseId: i.id },
              })
            }
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Generate Takedown Notice
          </Button>
        </div>
      </div>

      {i.status === "error" || !screenshotUrl ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm font-medium">Evidence capture failed or is still processing. The target URL may be blocking automated access.</p>
          </div>
          <Button variant="outline" size="sm" className="border-destructive/30 hover:bg-destructive/20 text-destructive cursor-pointer" onClick={handleRetryCapture}>
            <RefreshCw className="h-3 w-3 mr-2" /> Retry Capture
          </Button>
        </div>
      ) : null}

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: Infringer Metadata */}
        <div className="col-span-12 xl:col-span-3 flex flex-col gap-6">
          {/* Risk Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  RISK ASSESSMENT
                </h3>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-destructive">
                  {Math.round(i.match_score * 100)}%
                </span>
                <span className="text-xs text-muted-foreground">Confidence</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 mb-4 overflow-hidden">
                <div
                  className="bg-destructive h-2 rounded-full"
                  style={{ width: `${i.match_score * 100}%` }}
                ></div>
              </div>
              <span className="inline-block px-2.5 py-1 bg-destructive/10 text-destructive rounded text-xs font-medium border border-destructive/20 uppercase">
                {i.risk_level} Risk Infringement
              </span>
            </CardContent>
          </Card>

          {/* Details Card */}
          <Card className="flex-1">
            <CardContent className="p-6">
              <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-6">
                INFRINGER METADATA
              </h3>
              <div className="space-y-6">
                <div>
                  <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase block mb-1">
                    PLATFORM
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-[#FF4500] flex items-center justify-center text-white text-[10px] font-bold uppercase">
                      {i.platform.slice(0, 1)}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {i.platform}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase block mb-1">
                    MATCH TYPE
                  </span>
                  <span className="font-mono text-xs text-foreground bg-muted px-2 py-1 rounded border border-border inline-block">
                    {i.match_type}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase block mb-1">
                    DETECTION PROXY
                  </span>
                  {(() => {
                    const cCode = i.detection_region || getRegionForId(i.case_id || i.id);
                    const conf = COUNTRY_BY_CODE[cCode];
                    const macroReg = getMacroRegionForCountry(cCode);
                    return (
                      <span className="font-mono text-xs text-foreground bg-muted px-2 py-1 rounded border border-border inline-flex items-center gap-1.5 select-none">
                        <span>{conf?.flag || "🌐"}</span>
                        <span>{conf?.name || cCode} ({macroReg}) Proxy</span>
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase block mb-1">
                    TARGET URL
                  </span>
                  <a
                    className="font-mono text-xs text-accent hover:underline truncate block w-full"
                    href={ensureAbsoluteUrl(i.source_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={i.source_url}
                  >
                    {i.source_url}
                  </a>
                </div>
                <div className="pt-4 border-t border-border">
                  <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase block mb-1">
                    DETECTION TIMESTAMP
                  </span>
                  <span className="font-mono text-xs text-foreground">
                    {new Date(i.flagged_at)
                      .toISOString()
                      .replace("T", " ")
                      .slice(0, 19)}{" "}
                    UTC
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center Column: Automated Evidence Capture */}
        <div className="col-span-12 xl:col-span-6">
          <Card className="overflow-hidden h-full flex flex-col relative group">
            <div className="px-4 py-3 border-b border-border flex justify-between items-start bg-muted/40">
              <div>
                <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  AUTOMATED EVIDENCE CAPTURE
                </h3>
                <span className="block text-[11px] text-muted-foreground mt-1">
                  {boxes.length} infringements found · {reviewedCount} selected · hover a detection to accept or dispute it
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                asChild
              >
                <a
                  href={ensureAbsoluteUrl(i.source_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <div className="relative flex-1 bg-muted/20 flex items-center justify-center p-4 min-h-[400px]">
              {isEvidenceLoading ? (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading evidence...</p>
                </div>
              ) : screenshotUrl ? (
                <div className="w-full h-full rounded border border-border bg-card shadow-sm relative overflow-hidden group">
                  <BoundingBoxOverlay
                    src={screenshotUrl}
                    boxes={boxes}
                    reviews={reviews}
                    onReview={setReview}
                  />
                </div>
              ) : (
                /* No screenshot captured — designed empty-state */
                <div className="flex select-none flex-col items-center justify-center gap-5 px-6 text-center">
                  <img
                    src={evidencePlaceholder}
                    alt="No screenshot available"
                    draggable={false}
                    className="pointer-events-none w-full max-w-[340px] opacity-95"
                  />
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground/70">
                      <ImageOff className="h-4 w-4" />
                      No screenshot captured
                    </div>
                    <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground">
                      Automated evidence capture wasn&apos;t available for this detection. The
                      other evidence details remain valid.
                    </p>
                  </div>
                </div>
              )}
              {/* Timestamp Overlay — only when a real screenshot is shown */}
              {screenshotUrl && (
                <div className="absolute bottom-6 right-6 bg-foreground text-background font-mono text-[11px] px-3 py-1.5 rounded opacity-90 shadow-lg border border-border/30 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  CAPTURE:{" "}
                  {latestEvidence
                    ? new Date(latestEvidence.captured_at).toISOString().slice(0, 19) + "Z"
                    : new Date(i.created_at).toISOString().slice(0, 19) + "Z"}
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-border bg-muted/20">
              <p className="font-mono text-[10px] text-muted-foreground text-center opacity-70">
                Analysis generated by HAKKIU Vision API v2.4
              </p>
            </div>
          </Card>
        </div>

        {/* Right Column: Timeline */}
        <div className="col-span-12 xl:col-span-3">
          <CaseTimeline events={timelineEvents} />
        </div>
      </div>

      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Decline Case</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Please write the reason why this case is being declined.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Enter decline reason..."
              className="w-full h-24 px-3 py-2 text-sm text-foreground bg-background rounded-md border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none resize-none transition-colors"
              required
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeclineDialog(false);
                setDeclineReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!declineReason.trim()}
              onClick={() => {
                setShowDeclineDialog(false);
                handleUpdateStatus("declined", declineReason);
              }}
            >
              Decline Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
