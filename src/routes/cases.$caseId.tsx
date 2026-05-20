import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { RiskBadge, StatusBadge } from "@/components/risk-badge";
import { ArrowLeft, FileText, Gavel, ShieldCheck, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/cases/$caseId")({
  head: ({ params }) => ({
    meta: [{ title: `Case ${params.caseId} — Tracemark` }],
  }),
  component: CaseDetail,
});

function CaseDetail() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const i = useStore((s) => s.infringements.find((x) => x.id === caseId));
  const updateCaseStatus = useStore((s) => s.updateCaseStatus);

  if (!i) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Case not found.</p>
        <Button asChild variant="link"><Link to="/cases">Back to cases</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link to="/cases"><ArrowLeft className="mr-1 h-4 w-4" /> Back to cases</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{i.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RiskBadge risk={i.risk} />
            <StatusBadge status={i.status} />
            <span className="text-xs text-muted-foreground">Case #{i.id.toUpperCase()} · {i.brandName}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { updateCaseStatus(i.id, "safe"); toast.success("Marked as safe"); }}>
            <ShieldCheck className="mr-1.5 h-4 w-4" /> Mark as safe
          </Button>
          <Button variant="outline" onClick={() => { updateCaseStatus(i.id, "escalated"); toast.success("Escalated to counsel"); }}>
            <Gavel className="mr-1.5 h-4 w-4" /> Escalate to counsel
          </Button>
          <Button onClick={() => navigate({ to: "/cases/$caseId/takedown", params: { caseId: i.id } })}>
            <FileText className="mr-1.5 h-4 w-4" /> Generate takedown
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Captured evidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${i.thumbnail} 0%, oklch(0.22 0.05 260) 100%)` }} />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <div className="rounded-md bg-black/40 px-3 py-1.5 text-xs font-mono backdrop-blur">
                  📷 Automated screenshot · {new Date(i.evidence.timestamp).toLocaleString()}
                </div>
                <p className="mt-3 text-lg font-semibold">{i.title}</p>
                <p className="text-sm opacity-80">{i.price}</p>
              </div>
              <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-[10px] font-mono text-white">EVIDENCE-{i.id.toUpperCase()}</div>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-md border bg-muted/30 p-4 text-xs sm:grid-cols-2">
              <MetaRow label="Timestamp" value={new Date(i.evidence.timestamp).toISOString()} />
              <MetaRow label="URL" value={i.evidence.url} link />
              <MetaRow label="Infringer IP" value={i.infringer.ip} />
              <MetaRow label="Detection method" value={i.evidence.method} />
              <MetaRow label="User agent" value={i.evidence.userAgent} />
              <MetaRow label="Country" value={i.infringer.country} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Infringer</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row k="Seller" v={i.infringer.seller} />
              <Row k="Store" v={<a href={`https://${i.infringer.storeUrl}`} target="_blank" rel="noreferrer" className="text-accent hover:underline inline-flex items-center gap-1 font-mono text-xs">{i.infringer.storeUrl} <ExternalLink className="h-3 w-3" /></a>} />
              <Row k="Country" v={i.infringer.country} />
              <Row k="Contact" v={<span className="font-mono text-xs">{i.infringer.contact}</span>} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-accent" /> AI infringement analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Overall confidence</span>
                  <span className="font-mono font-semibold">{i.analysis.confidence}%</span>
                </div>
                <Progress value={i.analysis.confidence} className="h-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Mini k="Logo match" v={i.analysis.logoMatch} />
                <Mini k="Name match" v={i.analysis.nameMatch} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
                <p className="mt-0.5 font-medium">{i.analysis.category}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Rationale</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">{i.analysis.rationale}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-mono break-all ${link ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
function Mini({ k, v }: { k: string; v: number }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold">{v}%</p>
    </div>
  );
}
