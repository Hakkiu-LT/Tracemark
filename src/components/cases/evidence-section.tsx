import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EvidenceScreenshotDialog } from "@/components/cases/evidence-screenshot-dialog";
import type { EvidenceResponse } from "@/lib/api.types";
import { Globe, ShoppingCart, Megaphone, ExternalLink, Image } from "lucide-react";
import { ensureAbsoluteUrl } from "@/lib/utils";
import { COUNTRY_BY_CODE } from "@/lib/regions";

const ANIM = "animate-in fade-in-0 slide-in-from-bottom-3 duration-500";
const animStyle = (delay: number): React.CSSProperties => ({
  animationDelay: `${delay}ms`,
  animationFillMode: "both",
});

const isLinkable = (url: string | null | undefined): url is string => {
  if (!url) return false;
  try {
    const formatted = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    new URL(formatted);
    return true;
  } catch {
    return false;
  }
};

/** Renders a URL as a hyperlink only when it's an https link; otherwise plain text. Hidden when N/A. */
function EvidenceUrl({ url, className }: { url: string; className?: string }) {
  if (!url || url === "N/A") return null;
  if (!isLinkable(url)) {
    return (
      <span className={`text-xs text-muted-foreground break-all ${className ?? ""}`}>{url}</span>
    );
  }
  return (
    <a
      href={ensureAbsoluteUrl(url)}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-xs text-accent hover:underline flex items-center gap-1 ${className ?? ""}`}
    >
      {url}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}

export function EvidenceSection({
  evidence,
  detectionRegion,
}: {
  evidence: EvidenceResponse;
  detectionRegion?: string | null;
}) {
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

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Evidence Collected
        </h3>
        {detectionRegion && (() => {
          const conf = COUNTRY_BY_CODE[detectionRegion];
          return (
            <span className="text-xs font-mono text-foreground bg-muted px-2 py-1 rounded border border-border inline-flex items-center gap-1.5 select-none animate-fade-in">
              <span>{conf?.flag || "🌐"}</span>
              <span>Monitored Region: {conf?.name || detectionRegion}</span>
            </span>
          );
        })()}
      </div>

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
              <p className="px-5 py-4 text-sm text-muted-foreground">
                No suspicious listings found.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {evidence.marketplaces.map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-4 px-5 py-3 ${ANIM}`}
                    style={animStyle(i * 50)}
                  >
                    <div className="min-w-0">
                      {m.seller_name === "N/A" ? (
                        <p className="text-sm italic text-muted-foreground">
                          Product name and description not available
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-foreground truncate">
                          {m.seller_name}
                        </p>
                      )}
                      <EvidenceUrl url={m.listing_url} className="mt-0.5" />
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
                      {detectionRegion && (() => {
                        const conf = COUNTRY_BY_CODE[detectionRegion];
                        return (
                          <span className="text-xs font-mono bg-muted px-2 py-1 rounded border border-border text-muted-foreground inline-flex items-center gap-1" title={`Scanned from ${conf?.name || detectionRegion}`}>
                            <span>{conf?.flag || "🌐"}</span>
                            <span>{detectionRegion}</span>
                          </span>
                        );
                      })()}
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
              <p className="px-5 py-4 text-sm text-muted-foreground">
                No suspicious domains detected.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {evidence.domains.map((d, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-4 px-5 py-3 ${ANIM}`}
                    style={animStyle(100 + i * 50)}
                  >
                    <div className="min-w-0">
                      <a
                        href={ensureAbsoluteUrl(d.domain_name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono text-accent hover:underline inline-flex items-center gap-1 max-w-full truncate"
                      >
                        <span className="truncate">{d.domain_name}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      {d.registrar && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Registered by: <span className="text-foreground font-medium">{d.registrar}</span>
                        </p>
                      )}
                      {(d.creation_date || d.expiry_date || d.registrant_organization || d.registrant_country || d.registrant_email || (d.name_servers && d.name_servers.length > 0)) && (
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 bg-muted/20 p-2 rounded border border-border/40 text-[11px] font-mono text-muted-foreground max-w-md">
                          {d.creation_date && d.creation_date !== "unknown" && (
                            <div>
                              <span>Created: </span>
                              <span className="text-foreground">{d.creation_date.slice(0, 10)}</span>
                            </div>
                          )}
                          {d.expiry_date && d.expiry_date !== "unknown" && (
                            <div>
                              <span>Expires: </span>
                              <span className="text-foreground">{d.expiry_date.slice(0, 10)}</span>
                            </div>
                          )}
                          {d.registrant_organization && d.registrant_organization !== "unknown" && (
                            <div className="sm:col-span-2">
                              <span>Registrant Org: </span>
                              <span className="text-foreground truncate block">{d.registrant_organization}</span>
                            </div>
                          )}
                          {d.registrant_country && d.registrant_country !== "unknown" && (
                            <div>
                              <span>Country: </span>
                              <span className="text-foreground">{d.registrant_country}</span>
                            </div>
                          )}
                          {d.registrant_email && d.registrant_email !== "unknown" && (
                            <div className="sm:col-span-2">
                              <span>Abuse Email: </span>
                              <span className="text-foreground break-all">{d.registrant_email}</span>
                            </div>
                          )}
                          {d.name_servers && d.name_servers.length > 0 && (
                            <div className="sm:col-span-2">
                              <span>NS: </span>
                              <span className="text-foreground break-all">{d.name_servers.join(", ")}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {d.screenshot_url && (
                        <button
                          onClick={() => setScreenshotUrl(d.screenshot_url)}
                          className="flex items-center gap-1 text-xs text-accent border border-accent/30 bg-accent/5 hover:bg-accent/10 px-2 py-1 rounded transition-colors"
                        >
                          <Image className="h-3.5 w-3.5" />
                          Screenshot available
                        </button>
                      )}
                      {d.is_clone && (
                        <span className="text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 px-2 py-1 rounded">
                          Clone
                        </span>
                      )}
                      {detectionRegion && (() => {
                        const conf = COUNTRY_BY_CODE[detectionRegion];
                        return (
                          <span className="text-xs font-mono bg-muted px-2 py-1 rounded border border-border text-muted-foreground inline-flex items-center gap-1" title={`Scanned from ${conf?.name || detectionRegion}`}>
                            <span>{conf?.flag || "🌐"}</span>
                            <span>{detectionRegion}</span>
                          </span>
                        );
                      })()}
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
                        {detectionRegion && (() => {
                          const conf = COUNTRY_BY_CODE[detectionRegion];
                          return (
                            <span className="text-xs font-mono bg-muted px-2 py-1 rounded border border-border text-muted-foreground inline-flex items-center gap-1" title={`Scanned from ${conf?.name || detectionRegion}`}>
                              <span>{conf?.flag || "🌐"}</span>
                              <span>{detectionRegion}</span>
                            </span>
                          );
                        })()}
                        <span className="text-xs font-mono bg-muted px-2 py-1 rounded border border-border text-muted-foreground uppercase">
                          {a.platform}
                        </span>
                      </div>
                      <EvidenceUrl url={a.destination_url} />
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
