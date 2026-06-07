import React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DecisionResponse, EvidenceResponse } from "@/lib/api.types";
import {
  ChevronRight,
  ShieldAlert,
  Eye,
  CheckCircle,
  TrendingUp,
  Globe,
  ShoppingCart,
  Megaphone,
  FileText,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/monitoring/$caseId")({
  head: ({ params }) => ({
    meta: [{ title: `Scan Result ${params.caseId.slice(0, 8)} — Tracemark` }],
  }),
  component: MonitoringScanResultPage,
});

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

function DecisionCard({ decision }: { decision: DecisionResponse }) {
  const risk = RISK_CONFIG[decision.risk_level];
  const action = ACTION_CONFIG[decision.recommended_action];
  const quality = QUALITY_CONFIG[decision.evidence_quality];
  const ActionIcon = action.icon;

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex gap-6">
          {/* Left column: action, risk, summary */}
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

          {/* Right column: confidence + evidence quality as rows */}
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


function KeyFoundingsCard({ decision }: { decision: DecisionResponse }) {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardContent className="p-0 h-full flex flex-col">

        {/* Header */}
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

        {/* Findings */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
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

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border shrink-0">
          <p className="font-mono text-[10px] text-muted-foreground/40 text-center">
            Tracemark Vision API v2.4
          </p>
        </div>

      </CardContent>
    </Card>
  );
}

const ANIM = "animate-in fade-in-0 slide-in-from-bottom-3 duration-500";
const animStyle = (delay: number): React.CSSProperties => ({
  animationDelay: `${delay}ms`,
  animationFillMode: "both",
});

function EvidenceSection({ evidence }: { evidence: EvidenceResponse }) {
  const hasMarketplaces = evidence.marketplaces.length > 0;
  const hasDomains = evidence.domains.length > 0;
  const hasAds = evidence.ads.length > 0;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Evidence Collected</h3>

      {/* Marketplaces */}
      <div className={ANIM} style={animStyle(0)}>
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
              <ShoppingCart className="h-4 w-4 text-accent" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Marketplace Listings ({evidence.marketplaces.length})
              </span>
            </div>
            {!hasMarketplaces ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">No suspicious listings found.</p>
            ) : (
              <div className="divide-y divide-border">
                {evidence.marketplaces.map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-4 px-5 py-3 ${ANIM}`}
                    style={animStyle(i * 50)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.seller_name}</p>
                      <a
                        href={m.listing_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline flex items-center gap-1 mt-0.5"
                      >
                        {m.listing_url}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono bg-muted px-2 py-1 rounded border border-border text-muted-foreground uppercase">
                        {m.platform}
                      </span>
                      {m.price && (
                        <span className="text-sm font-semibold text-foreground">{m.price}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Domains */}
      <div className={ANIM} style={animStyle(100)}>
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
              <Globe className="h-4 w-4 text-accent" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Suspicious Domains ({evidence.domains.length})
              </span>
            </div>
            {!hasDomains ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">No suspicious domains detected.</p>
            ) : (
              <div className="divide-y divide-border">
                {evidence.domains.map((d, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-4 px-5 py-3 ${ANIM}`}
                    style={animStyle(100 + i * 50)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-mono text-foreground truncate">{d.domain_name}</p>
                      {d.registrar && (
                        <p className="text-xs text-muted-foreground mt-0.5">Registered by: {d.registrar}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {d.is_clone && (
                        <span className="text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 px-2 py-1 rounded">
                          Clone
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground font-mono">
                        {d.similarity_score}% match
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ads */}
      <div className={ANIM} style={animStyle(200)}>
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
              <Megaphone className="h-4 w-4 text-accent" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ad Abuse ({evidence.ads.length})
              </span>
            </div>
            {!hasAds ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">No ad abuse detected.</p>
            ) : (
              <div className="divide-y divide-border">
                {evidence.ads.map((a, i) => (
                  <div
                    key={i}
                    className={`px-5 py-3 space-y-1 ${ANIM}`}
                    style={animStyle(200 + i * 50)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-mono bg-muted px-2 py-1 rounded border border-border text-muted-foreground uppercase">
                        {a.platform}
                      </span>
                      <a
                        href={a.destination_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline flex items-center gap-1"
                      >
                        {a.destination_url}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                    <p className="text-sm text-foreground">{a.ad_copy}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            Generate Takedown Notice
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
          <KeyFoundingsCard decision={result.decision} />
        </div>
      </div>
    </div>
  );
}
