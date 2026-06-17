import { useState } from "react";
import { createFileRoute, Link, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { BoundingBoxOverlay } from "@/components/BoundingBoxOverlay";
import { toast } from "sonner";
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
} from "lucide-react";

export const Route = createFileRoute("/cases/$caseId")({
  head: ({ params }) => ({
    meta: [{ title: `Case ${params.caseId} — Tracemark` }],
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
  const i = useStore((s) => s.infringements.find((x) => x.id === caseId));
  const updateCaseStatus = useStore((s) => s.updateCaseStatus);
  const [reviews, setReviews] = useState<Record<number, "accepted" | "disputed" | null>>({});

  const setReview = (idx: number, val: "accepted" | "disputed") =>
    setReviews((r) => ({ ...r, [idx]: r[idx] === val ? null : val }));

  const reviewedCount = Object.values(reviews).filter(Boolean).length;

  if (!i) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Case not found.</p>
        <Button asChild variant="link">
          <Link to="/cases">Back to cases</Link>
        </Button>
      </div>
    );
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Awaiting Action";
      case "escalated":
        return "Escalated to Counsel";
      case "takedown_sent":
        return "Takedown Notice Sent";
      case "resolved":
        return "Resolved";
      case "safe":
        return "Marked as Safe";
      default:
        return "Awaiting Action";
    }
  };

  const boxes = [
    {
      x: 5,
      y: 8,
      w: 42,
      h: 18,
      label: "Trademark use",
      color: "#ef4444",
      title: "Direct Trademark Use",
      description: `The term "${i.brandName}" is used explicitly in the product title and description, directly violating registered mark.`,
    },
    {
      x: 52,
      y: 35,
      w: 38,
      h: 22,
      label: `Logo match ${i.analysis.logoMatch}%`,
      color: "#f97316",
      title: "Design Patent Infringement",
      description: `Computer vision models detected a ${i.analysis.logoMatch}% structural match to the patented product design geometry.`,
    },
    {
      x: 8,
      y: 62,
      w: 55,
      h: 12,
      label: "Stolen asset",
      color: "#a855f7",
      title: "Stolen Asset Detection",
      description: `Product images match official marketing materials with high confidence (${i.analysis.nameMatch}%), indicating asset theft.`,
    },
  ];

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
            <span className="text-foreground">Case #{i.id.toUpperCase()}</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-1">
            {i.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            Detected on {i.platform} · {getStatusText(i.status)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              updateCaseStatus(i.id, "safe");
              toast.success("Marked as safe");
            }}
            className="flex items-center gap-2"
          >
            <ShieldCheck className="h-4 w-4 text-success" />
            Mark as Safe
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              updateCaseStatus(i.id, "escalated");
              toast.success("Escalated to counsel");
            }}
            className="flex items-center gap-2"
          >
            <Gavel className="h-4 w-4 text-accent" />
            Escalate to Counsel
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
                  {i.analysis.confidence}%
                </span>
                <span className="text-xs text-muted-foreground">Confidence</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 mb-4 overflow-hidden">
                <div
                  className="bg-destructive h-2 rounded-full"
                  style={{ width: `${i.analysis.confidence}%` }}
                ></div>
              </div>
              <span className="inline-block px-2.5 py-1 bg-destructive/10 text-destructive rounded text-xs font-medium border border-destructive/20 uppercase">
                {i.risk} Risk Infringement
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
                    SELLER ID
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-foreground bg-muted px-2 py-1 rounded border border-border">
                      {i.infringer.seller}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        navigator.clipboard.writeText(i.infringer.seller);
                        toast.success("Copied Seller ID");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase block mb-1">
                    IP ADDRESS
                  </span>
                  <span className="font-mono text-xs text-foreground block">
                    {i.infringer.ip}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    {i.infringer.country}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase block mb-1">
                    TARGET URL
                  </span>
                  <a
                    className="font-mono text-xs text-accent hover:underline truncate block w-full"
                    href={i.evidence.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={i.evidence.url}
                  >
                    {i.evidence.url}
                  </a>
                </div>
                <div className="pt-4 border-t border-border">
                  <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase block mb-1">
                    DETECTION TIMESTAMP
                  </span>
                  <span className="font-mono text-xs text-foreground">
                    {new Date(i.evidence.timestamp)
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
        <div className="col-span-12 xl:col-span-9">
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
                  href={i.evidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <div className="relative flex-1 bg-muted/20 flex items-center justify-center p-4 min-h-[400px]">
              <div className="w-full h-full rounded border border-border bg-card shadow-sm relative overflow-hidden group">
                <BoundingBoxOverlay
                  src={i.evidence.screenshot_url ?? ".././src/images/evidence01.png"}
                  boxes={boxes}
                  reviews={reviews}
                  onReview={setReview}
                />
                </div>
              {/* Timestamp Overlay */}
              <div className="absolute bottom-6 right-6 bg-foreground text-background font-mono text-[11px] px-3 py-1.5 rounded opacity-90 shadow-lg border border-border/30 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                CAPTURE:{" "}
                {new Date(i.evidence.timestamp).toISOString().slice(0, 19)}Z
              </div>
            </div>
            <div className="px-4 py-2 border-t border-border bg-muted/20">
              <p className="font-mono text-[10px] text-muted-foreground text-center opacity-70">
                Analysis generated by Tracemark Vision API v2.4
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
