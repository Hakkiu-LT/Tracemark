import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useStore, type Platform } from "@/lib/store";
import { useState } from "react";
import { toast } from "sonner";
import { 
  Info, 
  Image as ImageIcon, 
  Globe, 
  Store, 
  ShoppingCart, 
  Tag, 
  Instagram, 
  Video, 
  UploadCloud, 
  Radar, 
  ChevronRight,
  Link as LinkIcon
} from "lucide-react";

export const Route = createFileRoute("/monitoring/new")({
  head: () => ({
    meta: [
      { title: "Add Asset — Tracemark" },
      { name: "description", content: "Register a new trademark or brand asset for continuous monitoring." },
    ],
  }),
  component: NewAssetPage,
});

const PLATFORMS: Platform[] = ["Amazon", "Shopify", "eBay", "AliExpress", "Web Domain", "Instagram", "TikTok"];

const PLATFORM_DETAILS: Record<Platform, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  Amazon: { label: "Amazon", icon: Store },
  Shopify: { label: "Shopify Network", icon: ShoppingCart },
  AliExpress: { label: "AliExpress", icon: Globe },
  eBay: { label: "eBay", icon: Tag },
  Instagram: { label: "Instagram", icon: Instagram },
  TikTok: { label: "TikTok", icon: Video },
  "Web Domain": { label: "Web Domain", icon: LinkIcon },
};

function NewAssetPage() {
  const navigate = useNavigate();
  const addMark = useStore((s) => s.addMark);
  const clients = useStore((s) => s.clients);
  const persona = useStore((s) => s.persona);
  const activeClientId = useStore((s) => s.activeClientId);

  const [brandName, setBrandName] = useState("");
  const [regNum, setRegNum] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [website, setWebsite] = useState("");
  const [clientId, setClientId] = useState(activeClientId ?? clients[0]?.id ?? "c1");
  const [selected, setSelected] = useState<Set<Platform>>(new Set([]));
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  function toggle(p: Platform) {
    const next = new Set(selected);
    next.has(p) ? next.delete(p) : next.add(p);
    setSelected(next);
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandName) {
      toast.error("Brand name is required.");
      return;
    }
    if (!website) {
      toast.error("Official website URL is required.");
      return;
    }
    
    // Clean up website URL if necessary
    let cleanWebsite = website.trim();
    if (!cleanWebsite.startsWith("http://") && !cleanWebsite.startsWith("https://")) {
      cleanWebsite = `https://${cleanWebsite}`;
    }

    addMark({
      brandName,
      registrationNumber: regNum || "Pending",
      website: cleanWebsite.replace(/^https?:\/\//, ""), // Keep domain only for store compatibility
      clientId,
      platforms: Array.from(selected),
      logoColor: "oklch(0.58 0.18 255)",
    });

    toast.success(`Monitoring started for ${brandName}`, {
      description: "First scan will complete in approximately 60 seconds.",
    });
    navigate({ to: "/monitoring" });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/monitoring" className="hover:text-accent transition-colors">Monitoring</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Add Monitored Asset</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Add New Monitored Asset</h2>
        <p className="text-base text-muted-foreground mt-1">
          Configure details to track unauthorized usage across digital platforms.
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Area - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Asset Details */}
          <section className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <Info className="h-5 w-5 text-accent" />
              <h3 className="text-lg font-semibold text-foreground">1. Asset Information</h3>
            </div>

            {/* Client selector for law firm persona */}
            {persona === "law_firm" && (
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor="client">
                  Client <span className="text-destructive">*</span>
                </label>
                <select
                  id="client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-md border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground bg-background transition-colors"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2" htmlFor="brandName">
                  Brand / Mark Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  id="brandName"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g., Apple Air Pods"
                  className="w-full px-4 py-2.5 rounded-md border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground bg-background transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2" htmlFor="regNumber">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    id="regNumber"
                    value={regNum}
                    onChange={(e) => setRegNum(e.target.value)}
                    placeholder="USPTO / WIPO Ref"
                    className="w-full px-4 py-2.5 rounded-md border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none font-mono text-sm text-foreground bg-background transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2" htmlFor="jurisdiction">
                    Primary Jurisdiction
                  </label>
                  <select
                    id="jurisdiction"
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-md border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground bg-background transition-colors"
                  >
                    <option value="">Select Jurisdiction</option>
                    <option value="us">United States (USPTO)</option>
                    <option value="eu">European Union (EUIPO)</option>
                    <option value="uk">United Kingdom (UKIPO)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2" htmlFor="officialUrl">
                  Official Website URL <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-muted-foreground">
                    <LinkIcon className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    id="officialUrl"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://www.yourbrand.com"
                    className="w-full pl-9 pr-4 py-2.5 rounded-md border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground bg-background transition-colors"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Used as the baseline to differentiate authorized vs. unauthorized sellers.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Visual Assets */}
          <section className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <ImageIcon className="h-5 w-5 text-accent" />
              <h3 className="text-lg font-semibold text-foreground">2. Visual Reference</h3>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Upload logos, product images, or specific design marks to improve visual scanning accuracy.
            </p>
            
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 text-center bg-background/50 hover:bg-muted/30 transition-colors cursor-pointer group relative min-h-[160px]">
              {logoPreview ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={logoPreview} alt="Logo preview" className="max-h-32 object-contain rounded" />
                  <span className="text-xs text-muted-foreground hover:text-accent underline mt-2">Change image</span>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 group-hover:bg-muted/80 transition-colors">
                    <UploadCloud className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-foreground mb-1 text-sm">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground">SVG, PNG, JPG or PDF (max. 10MB)</p>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
            </label>
          </section>
        </div>

        {/* Sidebar Settings Area - Right Column */}
        <div className="space-y-6">
          {/* Section 3: Target Platforms */}
          <section className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-accent" />
              <h3 className="text-lg font-semibold text-foreground">Target Platforms</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Select marketplaces to monitor for this asset.
            </p>
            <div className="space-y-2.5">
              {PLATFORMS.map((p) => {
                const details = PLATFORM_DETAILS[p];
                const Icon = details.icon;
                return (
                  <label
                    key={p}
                    className="flex items-center p-3 rounded-lg border border-border hover:bg-muted/40 cursor-pointer transition-colors select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p)}
                      onChange={() => toggle(p)}
                      className="w-4 h-4 text-accent border-border rounded focus:ring-accent cursor-pointer accent-accent"
                    />
                    <span className="ml-3 font-medium text-foreground flex-1 text-sm">{details.label}</span>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </label>
                );
              })}
            </div>
          </section>

          {/* Summary / Actions */}
          <section className="bg-sidebar text-sidebar-foreground rounded-xl p-6 shadow-sm border border-sidebar-border space-y-6">
            <div>
              <h3 className="text-lg font-bold">Ready to Monitor?</h3>
              <p className="text-sm text-sidebar-foreground/70 mt-1">
                Initial scan takes roughly 5-10 minutes. Results will populate in the Dashboard.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                className="w-full py-3 px-4 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors shadow-sm flex justify-center items-center gap-2 cursor-pointer text-sm font-sans"
              >
                <Radar className="h-4 w-4" />
                Start Monitoring
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/monitoring" })}
                className="w-full py-2.5 px-4 bg-transparent border border-sidebar-foreground/20 text-sidebar-foreground/80 hover:text-sidebar-foreground font-semibold rounded-md hover:bg-white/5 transition-colors flex justify-center items-center text-sm cursor-pointer"
              >
                Save as Draft
              </button>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}
