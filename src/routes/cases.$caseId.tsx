import { createFileRoute, Link, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import {
  ChevronRight,
  ArrowLeft,
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
                <img
                  alt="Evidence Screenshot"
                  className="w-full h-full object-cover object-top opacity-90"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDylVvSfA7Dp7MoZ2Fr-6dd86oLk5KpPDqIxxIQY5Z2LQ-7gvVX76mMe84tRAznqKj-LiFjl3HXlOd-KJVhLA5u3CKaFGtkmXJ7pmoFt5hDcZzf64rJIeK4LQmq6VxqOToodngGC6-1HLavvEFUxm-I0TPDqFsHom8co8dyf9JoSKhJybD9Rh8xe5pUrMrvvRcfGKLRh1r5i-MZR4oa7lRsb4OJhXvz3uT6SLQNtvSwQUeYfkZNLuswKNIqMaiX3pj-qHvTrWIkN5s"
                />
                {/* Bounding Box Overlay Simulation */}
                <div className="absolute top-[20%] left-[10%] w-[40%] h-[30%] border-2 border-destructive bg-destructive/10 rounded pointer-events-none"></div>
                <div className="absolute bottom-[20%] right-[15%] w-[25%] h-[15%] border-2 border-accent bg-accent/10 rounded pointer-events-none"></div>
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
                  <div className="p-4 rounded border border-destructive/30 bg-destructive/5">
                    <div className="flex items-start gap-3">
                      <Tag className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-xs font-semibold text-foreground">
                          Direct Trademark Use
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                          The term{" "}
                          <span className="font-semibold text-foreground">
                            "{i.brandName}"
                          </span>{" "}
                          is used explicitly in the product title and
                          description, directly violating registered mark.
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* Violation 2 */}
                  <div className="p-4 rounded border border-destructive/30 bg-destructive/5">
                    <div className="flex items-start gap-3">
                      <Layers className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-xs font-semibold text-foreground">
                          Design Patent Infringement
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                          Computer vision models detected a {i.analysis.logoMatch}%
                          structural match to the patented product design geometry.
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* Violation 3 */}
                  <div className="p-4 rounded border border-border bg-muted/40">
                    <div className="flex items-start gap-3">
                      <Image className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-xs font-semibold text-foreground">
                          Stolen Asset Detection
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                          Product images in the listing carousel match official marketing materials with high confidence ({i.analysis.nameMatch}%), indicating asset theft.
                        </p>
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
