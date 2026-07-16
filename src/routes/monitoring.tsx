import React, { useState, useEffect } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useScopedMarks,
  useStore,
  type Mark,
  type Infringement,
  type Platform,
  type RiskLevel,
} from "@/lib/store";
import { Plus, Radar, Trash2, Play, Pause, EyeOff, Pencil, Globe, Info, ChevronDown, ChevronUp, X, Upload, Image as ImageIcon, FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { checkBrandFullPipeline, apiFetch, updateBrand, uploadBrandAsset, listBrandAssets, deleteBrandAsset, getBrands, createBrand, refreshReferenceContent, type BrandAsset } from "@/lib/api";
import { PLATFORMS } from "@/lib/platforms";
import { REGIONS, COUNTRY_BY_CODE } from "@/lib/regions";

export const Route = createFileRoute("/monitoring")({
  head: () => ({
    meta: [
      { title: "Monitoring — Tracemark" },
      {
        name: "description",
        content: "Manage the trademarks and brand assets Tracemark scans across the web.",
      },
    ],
  }),
  component: MonitoringLayout,
});

const ALL_PLATFORMS: { id: Platform; label: string }[] = [
  { id: "Amazon", label: "Amazon" },
  { id: "Shopify", label: "Shopify" },
  { id: "eBay", label: "eBay" },
  { id: "AliExpress", label: "AliExpress" },
  { id: "Alibaba", label: "Alibaba" },
  { id: "Etsy", label: "Etsy" },
  { id: "Facebook Marketplace", label: "FB Marketplace" },
  { id: "Web Domain", label: "Web Domain" },
  { id: "Instagram", label: "Instagram" },
  { id: "TikTok", label: "TikTok" },
  { id: "Google", label: "Google" },
  { id: "Meta", label: "Meta" },
];

function MonitoringLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  if (pathname !== "/monitoring") return <Outlet />;
  return <MonitoringPage />;
}

function MonitoringPage() {
  const scopedMarks = useScopedMarks();
  const infringements = useStore((s) => s.infringements);
  const hydrated = useStore((s) => s.hydrated);
  const persona = useStore((s) => s.persona);
  const clients = useStore((s) => s.clients);
  const removeMark = useStore((s) => s.removeMark);
  const restoreMark = useStore((s) => s.restoreMark);
  const toggleMarkStatus = useStore((s) => s.toggleMarkStatus);
  const updateMark = useStore((s) => s.updateMark);
  const addInfringement = useStore((s) => s.addInfringement);
  const setScanResult = useStore((s) => s.setScanResult);

  // Track active AbortControllers and toast IDs by mark ID
  const activeScansRef = React.useRef<
    Map<string, { controller: AbortController; toastId: string | number }>
  >(new Map());
  // Track scheduled timeouts by mark ID
  const timeoutsRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Edit states
  const [editingMark, setEditingMark] = useState<Mark | null>(null);
  const [editBrandName, setEditBrandName] = useState("");
  const [editRegNum, setEditRegNum] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editPlatforms, setEditPlatforms] = useState<Set<Platform>>(new Set());
  const [editRepeatCycle, setEditRepeatCycle] = useState("");
  const [editSelectedRegions, setEditSelectedRegions] = useState<Set<string>>(new Set());
  const [editOfficialDomains, setEditOfficialDomains] = useState<string[]>([""]);
  const [editOfficialAdvertisers, setEditOfficialAdvertisers] = useState<string[]>([""]);
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editExistingLogos, setEditExistingLogos] = useState<BrandAsset[]>([]);
  const [editAutoRef, setEditAutoRef] = useState<BrandAsset | null>(null);
  const [refRefreshing, setRefRefreshing] = useState(false);
  const [editExistingProducts, setEditExistingProducts] = useState<BrandAsset[]>([]);
  const [editProductFile, setEditProductFile] = useState<File | null>(null);
  const [editRealBrandId, setEditRealBrandId] = useState<string | null>(null);
  const [editExpandedRegions, setEditExpandedRegions] = useState<Set<string>>(new Set(["NA", "EMEA"]));

  const isRepeatCycleInvalid = editRepeatCycle !== "" && !/^\d+$/.test(editRepeatCycle);

  useEffect(() => {
    if (editingMark) {
      setEditBrandName(editingMark.brandName);
      setEditRegNum(editingMark.registrationNumber);
      setEditWebsite(editingMark.website);
      setEditClientId(editingMark.clientId);
      setEditPlatforms(
        new Set(
          editingMark.platforms.filter((p) =>
            ALL_PLATFORMS.some((ap) => ap.id === p),
          ),
        ),
      );
      setEditRepeatCycle(
        editingMark.repeatCycle !== undefined && editingMark.repeatCycle !== null
          ? String(editingMark.repeatCycle)
          : "",
      );
      setEditSelectedRegions(new Set(editingMark.targetRegions || ["US"]));
      setEditOfficialDomains(
        editingMark.officialDomains && editingMark.officialDomains.length > 0
          ? [...editingMark.officialDomains, ""]
          : [""],
      );
      setEditOfficialAdvertisers(
        editingMark.officialAdvertisers && editingMark.officialAdvertisers.length > 0
          ? [...editingMark.officialAdvertisers, ""]
          : [""],
      );
      setEditLogoFile(null);
      setEditProductFile(null);
      setEditRealBrandId(null);
      setEditAutoRef(null);

      // The Zustand `Mark` uses a local-generated id ("m1234567890") that does
      // not exist in the backend `brands` table. Look up the real DB record
      // by brand name before loading assets or making any backend calls.
      getBrands()
        .then((res) => {
          const realBrand = res.brands.find(
            (b) => b.brand_name === editingMark.brandName,
          );
          if (!realBrand) {
            setEditExistingLogos([]);
            setEditAutoRef(null);
            setEditExistingProducts([]);
            return null;
          }
          setEditRealBrandId(realBrand.id);
          return listBrandAssets(realBrand.id);
        })
        .then((assets) => {
          if (!assets) return;
          setEditExistingLogos(assets.filter((a) => a.asset_type === "logo"));
          const autoRefs = assets.filter(
            (a) => a.asset_type === "reference_content"
              && (a.metadata as { auto_generated?: boolean } | null)?.auto_generated === true,
          );
          setEditAutoRef(autoRefs.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )[0] || null);
          setEditExistingProducts(assets.filter((a) => a.asset_type === "product_image"));
        })
        .catch(() => {
          setEditExistingLogos([]);
          setEditAutoRef(null);
          setEditExistingProducts([]);
        });
    }
  }, [editingMark]);

  useEffect(() => {
    return () => {
      // Abort all active scans on unmount to avoid memory leaks
      activeScansRef.current.forEach((scan) => {
        scan.controller.abort();
        toast.dismiss(scan.toastId);
      });
      activeScansRef.current.clear();

      timeoutsRef.current.forEach((timer) => {
        clearTimeout(timer);
      });
      timeoutsRef.current.clear();
    };
  }, []);

  const activeMarks = scopedMarks.filter((m) => m.status !== "on_hold");
  const onHoldMarks = scopedMarks.filter((m) => m.status === "on_hold");

  const handleRemove = (m: Mark) => {
    const markToDelete = m;
    const infringementsToDelete = infringements.filter((i) => i.markId === m.id);
    removeMark(m.id);
    toast(`Deleted ${m.brandName}`, {
      description: "Undo is available for 5 seconds.",
      action: {
        label: "Undo",
        onClick: () => {
          restoreMark(markToDelete, infringementsToDelete);
          toast.success(`Restored ${markToDelete.brandName}`);
        },
      },
      duration: 5000,
    });
  };

  const runScanCycle = async (id: string) => {
    const mark = useStore.getState().marks.find((m) => m.id === id);
    if (!mark || mark.status === "on_hold") return;

    const controller = new AbortController();
    const toastId = toast.loading(`Scanning the web for ${mark.brandName}...`);
    activeScansRef.current.set(id, { controller, toastId });

    const apiPlatforms = mark.platforms
      .map((p) => PLATFORMS.find((pl) => pl.id === p)?.apiKey)
      .filter((p): p is string => Boolean(p));

    try {
      const result = await checkBrandFullPipeline(
        {
          brand_name: mark.brandName,
          platforms: apiPlatforms.length > 0 ? apiPlatforms : undefined,
          target_regions: mark.targetRegions,
          client_id: mark.clientId || undefined,
        },
        controller.signal,
      );

      activeScansRef.current.delete(id);

      const hasRisk =
        result.decision &&
        (result.decision.risk_level === "HIGH" || result.decision.risk_level === "MEDIUM");
      if (
        hasRisk &&
        result.decision &&
        (result.evidence.marketplaces.length > 0 ||
          result.evidence.domains.length > 0 ||
          result.evidence.ads.length > 0)
      ) {
        let platform: Platform = "Web Domain";
        let copycatUrl = "";
        let copycatName = "";
        let screenshot = undefined;
        let price = "Unknown";

        if (result.evidence.marketplaces.length > 0) {
          const ev = result.evidence.marketplaces[0];
          platform = ev.platform.toLowerCase().includes("amazon")
            ? "Amazon"
            : ev.platform.toLowerCase().includes("ebay")
              ? "eBay"
              : "AliExpress";
          copycatUrl = ev.listing_url;
          copycatName = ev.seller_name;
          screenshot = ev.screenshot_url ?? undefined;
          if (ev.price) price = ev.price;
        } else if (result.evidence.domains.length > 0) {
          platform = "Web Domain";
          copycatUrl = result.evidence.domains[0].domain_name;
          copycatName = result.evidence.domains[0].registrar || "Unknown";
          screenshot = result.evidence.domains[0].screenshot_url ?? undefined;
        } else if (result.evidence.ads.length > 0) {
          platform = "Google";
          copycatUrl = result.evidence.ads[0].destination_url;
          copycatName = "Unauthorized Ad";
          screenshot = result.evidence.ads[0].screenshot_url ?? undefined;
        }

        addInfringement({
          markId: mark.id,
          clientId: mark.clientId,
          brandName: mark.brandName,
          risk: result.decision.risk_level.toLowerCase() as RiskLevel,
          platform,
          status: "active",
          infringer: {
            seller: copycatName,
            storeUrl: copycatUrl,
            country: "Unknown",
            contact: "Unknown",
            ip: "—",
          },
          evidence: {
            url: copycatUrl,
            timestamp: new Date().toISOString(),
            userAgent: "Tracemark Scanner",
            method: "Automated Scraping",
            screenshot_url: screenshot,
          },
          analysis: {
            confidence: Math.round(result.decision.confidence_score * 100),
            logoMatch: 0,
            nameMatch: 0,
            category: "Trademark Infringement",
            rationale: result.decision.case_summary,
          },
          thumbnail: screenshot || mark.logoColor,
          title: `Suspicious ${mark.brandName} Listing`,
          price,
        });

        if (result.case_id) {
          setScanResult(result.case_id, result);
        }
        toast.success(`Copycat found for ${mark.brandName}! New case created.`, {
          id: toastId,
          duration: 1000,
        });
      } else {
        toast.error("No cats found", {
          id: toastId,
          duration: 1000,
          style: {
            border: "2px solid #ef4444",
            backgroundColor: "#fef2f2",
            color: "#991b1b",
          },
        });
      }

      scheduleRepeatIfConfigured(id);
    } catch (e: any) {
      activeScansRef.current.delete(id);
      if (e.name === "AbortError" || e.message?.includes("aborted")) {
        console.log(`Scan for ${mark.brandName} aborted.`);
        return;
      }
      console.error("Scan failed:", e);
      toast.error(`Scan failed for ${mark.brandName}.`, { id: toastId, duration: 1000 });

      scheduleRepeatIfConfigured(id);
    }
  };

  const scheduleRepeatIfConfigured = (id: string) => {
    const mark = useStore.getState().marks.find((m) => m.id === id);
    if (mark && mark.status !== "on_hold" && mark.repeatCycle) {
      const minutes = mark.repeatCycle;
      toast.info(
        `Next scan for ${mark.brandName} scheduled in ${minutes} minute${minutes > 1 ? "s" : ""}.`,
      );
      const timer = setTimeout(() => {
        timeoutsRef.current.delete(id);
        runScanCycle(id);
      }, minutes * 60_000);
      timeoutsRef.current.set(id, timer);
    }
  };

  const handleToggleStatus = async (id: string) => {
    const mark = scopedMarks.find((m) => m.id === id);
    if (!mark) return;

    // Toggle first so UI reflects
    toggleMarkStatus(id);

    // Signal resource monitor: start when first mark goes active, stop when last goes on_hold
    const updatedMarks = useStore.getState().marks;
    const activeCount = updatedMarks.filter((m) => m.status === "active").length;
    apiFetch("/admin/resources/status", {
      method: "POST",
      body: JSON.stringify({ active: activeCount > 0 }),
    }).catch(() => { }); // fire-and-forget, non-critical

    // If it was on_hold, it is now active -> trigger scan
    if (mark.status === "on_hold") {
      const existingTimeout = timeoutsRef.current.get(id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        timeoutsRef.current.delete(id);
      }
      runScanCycle(id);
    } else {
      // It was active, now it is paused (on_hold)
      const activeScan = activeScansRef.current.get(id);
      if (activeScan) {
        activeScan.controller.abort();
        toast.dismiss(activeScan.toastId);
        activeScansRef.current.delete(id);
      }
      const existingTimeout = timeoutsRef.current.get(id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        timeoutsRef.current.delete(id);
      }
      toast.success("Monitoring stopped", { duration: 1000 });
    }
  };

  const handleDeleteAsset = async (asset: BrandAsset) => {
    if (!editingMark || !editRealBrandId) return;
    try {
      await deleteBrandAsset(editRealBrandId, asset.id);
      setEditExistingLogos((prev) => prev.filter((a) => a.id !== asset.id));
      setEditExistingProducts((prev) => prev.filter((a) => a.id !== asset.id));
      toast.success("Asset removed.");
    } catch (err) {
      toast.error("Failed to remove asset", { description: (err as Error).message });
    }
  };

  const handleRefreshRef = async () => {
    if (!editRealBrandId) return;
    setRefRefreshing(true);
    try {
      const res = await refreshReferenceContent(editRealBrandId);
      if (res.refreshed) {
        toast.success("Reference content refreshed.");
        const assets = await listBrandAssets(editRealBrandId);
        const autoRefs = (assets || []).filter(
          (a) => a.asset_type === "reference_content"
            && (a.metadata as { auto_generated?: boolean } | null)?.auto_generated === true,
        );
        setEditAutoRef(
          autoRefs.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )[0] || null,
        );
      } else {
        toast.info(res.message || "No official website configured yet.");
      }
    } catch (err) {
      toast.error("Failed to refresh reference content", { description: (err as Error).message });
    } finally {
      setRefRefreshing(false);
    }
  };

  const handleSave = async () => {
    if (!editingMark) return;
    if (!editBrandName.trim()) {
      toast.error("Brand name is required.");
      return;
    }
    if (isRepeatCycleInvalid) {
      toast.error("Invalid parameter");
      return;
    }
    const repeatCycleNum = editRepeatCycle.trim()
      ? parseInt(editRepeatCycle.trim(), 10)
      : undefined;

    const cleanOfficialDomains = editOfficialDomains.filter((d) => d.trim());
    const cleanOfficialAdvertisers = editOfficialAdvertisers.filter((a) => a.trim());

    let realBrandId = editRealBrandId;
    if (!realBrandId) {
      try {
        const brandsRes = await getBrands();
        const existing = brandsRes.brands.find(
          (b) => b.brand_name === editingMark.brandName,
        );
        if (existing) {
          realBrandId = existing.id;
          setEditRealBrandId(existing.id);
        } else {
          const cleanWebsite = editWebsite.trim()
            ? (editWebsite.startsWith("http") ? editWebsite : `https://${editWebsite}`)
            : null;
          const created = await createBrand({
            brand_name: editBrandName.trim(),
            website: cleanWebsite,
            registration_number: editRegNum.trim() || null,
            platforms: Array.from(editPlatforms),
            target_regions: Array.from(editSelectedRegions),
            logo_color: "oklch(0.58 0.18 255)",
            client_id: persona === "law_firm" ? editClientId : null,
            official_domains: cleanOfficialDomains,
            official_advertisers: cleanOfficialAdvertisers,
          });
          realBrandId = created.id;
          setEditRealBrandId(created.id);
        }
      } catch (err) {
        toast.error("Could not resolve brand — try again.", {
          description: (err as Error).message,
        });
        return;
      }
    }

    try {
      await updateBrand(realBrandId, {
        brand_name: editBrandName.trim(),
        registration_number: editRegNum.trim() || null,
        website: editWebsite.trim() || null,
        platforms: Array.from(editPlatforms),
        target_regions: Array.from(editSelectedRegions),
        official_domains: cleanOfficialDomains,
        official_advertisers: cleanOfficialAdvertisers,
      });

      if (editLogoFile) {
        await uploadBrandAsset(realBrandId, "logo", editLogoFile);
      }
      if (editProductFile) {
        await uploadBrandAsset(realBrandId, "product_image", editProductFile);
      }
    } catch (err) {
      toast.error("Failed to update brand", { description: (err as Error).message });
      return;
    }

    updateMark(editingMark.id, {
      brandName: editBrandName.trim(),
      registrationNumber: editRegNum.trim(),
      website: editWebsite.trim(),
      clientId: editClientId,
      platforms: Array.from(editPlatforms),
      repeatCycle: repeatCycleNum,
      targetRegions: Array.from(editSelectedRegions),
      officialDomains: cleanOfficialDomains,
      officialAdvertisers: cleanOfficialAdvertisers,
    });
    setEditingMark(null);
    toast.success("Monitored asset updated successfully.");

    if (editingMark.status !== "on_hold") {
      const existingTimeout = timeoutsRef.current.get(editingMark.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        timeoutsRef.current.delete(editingMark.id);
      }
      if (repeatCycleNum) {
        const ms = repeatCycleNum * 60 * 1000;
        const timer = setTimeout(() => {
          timeoutsRef.current.delete(editingMark.id);
          runScanCycle(editingMark.id);
        }, ms);
        timeoutsRef.current.set(editingMark.id, timer);
      }
    }
  };

  function toggleEditCountry(code: string) {
    const next = new Set(editSelectedRegions);
    next.has(code) ? next.delete(code) : next.add(code);
    setEditSelectedRegions(next);
  }

  function toggleEditMacroRegion(regKey: string, countryCodes: string[]) {
    const next = new Set(editSelectedRegions);
    const allSelected = countryCodes.every((c) => next.has(c));
    if (allSelected) {
      countryCodes.forEach((c) => next.delete(c));
    } else {
      countryCodes.forEach((c) => next.add(c));
    }
    setEditSelectedRegions(next);
  }

  function toggleEditRegionExpanded(regKey: string) {
    const next = new Set(editExpandedRegions);
    next.has(regKey) ? next.delete(regKey) : next.add(regKey);
    setEditExpandedRegions(next);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monitored assets</h1>
          <p className="text-sm text-muted-foreground">
            Brands, trademarks, and product lines under active surveillance.
          </p>
        </div>
        <Button asChild>
          <Link to="/monitoring/new">
            <Plus className="mr-1 h-4 w-4" /> Add asset
          </Link>
        </Button>
      </div>

      {!hydrated ? (
        <Card>
          <CardContent className="py-20 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active Monitoring Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Radar className="h-4 w-4 text-accent animate-pulse" />
                Active monitoring ({activeMarks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <MarksTable
                marks={activeMarks}
                infringements={infringements}
                onToggleStatus={handleToggleStatus}
                onEdit={setEditingMark}
                onRemove={handleRemove}
                isActiveSection={true}
              />
            </CardContent>
          </Card>

          {/* On Hold Card */}
          <Card className="opacity-80 hover:opacity-100 transition-opacity">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
                <EyeOff className="h-4 w-4 text-muted-foreground" />
                On hold ({onHoldMarks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <MarksTable
                marks={onHoldMarks}
                infringements={infringements}
                onToggleStatus={handleToggleStatus}
                onEdit={setEditingMark}
                onRemove={handleRemove}
                isActiveSection={false}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Dialog Modal */}
      <Dialog open={!!editingMark} onOpenChange={(open) => !open && setEditingMark(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Monitored Asset</DialogTitle>
            <DialogDescription>
              Update the settings and target platforms for this brand mark.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-3 max-h-[55vh] overflow-y-auto border-b border-border/20 pb-6 mb-2">
            {persona === "law_firm" && (
              <div className="space-y-2">
                <Label htmlFor="edit-client">Client</Label>
                <select
                  id="edit-client"
                  value={editClientId}
                  onChange={(e) => setEditClientId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm outline-none focus:ring-1 focus:ring-accent"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-brandName">Brand / Mark Name</Label>
              <Input
                id="edit-brandName"
                value={editBrandName}
                onChange={(e) => setEditBrandName(e.target.value)}
                placeholder="e.g. Derila"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-regNum">Registration Number</Label>
              <Input
                id="edit-regNum"
                value={editRegNum}
                onChange={(e) => setEditRegNum(e.target.value)}
                placeholder="e.g. US-89234112"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-website">Website</Label>
              <Input
                id="edit-website"
                value={editWebsite}
                onChange={(e) => setEditWebsite(e.target.value)}
                placeholder="e.g. derila.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-repeatCycle">Repeat Cycle (Minutes)</Label>
              <Input
                id="edit-repeatCycle"
                type="text"
                value={editRepeatCycle}
                onChange={(e) => setEditRepeatCycle(e.target.value)}
                placeholder="e.g. 60 (minutes between scans)"
                className={
                  isRepeatCycleInvalid
                    ? "border-red-500 focus-visible:ring-red-500 text-red-500"
                    : ""
                }
              />
              {isRepeatCycleInvalid && (
                <p className="text-xs text-red-500 font-medium">Invalid parameter</p>
              )}
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Brand Logo</Label>
              <p className="text-xs text-muted-foreground">
                Upload your brand logo for visual similarity comparison. Compressed automatically.
              </p>
              {editExistingLogos.length > 0 && (
                <div className="space-y-1.5">
                  {editExistingLogos.map((asset) => {
                    const filename =
                      (asset.metadata as { filename?: string } | null)?.filename ??
                      asset.id.slice(0, 8);
                    return (
                      <div
                        key={asset.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 text-xs"
                      >
                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate text-foreground">{filename}</span>
                        <span className="text-muted-foreground font-mono">
                          {new Date(asset.created_at).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset(asset)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                          title="Remove this logo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-3">
                <label
                  htmlFor="edit-logoUpload"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-dashed border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer text-sm text-muted-foreground"
                >
                  {editLogoFile ? (
                    <>
                      <ImageIcon className="h-4 w-4 text-accent" />
                      <span className="text-foreground font-medium truncate max-w-[180px]">{editLogoFile.name}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>{editExistingLogos.length > 0 ? "Replace or add..." : "Choose file..."}</span>
                    </>
                  )}
                </label>
                <input
                  type="file"
                  id="edit-logoUpload"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setEditLogoFile(file);
                  }}
                />
                {editLogoFile && (
                  <button
                    type="button"
                    onClick={() => setEditLogoFile(null)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Auto-fetched Reference Content (read-only) */}
            <div className="space-y-2">
              <Label>Reference Content</Label>
              <p className="text-xs text-muted-foreground">
                Auto-fetched from your official websites. Cached for 30 days.
              </p>
              {editAutoRef ? (
                <div className="px-3 py-2.5 rounded-md border border-border bg-muted/30 text-xs space-y-1.5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate text-foreground font-mono">
                      {((editAutoRef.metadata as { source_urls?: string[] } | null)?.source_urls || [editAutoRef.file_url])
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>
                      Last fetched: {new Date(editAutoRef.created_at).toLocaleString()}
                    </span>
                    <span>•</span>
                    <span>
                      {((editAutoRef.metadata as { text_length?: number } | null)?.text_length ?? 0).toLocaleString()} chars
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefreshRef}
                    disabled={refRefreshing}
                    className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {refRefreshing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh now
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic px-3 py-2 rounded-md border border-dashed border-border">
                  No auto-generated reference content yet. It will be fetched on the first scan, or you can click "Refresh now" once an official website is configured.
                </p>
              )}
            </div>

            {/* Product Image Upload */}
            <div className="space-y-2">
              <Label>Product Images (optional)</Label>
              <p className="text-xs text-muted-foreground">
                Upload your product photos. Used to compare against scraped images.
              </p>
              {editExistingProducts.length > 0 && (
                <div className="space-y-1.5">
                  {editExistingProducts.map((asset) => {
                    const filename =
                      (asset.metadata as { filename?: string } | null)?.filename ??
                      asset.id.slice(0, 8);
                    return (
                      <div
                        key={asset.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 text-xs"
                      >
                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate text-foreground">{filename}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset(asset)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                          title="Remove this product image"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-3">
                <label
                  htmlFor="edit-productUpload"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-dashed border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer text-sm text-muted-foreground"
                >
                  {editProductFile ? (
                    <span className="text-foreground font-medium truncate max-w-[180px]">{editProductFile.name}</span>
                  ) : (
                    <span>{editExistingProducts.length > 0 ? "Add more..." : "Choose file..."}</span>
                  )}
                </label>
                <input
                  type="file"
                  id="edit-productUpload"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => setEditProductFile(e.target.files?.[0] ?? null)}
                />
                {editProductFile && (
                  <button
                    type="button"
                    onClick={() => setEditProductFile(null)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Official Domains Whitelist */}
            <div className="space-y-2">
              <Label>Official Domains</Label>
              <p className="text-xs text-muted-foreground">
                Whitelist brand domains so their listings and ads are not flagged.
              </p>
              <div className="space-y-2">
                {editOfficialDomains.map((domain, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={domain}
                      onChange={(e) => {
                        const next = [...editOfficialDomains];
                        next[i] = e.target.value;
                        setEditOfficialDomains(next);
                      }}
                      placeholder="e.g., derila.com"
                    />
                    {editOfficialDomains.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditOfficialDomains(editOfficialDomains.filter((_, idx) => idx !== i))
                        }
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setEditOfficialDomains([...editOfficialDomains, ""])}
                  className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another domain
                </button>
              </div>
            </div>

            {/* Official Advertisers Whitelist */}
            <div className="space-y-2">
              <Label>Official Advertisers</Label>
              <p className="text-xs text-muted-foreground">
                Whitelist official advertiser names so their ads are not flagged as hijacking.
              </p>
              <div className="space-y-2">
                {editOfficialAdvertisers.map((advertiser, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={advertiser}
                      onChange={(e) => {
                        const next = [...editOfficialAdvertisers];
                        next[i] = e.target.value;
                        setEditOfficialAdvertisers(next);
                      }}
                      placeholder="e.g., Derila Official"
                    />
                    {editOfficialAdvertisers.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditOfficialAdvertisers(
                            editOfficialAdvertisers.filter((_, idx) => idx !== i),
                          )
                        }
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setEditOfficialAdvertisers([...editOfficialAdvertisers, ""])}
                  className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another advertiser
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Target Platforms</Label>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {ALL_PLATFORMS.map(({ id, label }) => {
                  const active = editPlatforms.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        const next = new Set(editPlatforms);
                        if (next.has(id)) {
                          next.delete(id);
                        } else {
                          next.add(id);
                        }
                        setEditPlatforms(next);
                      }}
                      className={`flex items-center justify-between p-2 rounded-md border text-left cursor-pointer transition-colors text-xs select-none ${active
                          ? "border-accent bg-accent/10 text-accent font-medium"
                          : "border-border hover:bg-muted/50 text-muted-foreground"
                        }`}
                    >
                      <span>{label}</span>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Regions & Proxy Location Management */}
            <div className="space-y-2 pt-2 pb-6">
              <div className="flex items-center gap-1.5">
                <Label>Target Regions & Proxy Locations</Label>
                <div className="group relative">
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded bg-popover border border-border p-2 text-[10px] text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 leading-normal">
                    Selecting regions routes regional scans through local residential proxies.
                  </div>
                </div>
              </div>
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 border border-border rounded-md p-2 pb-4 bg-muted/10">
                {REGIONS.map((reg) => {
                  const isExpanded = editExpandedRegions.has(reg.key);
                  const regCountries = reg.countries.map((c) => c.code);
                  const selectedCount = reg.countries.filter((c) => editSelectedRegions.has(c.code)).length;
                  const allSelected = selectedCount === reg.countries.length;
                  const someSelected = selectedCount > 0 && !allSelected;

                  return (
                    <div key={reg.key} className="border border-border/80 rounded-md overflow-hidden bg-background">
                      {/* Region Header */}
                      <div className="flex items-center justify-between px-2.5 py-1.5 bg-muted/30 select-none">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected;
                            }}
                            onChange={() => toggleEditMacroRegion(reg.key, regCountries)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-accent focus:ring-accent accent-accent cursor-pointer"
                          />
                          <span className="font-semibold text-xs text-foreground">{reg.label}</span>
                          <span className="text-[9px] bg-muted text-muted-foreground font-mono px-1.5 py-0.2 rounded-full">
                            {selectedCount}/{reg.countries.length}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleEditRegionExpanded(reg.key)}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>

                      {/* Countries list under region */}
                      {isExpanded && (
                        <div className="px-3 py-2 border-t border-border/60 grid grid-cols-2 gap-1.5 bg-card/10">
                          {reg.countries.map((c) => {
                            const active = editSelectedRegions.has(c.code);
                            return (
                              <label
                                key={c.code}
                                className={`flex items-center gap-2 p-1.5 rounded border transition-colors cursor-pointer text-[10px] ${active
                                    ? "border-accent/60 bg-accent/5 text-foreground"
                                    : "border-border/40 hover:bg-muted/30 text-muted-foreground"
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={() => toggleEditCountry(c.code)}
                                  className="h-3 w-3 rounded border-gray-300 text-accent focus:ring-accent accent-accent cursor-pointer"
                                />
                                <span>{c.flag}</span>
                                <span className="font-medium truncate">{c.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMark(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MarksTable({
  marks,
  infringements,
  onToggleStatus,
  onEdit,
  onRemove,
  isActiveSection,
}: {
  marks: Mark[];
  infringements: Infringement[];
  onToggleStatus: (id: string) => void;
  onEdit: (m: Mark) => void;
  onRemove: (m: Mark) => void;
  isActiveSection: boolean;
}) {
  if (marks.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground border-t border-border">
        {isActiveSection ? "No active monitored assets." : "No assets on hold."}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Brand / Mark</TableHead>
          <TableHead>Registration #</TableHead>
          <TableHead>Platforms</TableHead>
          <TableHead className="text-center">Repeat Cycle</TableHead>
          <TableHead className="text-center">Active alerts</TableHead>
          <TableHead className="text-right">Last scan</TableHead>
          {!isActiveSection && <TableHead className="text-center w-[60px]">Edit</TableHead>}
          <TableHead className="text-center w-[120px]">Monitoring</TableHead>
          <TableHead className="w-[50px] text-right"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {marks.map((m) => {
          const alerts = isActiveSection
            ? infringements.filter((i) => i.markId === m.id && i.status === "active").length
            : 0;

          return (
            <TableRow key={m.id} className={!isActiveSection ? "bg-muted/10" : ""}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-md shrink-0"
                    style={{
                      background: isActiveSection
                        ? `linear-gradient(135deg, ${m.logoColor}, oklch(0.3 0.05 260))`
                        : `linear-gradient(135deg, oklch(0.6 0 0), oklch(0.3 0 0))`,
                    }}
                  />
                  <div>
                    <p
                      className={`font-medium ${!isActiveSection ? "text-muted-foreground line-through decoration-muted-foreground/30" : ""}`}
                    >
                      {m.brandName}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">{m.website}</p>
                    {m.targetRegions && m.targetRegions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.targetRegions.map((code) => {
                          const conf = COUNTRY_BY_CODE[code];
                          return (
                            <span
                              key={code}
                              className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-muted border border-border/40 text-[9px] text-muted-foreground font-medium"
                              title={`${conf?.name || code} Proxy Location`}
                            >
                              <span>{conf?.flag || "🌐"}</span>
                              <span>{code}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">{m.registrationNumber}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {m.platforms
                    .filter((p) => ALL_PLATFORMS.some((ap) => ap.id === p))
                    .map((p) => (
                      <Badge key={p} variant="secondary" className="text-[10px]">
                        {p}
                      </Badge>
                    ))}
                </div>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">
                {m.repeatCycle ? `${m.repeatCycle} min` : "Manual"}
              </TableCell>
              <TableCell className="text-center">
                {isActiveSection ? (
                  <span
                    className={
                      alerts > 0 ? "font-semibold text-risk-high" : "text-muted-foreground"
                    }
                  >
                    {alerts}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Paused</span>
                )}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {isActiveSection ? m.lastScan : "Paused"}
              </TableCell>
              {!isActiveSection && (
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-transparent border border-transparent hover:border-accent text-muted-foreground hover:text-accent transition-colors"
                    onClick={() => onEdit(m)}
                    title="Edit brand details"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
              <TableCell className="text-center">
                {isActiveSection ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/50"
                    onClick={() => onToggleStatus(m.id)}
                  >
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1 bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={() => onToggleStatus(m.id)}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Activate
                  </Button>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-transparent border border-transparent hover:border-red-500 text-muted-foreground hover:text-red-500 transition-colors"
                  onClick={() => onRemove(m)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
