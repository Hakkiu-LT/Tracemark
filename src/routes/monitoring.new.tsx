import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore, type Platform } from "@/lib/store";
import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/monitoring/new")({
  head: () => ({
    meta: [
      { title: "Add asset — Tracemark" },
      { name: "description", content: "Register a new trademark or brand asset for continuous monitoring." },
    ],
  }),
  component: NewAssetPage,
});

const PLATFORMS: Platform[] = ["Amazon", "Shopify", "eBay", "AliExpress", "Web Domain", "Instagram", "TikTok"];

function NewAssetPage() {
  const navigate = useNavigate();
  const addMark = useStore((s) => s.addMark);
  const clients = useStore((s) => s.clients);
  const persona = useStore((s) => s.persona);
  const activeClientId = useStore((s) => s.activeClientId);

  const [brandName, setBrandName] = useState("");
  const [regNum, setRegNum] = useState("");
  const [website, setWebsite] = useState("");
  const [clientId, setClientId] = useState(activeClientId ?? clients[0]?.id ?? "c1");
  const [selected, setSelected] = useState<Set<Platform>>(new Set(["Amazon", "Web Domain"]));
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
    if (!brandName || !regNum) {
      toast.error("Brand name and registration number are required.");
      return;
    }
    addMark({
      brandName,
      registrationNumber: regNum,
      website,
      clientId,
      platforms: Array.from(selected),
      logoColor: "oklch(0.58 0.18 255)",
    });
    toast.success(`Monitoring started for ${brandName}`, { description: "First scan will complete in approximately 60 seconds." });
    navigate({ to: "/monitoring" });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add monitored asset</h1>
        <p className="text-sm text-muted-foreground">Register a trademark or brand to begin continuous web-wide monitoring.</p>
      </div>

      <form onSubmit={onSubmit}>
        <Card>
          <CardHeader><CardTitle className="text-base">Asset details</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {persona === "law_firm" && (
              <div className="space-y-2">
                <Label>Client</Label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brand">Brand name *</Label>
                <Input id="brand" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Aurora Athletics" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg">Trademark registration # *</Label>
                <Input id="reg" value={regNum} onChange={(e) => setRegNum(e.target.value)} placeholder="US-89234112" className="font-mono" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="web">Official website</Label>
              <Input id="web" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://aurora.co" />
            </div>
            <div className="space-y-2">
              <Label>Logo / brand images</Label>
              <label className="flex h-32 cursor-pointer items-center justify-center rounded-md border-2 border-dashed bg-muted/30 transition-colors hover:bg-muted/50">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="h-full object-contain" />
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
                    <p className="mt-2 text-xs text-muted-foreground">Drop logo here or click to upload (PNG, SVG)</p>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
              </label>
            </div>
            <div className="space-y-3">
              <Label>Target platforms</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PLATFORMS.map((p) => (
                  <label key={p} className="flex items-center gap-2 rounded-md border p-3 text-sm hover:bg-muted/40">
                    <Checkbox checked={selected.has(p)} onCheckedChange={() => toggle(p)} />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/monitoring" })}>Cancel</Button>
          <Button type="submit">Start monitoring</Button>
        </div>
      </form>
    </div>
  );
}
