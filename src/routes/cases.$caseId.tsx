import { useEffect, useState } from "react";
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
  Cpu,
  Tag,
  Layers,
  Image,
  CheckCircle,
  XCircle,
} from "lucide-react";

const DEMO_BOXES = [
  { x: 5, y: 8, w: 42, h: 18, label: "Trademark use", color: "#ef4444" },
  { x: 52, y: 35, w: 38, h: 22, label: "Logo match 94%", color: "#f97316" },
  { x: 8, y: 62, w: 55, h: 12, label: "Stolen asset", color: "#a855f7" },
];

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
  const [visibleCards, setVisibleCards] = useState<number[]>([]);
  const [reviews, setReviews] = useState<Record<number, "accepted" | "disputed" | null>>({});

  const setReview = (idx: number, val: "accepted" | "disputed") =>
    setReviews((r) => ({ ...r, [idx]: r[idx] === val ? null : val }));

  useEffect(() => {
    const delays = [120, 280, 440];
    const timers = delays.map((delay, idx) =>
      setTimeout(() => setVisibleCards((prev) => [...prev, idx]), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [caseId]);

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
        <div className="col-span-12 xl:col-span-6">
          <Card className="overflow-hidden h-full flex flex-col relative group">
            <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-muted/40">
              <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <Camera className="h-4 w-4" />
                AUTOMATED EVIDENCE CAPTURE
              </h3>
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
                  boxes={DEMO_BOXES}
                />
                </div>
              {/* Timestamp Overlay */}
              <div className="absolute bottom-6 right-6 bg-foreground text-background font-mono text-[11px] px-3 py-1.5 rounded opacity-90 shadow-lg border border-border/30 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                CAPTURE:{" "}
                {new Date(i.evidence.timestamp).toISOString().slice(0, 19)}Z
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Infringement Analysis */}
        <div className="col-span-12 xl:col-span-3">
          <Card className="h-full flex flex-col">
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <Cpu className="h-4 w-4 text-accent" />
                  <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    AI INFRACTION ANALYSIS
                  </h3>
                </div>
                <div className="space-y-6">
                  {/* Violation 1 */}
                  <div className={`p-4 rounded border transition-all duration-500 ${reviews[0] === "accepted" ? "border-green-500/40 bg-green-500/5" : reviews[0] === "disputed" ? "border-muted bg-muted/20" : "border-destructive/30 bg-destructive/5"} ${visibleCards.includes(0) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
                    <div className="flex items-start gap-3">
                      <Tag className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <h4 className="text-xs font-semibold text-foreground">Direct Trademark Use</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                          The term <span className="font-semibold text-foreground">"{i.brandName}"</span> is used explicitly in the product title and description, directly violating registered mark.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant={reviews[0] === "accepted" ? "default" : "outline"} className="h-6 text-xs px-2 gap-1" onClick={() => setReview(0, "accepted")}>
                            <CheckCircle className="h-3 w-3" /> Accept
                          </Button>
                          <Button size="sm" variant={reviews[0] === "disputed" ? "destructive" : "outline"} className="h-6 text-xs px-2 gap-1" onClick={() => setReview(0, "disputed")}>
                            <XCircle className="h-3 w-3" /> Dispute
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Violation 2 */}
                  <div className={`p-4 rounded border transition-all duration-500 ${reviews[1] === "accepted" ? "border-green-500/40 bg-green-500/5" : reviews[1] === "disputed" ? "border-muted bg-muted/20" : "border-destructive/30 bg-destructive/5"} ${visibleCards.includes(1) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
                    <div className="flex items-start gap-3">
                      <Layers className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <h4 className="text-xs font-semibold text-foreground">Design Patent Infringement</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                          Computer vision models detected a {i.analysis.logoMatch}% structural match to the patented product design geometry.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant={reviews[1] === "accepted" ? "default" : "outline"} className="h-6 text-xs px-2 gap-1" onClick={() => setReview(1, "accepted")}>
                            <CheckCircle className="h-3 w-3" /> Accept
                          </Button>
                          <Button size="sm" variant={reviews[1] === "disputed" ? "destructive" : "outline"} className="h-6 text-xs px-2 gap-1" onClick={() => setReview(1, "disputed")}>
                            <XCircle className="h-3 w-3" /> Dispute
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Violation 3 */}
                  <div className={`p-4 rounded border transition-all duration-500 ${reviews[2] === "accepted" ? "border-green-500/40 bg-green-500/5" : reviews[2] === "disputed" ? "border-muted bg-muted/20" : "border-border bg-muted/40"} ${visibleCards.includes(2) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
                    <div className="flex items-start gap-3">
                      <Image className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <h4 className="text-xs font-semibold text-foreground">Stolen Asset Detection</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                          Product images match official marketing materials with high confidence ({i.analysis.nameMatch}%), indicating asset theft.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant={reviews[2] === "accepted" ? "default" : "outline"} className="h-6 text-xs px-2 gap-1" onClick={() => setReview(2, "accepted")}>
                            <CheckCircle className="h-3 w-3" /> Accept
                          </Button>
                          <Button size="sm" variant={reviews[2] === "disputed" ? "destructive" : "outline"} className="h-6 text-xs px-2 gap-1" onClick={() => setReview(2, "disputed")}>
                            <XCircle className="h-3 w-3" /> Dispute
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-border mt-6">
                <p className="font-mono text-[10px] text-muted-foreground text-center opacity-70">
                  Analysis generated by Tracemark Vision API v2.4
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
