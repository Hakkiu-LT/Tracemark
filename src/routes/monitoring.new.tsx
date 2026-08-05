import React from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useStore, type Platform } from "@/lib/store";
import { PLATFORMS, PLATFORM_GROUPS } from "@/lib/platforms";
import { PlatformLogo } from "@/components/platform-logo";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { checkBrandFullPipeline, createBrand, getBrands, uploadBrandAsset } from "@/lib/api";
import { toast } from "sonner";
import {
  Info,
  Radar,
  ChevronRight,
  Globe,
  Cpu,
  FileText,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { REGIONS } from "@/lib/regions";

export const Route = createFileRoute("/monitoring/new")({
  head: () => ({
    meta: [
      { title: "Add Asset — HAKKIU" },
      { name: "description", content: "Register a new trademark or brand asset for continuous monitoring." },
    ],
  }),
  component: NewAssetPage,
});

type ScanStep = { label: string; icon: React.ComponentType<{ className?: string }> };


function buildScanSteps(selected: Set<Platform>): ScanStep[] {
  const platformSteps: ScanStep[] = Array.from(selected).flatMap((p) => {
    const config = PLATFORMS.find((pl) => pl.id === p);
    return config ? [{ label: config.stepLabel, icon: config.icon }] : [];
  });
  return [
    ...platformSteps,
    { label: "Analyzing evidence with AI", icon: Cpu },
    { label: "Generating enforcement decision", icon: FileText },
  ];
}

function ScanningModal({ brandName, step, steps }: { brandName: string; step: number; steps: ScanStep[] }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-card rounded-2xl border border-border p-8 w-full max-w-sm mx-4 shadow-2xl">
        {/* Animated radar icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
              <Radar className="h-8 w-8 text-accent animate-spin" style={{ animationDuration: "3s" }} />
            </div>
            <span className="absolute inset-0 rounded-full border-2 border-accent/30 animate-ping" />
          </div>
        </div>

        <h2 className="text-center text-lg font-semibold text-foreground mb-1">
          Scanning <span className="text-accent">"{brandName}"</span>
        </h2>
        <p className="text-center text-sm text-muted-foreground mb-8">
          This takes about 10–20 seconds. Please wait…
        </p>

        <div className="space-y-3">
          {steps.map(({ label, icon: Icon }, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div
                key={i}
                className={`flex items-center gap-3 text-sm transition-opacity duration-300 ${
                  i > step ? "opacity-30" : "opacity-100"
                }`}
              >
                <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 text-accent animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <span className={done ? "text-muted-foreground line-through" : active ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-6 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-700"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function NewAssetPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addMark = useStore((s) => s.addMark);
  const setScanResult = useStore((s) => s.setScanResult);
  const clients = useStore((s) => s.clients);
  const persona = useStore((s) => s.persona);
  const activeClientId = useStore((s) => s.activeClientId);

  const [brandName, setBrandName] = useState("");
  const [regNum, setRegNum] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [website, setWebsite] = useState("");
  const [clientId, setClientId] = useState(activeClientId ?? clients[0]?.id ?? "c1");
  const [selected, setSelected] = useState<Set<Platform>>(new Set([]));
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set(["US"]));
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set(["NA", "EMEA"]));
  const [scanStep, setScanStep] = useState(0);
  const [officialDomains, setOfficialDomains] = useState<string[]>([""]);
  const [officialAdvertisers, setOfficialAdvertisers] = useState<string[]>([""]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);

  const scanSteps = buildScanSteps(selected);

  // Plan limits: cap how many marketplaces/regions a brand can select, and block creating a
  // new brand once the org is at its brand cap. null on any axis = unlimited.
  const { data: brandsData } = useQuery({ queryKey: ["brands"], queryFn: getBrands });
  const platformsLimit = brandsData?.limits?.platforms_per_brand ?? null;
  const regionsLimit = brandsData?.limits?.regions_per_brand ?? null;
  const brandsLimit = brandsData?.usage?.limit ?? null;
  const brandsUsed = brandsData?.usage?.used ?? 0;
  const atBrandLimit = brandsLimit != null && brandsUsed >= brandsLimit;

  function toggle(p: Platform) {
    const next = new Set(selected);
    if (next.has(p)) {
      next.delete(p);
    } else {
      if (platformsLimit != null && next.size >= platformsLimit) {
        toast.error(`Your plan allows up to ${platformsLimit} marketplace(s) per brand.`);
        return;
      }
      next.add(p);
    }
    setSelected(next);
  }

  function toggleRegionExpanded(regKey: string) {
    const next = new Set(expandedRegions);
    next.has(regKey) ? next.delete(regKey) : next.add(regKey);
    setExpandedRegions(next);
  }

  function toggleCountry(code: string) {
    const next = new Set(selectedRegions);
    if (next.has(code)) {
      next.delete(code);
    } else {
      if (regionsLimit != null && next.size >= regionsLimit) {
        toast.error(`Your plan allows up to ${regionsLimit} region(s) per brand.`);
        return;
      }
      next.add(code);
    }
    setSelectedRegions(next);
  }

  function toggleMacroRegion(regKey: string, countryCodes: string[]) {
    const next = new Set(selectedRegions);
    const allSelected = countryCodes.every((c) => next.has(c));
    if (allSelected) {
      countryCodes.forEach((c) => next.delete(c));
    } else {
      let capped = false;
      for (const c of countryCodes) {
        if (next.has(c)) continue;
        if (regionsLimit != null && next.size >= regionsLimit) {
          capped = true;
          break;
        }
        next.add(c);
      }
      if (capped) toast.error(`Your plan allows up to ${regionsLimit} region(s) per brand.`);
    }
    setSelectedRegions(next);
  }

  const apiPlatforms = Array.from(selected)
    .map((p) => PLATFORMS.find((pl) => pl.id === p)?.apiKey)
    .filter((p): p is string => Boolean(p));

  const { mutate: runScan, isPending } = useMutation({
    // Persist the brand server-side, then run the scan pipeline.
    mutationFn: async () => {
      let cleanWebsite = website.trim();
      if (cleanWebsite && !/^https?:\/\//.test(cleanWebsite)) {
        cleanWebsite = `https://${cleanWebsite}`;
      }
      const brand = await createBrand({
        brand_name: brandName,
        website: cleanWebsite || null,
        registration_number: regNum || null,
        platforms: apiPlatforms,
        target_regions: Array.from(selectedRegions),
        logo_color: "oklch(0.58 0.18 255)",
        client_id: persona === "law_firm" ? clientId : null,
        official_domains: officialDomains.filter((d) => d.trim()),
        official_advertisers: officialAdvertisers.filter((a) => a.trim()),
      });

      if (logoFile) {
        await uploadBrandAsset(brand.id, "logo", logoFile);
      }
      if (productFile) {
        await uploadBrandAsset(brand.id, "product_image", productFile);
      }

      return checkBrandFullPipeline({
        brand_name: brandName,
        platforms: apiPlatforms.length > 0 ? apiPlatforms : ["amazon", "google_ads", "domains"],
        target_regions: Array.from(selectedRegions),
        client_id: persona === "law_firm" ? clientId : undefined,
        official_domains: officialDomains.filter((d) => d.trim()),
        official_advertisers: officialAdvertisers.filter((a) => a.trim()),
      });
    },
    onSuccess: (data) => {
      let cleanWebsite = website.trim();
      if (!cleanWebsite.startsWith("http://") && !cleanWebsite.startsWith("https://")) {
        cleanWebsite = `https://${cleanWebsite}`;
      }
      addMark({
        brandName,
        registrationNumber: regNum || "Pending",
        website: cleanWebsite.replace(/^https?:\/\//, ""),
        clientId: persona === "law_firm" ? clientId : "",
        platforms: Array.from(selected),
        logoColor: "oklch(0.58 0.18 255)",
        targetRegions: Array.from(selectedRegions),
      });
      if (data.case_id) {
        setScanResult(data.case_id, data);
        queryClient.invalidateQueries({ queryKey: ["brands"] });
        toast.success("Scan completed successfully");
        navigate({ to: "/monitoring/$caseId", params: { caseId: data.case_id } });
      } else {
        queryClient.invalidateQueries({ queryKey: ["brands"] });
        toast.info(`"${brandName}" scan complete: No copycats found.`);
        navigate({ to: "/monitoring" });
      }
    },
    onError: (err: Error) => {
      console.error(err);
      // Surface the server's plan-limit message (403s carry a specific detail) instead of a
      // generic error, so the customer knows WHY monitoring didn't start.
      toast.error(err?.message || "Couldn't start monitoring. Please try again.");
    },
  });

  useEffect(() => {
    if (!isPending) { setScanStep(0); return; }
    const interval = setInterval(() => {
      setScanStep((s) => Math.min(s + 1, scanSteps.length - 1));
    }, 2000);
    return () => clearInterval(interval);
  }, [isPending]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (atBrandLimit) {
      toast.error("You've reached your plan's brand limit. Contact HAKKIU to add more.");
      return;
    }
    if (!brandName) { toast.error("Brand name is required."); return; }
    runScan();
  }

  return (
    <>
      {isPending && <ScanningModal brandName={brandName} step={scanStep} steps={scanSteps} />}

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
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Brand Logo
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Upload your brand logo for visual similarity comparison. Compressed automatically.
                </p>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="logoUpload"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-dashed border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer text-sm text-muted-foreground"
                  >
                    {logoFile ? (
                      <>
                        <ImageIcon className="h-4 w-4 text-accent" />
                        <span className="text-foreground font-medium truncate max-w-[180px]">{logoFile.name}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>Choose file...</span>
                      </>
                    )}
                  </label>
                  <input
                    type="file"
                    id="logoUpload"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setLogoFile(file);
                    }}
                  />
                  {logoFile && (
                    <button
                      type="button"
                      onClick={() => setLogoFile(null)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Product Image Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Product Image (optional)
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Upload your product photo. Used to compare against scraped images.
                </p>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="productUpload"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-dashed border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer text-sm text-muted-foreground"
                  >
                    {productFile ? (
                      <>
                        <ImageIcon className="h-4 w-4 text-accent" />
                        <span className="text-foreground font-medium truncate max-w-[180px]">{productFile.name}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>Choose file...</span>
                      </>
                    )}
                  </label>
                  <input
                    type="file"
                    id="productUpload"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setProductFile(file);
                    }}
                  />
                  {productFile && (
                    <button
                      type="button"
                      onClick={() => setProductFile(null)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Official Domains Whitelist */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Official Domains
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  List your brand's official domains. Listings, ads, or links pointing to these will be whitelisted.
                </p>
                <div className="space-y-2">
                  {officialDomains.map((domain, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={domain}
                        onChange={(e) => {
                          const next = [...officialDomains];
                          next[i] = e.target.value;
                          setOfficialDomains(next);
                        }}
                        placeholder="e.g., derila.com"
                        className="flex-1 px-3 py-2 rounded-md border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground bg-background transition-colors"
                      />
                      {officialDomains.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setOfficialDomains(officialDomains.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setOfficialDomains([...officialDomains, ""])}
                    className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add another domain
                  </button>
                </div>
              </div>

              {/* Official Advertisers Whitelist */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Official Advertisers
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  List official advertiser names so their ads are not flagged as hijacking.
                </p>
                <div className="space-y-2">
                  {officialAdvertisers.map((advertiser, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={advertiser}
                        onChange={(e) => {
                          const next = [...officialAdvertisers];
                          next[i] = e.target.value;
                          setOfficialAdvertisers(next);
                        }}
                        placeholder="e.g., Derila Official"
                        className="flex-1 px-3 py-2 rounded-md border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground bg-background transition-colors"
                      />
                      {officialAdvertisers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setOfficialAdvertisers(officialAdvertisers.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setOfficialAdvertisers([...officialAdvertisers, ""])}
                    className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add another advertiser
                  </button>
                </div>
              </div>
            </section>

            {/* Target Platforms */}
            <section className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-accent" />
                  <h3 className="text-lg font-semibold text-foreground">Target Platforms</h3>
                </div>
                {platformsLimit != null && (
                  <span className={`text-xs font-medium ${selected.size >= platformsLimit ? "text-destructive" : "text-muted-foreground"}`}>
                    {selected.size} / {platformsLimit} selected
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Select platforms to monitor for this asset.{platformsLimit != null && ` Your plan allows up to ${platformsLimit} per brand.`}
              </p>
              <div className="space-y-4">
                {PLATFORM_GROUPS.map(({ key, label: groupLabel }) => {
                  const group = PLATFORMS.filter((p) => p.category === key);
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0">{groupLabel}</p>
                        <hr className="flex-1 border-border" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {group.map(({ id, label }) => {
                          const active = selected.has(id);
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => toggle(id)}
                              className={`flex items-center gap-2 p-3 rounded-lg border transition-colors select-none cursor-pointer w-full ${
                                active
                                  ? "border-accent bg-accent/10 text-accent"
                                  : "border-border hover:bg-muted/40 text-muted-foreground"
                              }`}
                            >
                              <PlatformLogo platform={id} className="h-6 w-6" imgClassName="p-1" />
                              <span className={`font-medium text-sm truncate flex-1 text-left ${active ? "text-accent" : "text-foreground"}`}>{label}</span>
                              {active && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Target Regions & Proxy Location Management */}
            <section className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-accent" />
                  <h3 className="text-lg font-semibold text-foreground">Target Regions & Proxy Location Management</h3>
                </div>
                {regionsLimit != null && (
                  <span className={`text-xs font-medium ${selectedRegions.size >= regionsLimit ? "text-destructive" : "text-muted-foreground"}`}>
                    {selectedRegions.size} / {regionsLimit} selected
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Route regional scans through local proxies to bypass geoblocking and capture location-specific infringements.{regionsLimit != null && ` Your plan allows up to ${regionsLimit} region(s) per brand.`}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {REGIONS.map((reg) => {
                  const regCountries = reg.countries.map((c) => c.code);
                  const isSelected = reg.countries.every((c) => selectedRegions.has(c.code));

                  return (
                    <button
                      key={reg.key}
                      type="button"
                      onClick={() => toggleMacroRegion(reg.key, regCountries)}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? "border-accent bg-accent/10 shadow-sm"
                          : "border-border/80 bg-background/60 hover:bg-muted/40 hover:border-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent accent-accent cursor-pointer"
                        />
                        <div>
                          <span className="font-semibold text-sm text-foreground block">{reg.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {isSelected ? "Active for proxy scraping" : "Click to activate region"}
                          </span>
                        </div>
                      </div>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Geo-proxy tooltip */}
              <div className="flex gap-2 p-3 bg-accent/5 rounded-lg border border-accent/20 text-xs text-muted-foreground mt-4 leading-relaxed">
                <Info className="h-4.5 w-4.5 text-accent shrink-0 mt-0.5" />
                <span>
                  <strong>Scanning Logic:</strong> Selecting a target region routes automated scans through secure residential proxies physically located within that region. This ensures correct localization and captures geotargeted storefront clones or search ads.
                </span>
              </div>
            </section>
          </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-6">
            <section className="bg-sidebar text-sidebar-foreground rounded-xl p-6 border border-sidebar-border space-y-6">
              <div>
                <h3 className="text-lg font-bold">Ready to Monitor?</h3>
                <p className="text-sm text-sidebar-foreground/70 mt-1">
                  Initial scan takes roughly 5-10 minutes. Results will populate in the Dashboard.
                </p>
              </div>

              {/* Plan usage — reflects the org's brand cap so customers stay within plan. */}
              {brandsLimit != null && (
                <div className={`rounded-lg border p-3 text-sm ${atBrandLimit ? "border-red-400/40 bg-red-500/10" : "border-sidebar-border bg-white/5"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sidebar-foreground/70">Brands used</span>
                    <span className="font-semibold tabular-nums">{brandsUsed} / {brandsLimit}</span>
                  </div>
                  {atBrandLimit && (
                    <p className="mt-1 text-xs text-red-300">
                      You've reached your plan's brand limit. Contact HAKKIU to add more.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isPending || atBrandLimit}
                  title={atBrandLimit ? "Your plan's brand limit has been reached" : undefined}
                  className="w-full py-3 px-4 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors shadow-sm flex justify-center items-center gap-2 cursor-pointer text-sm font-sans disabled:opacity-60 disabled:cursor-not-allowed"
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
    </>
  );
}
