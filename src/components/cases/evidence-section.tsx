import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EvidenceScreenshotDialog } from "@/components/cases/evidence-screenshot-dialog";
import type { EvidenceResponse } from "@/lib/api.types";
import { Globe, ShoppingCart, Megaphone, ExternalLink, Image } from "lucide-react";

const ANIM = "animate-in fade-in-0 slide-in-from-bottom-3 duration-500";
const animStyle = (delay: number): React.CSSProperties => ({
  animationDelay: `${delay}ms`,
  animationFillMode: "both",
});

export function EvidenceSection({ evidence }: { evidence: EvidenceResponse }) {
  const hasMarketplaces = evidence.marketplaces.length > 0;
  const hasDomains = evidence.domains.length > 0;
  const hasAds = evidence.ads.length > 0;
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {screenshotUrl && (
        <EvidenceScreenshotDialog
          open={!!screenshotUrl}
          onOpenChange={(open) => !open && setScreenshotUrl(null)}
          screenshotUrl={screenshotUrl}
        />
      )}

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
                      {m.screenshot_url && (
                        <button
                          onClick={() => setScreenshotUrl(m.screenshot_url)}
                          className="flex items-center gap-1 text-xs text-accent border border-accent/30 bg-accent/5 hover:bg-accent/10 px-2 py-1 rounded transition-colors"
                        >
                          <Image className="h-3.5 w-3.5" />
                          Screenshot available
                        </button>
                      )}
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
                      <div className="flex items-center gap-3">
                        {a.screenshot_url && (
                          <button
                            onClick={() => setScreenshotUrl(a.screenshot_url)}
                            className="flex items-center gap-1 text-xs text-accent border border-accent/30 bg-accent/5 hover:bg-accent/10 px-2 py-1 rounded transition-colors"
                          >
                            <Image className="h-3.5 w-3.5" />
                            Screenshot available
                          </button>
                        )}
                        <span className="text-xs font-mono bg-muted px-2 py-1 rounded border border-border text-muted-foreground uppercase">
                          {a.platform}
                        </span>
                      </div>
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
