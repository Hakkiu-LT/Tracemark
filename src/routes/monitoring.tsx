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
import { Plus, Radar, Trash2, Play, Pause, EyeOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import { checkBrandFullPipeline } from "@/lib/api";
import { PLATFORMS } from "@/lib/platforms";

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
  { id: "Google Shopping", label: "Google Shopping" },
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

  const isRepeatCycleInvalid = editRepeatCycle !== "" && !/^\d+$/.test(editRepeatCycle);

  useEffect(() => {
    if (editingMark) {
      setEditBrandName(editingMark.brandName);
      setEditRegNum(editingMark.registrationNumber);
      setEditWebsite(editingMark.website);
      setEditClientId(editingMark.clientId);
      setEditPlatforms(new Set(editingMark.platforms));
      setEditRepeatCycle(
        editingMark.repeatCycle !== undefined && editingMark.repeatCycle !== null
          ? String(editingMark.repeatCycle)
          : "",
      );
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
        },
        controller.signal,
      );

      activeScansRef.current.delete(id);

      const hasRisk =
        result.decision.risk_level === "HIGH" || result.decision.risk_level === "MEDIUM";
      if (
        hasRisk &&
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

        setScanResult(result.case_id, result);
        toast.success(`Copycat found for ${mark.brandName}! New case created.`, {
          id: toastId,
          duration: 5000,
        });
      } else {
        toast.error("No cats found", {
          id: toastId,
          duration: 5000,
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
      toast.error(`Scan failed for ${mark.brandName}.`, { id: toastId, duration: 5000 });

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
      toast.success("Monitoring stopped", { duration: 5000 });
    }
  };

  const handleSave = () => {
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

    updateMark(editingMark.id, {
      brandName: editBrandName.trim(),
      registrationNumber: editRegNum.trim(),
      website: editWebsite.trim(),
      clientId: editClientId,
      platforms: Array.from(editPlatforms),
      repeatCycle: repeatCycleNum,
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

          <div className="space-y-4 py-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-repeatCycle">Repeat Cycle</Label>
                <span className="text-[10px] text-muted-foreground font-medium">
                  Entered value in minutes
                </span>
              </div>
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
                      className={`flex items-center justify-between p-2 rounded-md border text-left cursor-pointer transition-colors text-xs select-none ${
                        active
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
                  </div>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">{m.registrationNumber}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {m.platforms.map((p) => (
                    <Badge key={p} variant="secondary" className="text-[10px]">
                      {p}
                    </Badge>
                  ))}
                </div>
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
