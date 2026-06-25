import { createFileRoute, useNavigate, useLocation, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useStore, type Persona } from "@/lib/store";
import { Building2, Scale, Check, CreditCard, Calendar, Download, Trash2, ArrowUpRight, Lock, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NotificationSettingsPanel } from "@/components/notification-settings-panel";
import { NotificationDeliveryLog } from "@/components/notification-delivery-log";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Tracemark" }] }),
  component: () => <SettingsPage />,
});

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const persona = useStore((s) => s.persona);
  const setPersona = useStore((s) => s.setPersona);
  const { profile, refreshProfile } = useAuth();

  const [showCardModal, setShowCardModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [newCardNum, setNewCardNum] = useState("");
  const [newCardExpiry, setNewCardExpiry] = useState("");
  const [newCardCvc, setNewCardCvc] = useState("");

  const currentPlan = profile?.plan || "free";

  const planDetails = {
    free: { name: "Free Plan", price: 0 },
    starter: { name: "Starter Plan", price: 49 },
    pro: { name: "Pro Plan", price: 199 },
    firm: { name: "Firm Plan", price: 599 },
    enterprise: { name: "Enterprise Plan", price: null },
  };

  const currentPlanInfo = planDetails[currentPlan as keyof typeof planDetails] || planDetails.free;

  const getActiveTab = (path: string) => {
    if (path.endsWith("/notifications")) return "notifications";
    if (path.endsWith("/billing")) return "billing";
    return "persona";
  };

  const [activeTab, setActiveTab] = useState(() => getActiveTab(location.pathname));

  useEffect(() => {
    setActiveTab(getActiveTab(location.pathname));
  }, [location.pathname]);

  function handleTabChange(value: string) {
    if (value === "persona") {
      navigate({ to: "/settings" });
    } else if (value === "notifications") {
      navigate({ to: "/settings/notifications" });
    } else if (value === "billing") {
      navigate({ to: "/settings/billing" });
    } else {
      setActiveTab(value);
    }
  }

  function switchPersona(p: Persona) {
    if (p === persona) return;
    setPersona(p);
    toast.success(`Switched to ${p === "law_firm" ? "Law Firm" : "Brand Owner"} mode`);
  }

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      if (supabase && profile?.id) {
        const { error } = await supabase
          .from("profiles")
          .update({ plan: "free" })
          .eq("id", profile.id);
        if (error) {
          toast.error("Failed to cancel subscription.");
        } else {
          await refreshProfile();
          toast.success("Subscription cancelled successfully.");
          setShowCancelModal(false);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while cancelling your subscription.");
    } finally {
      setCancelling(false);
    }
  };

  const handleUpdateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardNum || !newCardExpiry || !newCardCvc) {
      toast.error("Please fill in all credit card fields.");
      return;
    }
    toast.success("Payment method updated successfully!");
    setShowCardModal(false);
    setNewCardNum("");
    setNewCardExpiry("");
    setNewCardCvc("");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace configuration and preferences.</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="persona">Workspace</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
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
          <div className="space-y-6">
            <NotificationSettingsPanel />
            <NotificationDeliveryLog />
          </div>
        </TabsContent>

        <TabsContent value="billing" className="mt-4 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Current Plan Card */}
            <Card className="border-border/60">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">Subscription Plan</CardTitle>
                    <CardDescription>Your current workspace tier.</CardDescription>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/15 text-accent border border-accent/20 capitalize">
                    {currentPlanInfo.name}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-3xl font-bold text-foreground">
                    {currentPlanInfo.price !== null ? `$${currentPlanInfo.price}` : "Custom"}
                  </span>
                  {currentPlanInfo.price !== null && (
                    <span className="text-xs text-muted-foreground">/ month</span>
                  )}
                </div>
                {currentPlan !== "free" && currentPlanInfo.price !== null && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Next invoice on {new Date(Date.now() + 12 * 86400000).toLocaleDateString()}
                  </p>
                )}
                {currentPlan === "free" && (
                  <p className="text-xs text-muted-foreground">
                    Upgrade to unlock automatic takedowns, proxy selections, and Slack integrations.
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex gap-3 border-t border-border/30 pt-4 mt-2">
                <Button asChild size="sm" className="cursor-pointer">
                  <Link to="/plans">
                    Change Plan <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
                {currentPlan !== "free" && currentPlan !== "enterprise" && (
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/30 cursor-pointer" onClick={() => setShowCancelModal(true)}>
                    Cancel Subscription
                  </Button>
                )}
              </CardFooter>
            </Card>

            {/* Payment Method Card */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Payment Method</CardTitle>
                <CardDescription>Linked credit card details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentPlan !== "free" ? (
                  <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-muted/20">
                    <div className="h-10 w-12 rounded bg-muted/65 border border-border flex items-center justify-center font-bold tracking-widest text-[9px] text-muted-foreground/80 uppercase">
                      CARD
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Visa ending in •••• 4242</p>
                      <p className="text-xs text-muted-foreground">Expires 12/2028</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                    <Lock className="h-4 w-4 shrink-0" />
                    <span>No credit card linked. Choose a plan to subscribe.</span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex gap-3 border-t border-border/30 pt-4 mt-2">
                <Button variant="outline" size="sm" className="cursor-pointer" disabled={currentPlan === "free"} onClick={() => setShowCardModal(true)}>
                  Update Payment Method
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Invoice History */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Billing History</CardTitle>
              <CardDescription>Recent invoices and transaction receipts.</CardDescription>
            </CardHeader>
            <CardContent>
              {currentPlan !== "free" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-xs font-medium text-muted-foreground">
                        <th className="py-3 px-4">Invoice</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-sm">
                      <tr>
                        <td className="py-3.5 px-4 font-mono text-xs">INV-2026-003</td>
                        <td className="py-3.5 px-4 text-muted-foreground">{new Date(Date.now() - 10 * 86400000).toLocaleDateString()}</td>
                        <td className="py-3.5 px-4 font-medium">${currentPlanInfo.price}.00</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            Paid
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => toast.success("Downloading Invoice INV-2026-003 PDF...")}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3.5 px-4 font-mono text-xs">INV-2026-002</td>
                        <td className="py-3.5 px-4 text-muted-foreground">{new Date(Date.now() - 40 * 86400000).toLocaleDateString()}</td>
                        <td className="py-3.5 px-4 font-medium">${currentPlanInfo.price}.00</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            Paid
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => toast.success("Downloading Invoice INV-2026-002 PDF...")}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg border-dashed border-border">
                  No billing history available on the Free Plan.
                </div>
              )}
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

      {/* Credit Card Update Modal */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-sm border-border bg-card shadow-2xl animate-fade-in animate-duration-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Update Payment Method</CardTitle>
              <CardDescription>Enter your new credit card details.</CardDescription>
            </CardHeader>
            <form onSubmit={handleUpdateCard}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="modalCard">Card Number</Label>
                  <Input
                    id="modalCard"
                    required
                    value={newCardNum}
                    onChange={(e) => setNewCardNum(e.target.value.replace(/\s+/g, "").replace(/[^0-9]/gi, "").slice(0, 16))}
                    placeholder="4111 2222 3333 4444"
                    className="bg-background/50 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="modalExpiry">Expiry (MM/YY)</Label>
                    <Input
                      id="modalExpiry"
                      required
                      value={newCardExpiry}
                      onChange={(e) => setNewCardExpiry(e.target.value.slice(0, 5))}
                      placeholder="12/28"
                      className="bg-background/50 text-center font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modalCvc">CVC</Label>
                    <Input
                      id="modalCvc"
                      required
                      type="password"
                      value={newCardCvc}
                      onChange={(e) => setNewCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="•••"
                      className="bg-background/50 text-center font-mono"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowCardModal(false)} className="cursor-pointer">
                  Cancel
                </Button>
                <Button type="submit" className="cursor-pointer">
                  Save Card
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {/* Cancel Subscription Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-sm border-border bg-card shadow-2xl animate-fade-in animate-duration-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-destructive">Cancel Subscription</CardTitle>
              <CardDescription>Downgrade to the Free Plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              <p>Are you sure you want to cancel your subscription?</p>
              <p>Downgrading to the <strong>Free Plan</strong> limits active monitoring checks to 1 brand asset and disables automated DMCA / C&amp;D takedowns.</p>
            </CardContent>
            <CardFooter className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" disabled={cancelling} onClick={() => setShowCancelModal(false)} className="cursor-pointer">
                No, Keep Plan
              </Button>
              <Button type="button" variant="destructive" disabled={cancelling} onClick={handleCancelSubscription} className="cursor-pointer gap-2">
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                Yes, Downgrade
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
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

