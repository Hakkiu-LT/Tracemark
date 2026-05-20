import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useStore, type Persona } from "@/lib/store";
import { Building2, Scale, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Tracemark" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const persona = useStore((s) => s.persona);
  const setPersona = useStore((s) => s.setPersona);

  function switchPersona(p: Persona) {
    if (p === persona) return;
    setPersona(p);
    toast.success(`Switched to ${p === "law_firm" ? "Law Firm" : "Brand Owner"} mode`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace configuration and preferences.</p>
      </div>

      <Tabs defaultValue="persona">
        <TabsList>
          <TabsTrigger value="persona">Workspace</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api">API & Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="persona" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace mode</CardTitle>
              <p className="text-sm text-muted-foreground">Tailors navigation, dashboards, and case workflows to your role.</p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <PersonaCard active={persona === "brand_owner"} onClick={() => switchPersona("brand_owner")} icon={Building2} title="Brand Owner" desc="Single-brand workspace for e-commerce and SaaS teams protecting their own marks." />
              <PersonaCard active={persona === "law_firm"} onClick={() => switchPersona("law_firm")} icon={Scale} title="Law Firm" desc="Multi-tenant workspace for managing many client brands with per-client billing." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Full name</Label><Input defaultValue="Avery Chen" /></div>
                <div className="space-y-2"><Label>Email</Label><Input defaultValue="avery@tracemark.io" /></div>
              </div>
              <div className="space-y-2"><Label>Organization</Label><Input defaultValue={persona === "law_firm" ? "Chen & Partners IP" : "Helix Audio Inc."} /></div>
              <Button>Save changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Alert preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                ["High-risk detections", "Email + in-app, immediate", true],
                ["Medium-risk detections", "Daily digest", true],
                ["Low-risk detections", "Weekly digest", false],
                ["Takedown status changes", "In-app only", true],
              ].map(([k, v, on]) => (
                <div key={k as string} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{k}</p>
                    <p className="text-xs text-muted-foreground">{v}</p>
                  </div>
                  <Switch defaultChecked={on as boolean} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">API key</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input readOnly value="mg_live_•••••••••••••••••••••••••••• 4f9a" className="font-mono text-xs" />
              <div className="flex gap-2"><Button variant="outline" size="sm">Reveal</Button><Button variant="outline" size="sm">Rotate</Button></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PersonaCard({ active, onClick, icon: Icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ComponentType<{className?:string}>; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-2 rounded-lg border p-5 text-left transition-all",
        active ? "border-accent bg-accent/5 ring-1 ring-accent" : "hover:border-accent/40 hover:bg-muted/40"
      )}
    >
      {active && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground"><Check className="h-3 w-3" /></span>}
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-md", active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}

