import { createFileRoute, useNavigate, useLocation, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useStore, type Persona } from "@/lib/store";
import {
  Building2,
  Scale,
  Check,
  Calendar,
  Download,
  ArrowUpRight,
  Lock,
  Loader2,
  Mail,
  Minus,
  Plus,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NotificationSettingsPanel } from "@/components/notification-settings-panel";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ClientsPage } from "@/components/ClientsPage";
import {
  getSubscription,
  getInvoices,
  getBrands,
  cancelSubscription,
  updateSubscription,
  createPortalSession,
  type AddonSelection,
} from "@/lib/api";
import { getPlan, ADDONS, effectiveMonthly } from "@/lib/billing";
import { computeEntitlements, formatLimit } from "@/lib/entitlements";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — HAKKIU" }] }),
  component: () => <SettingsPage />,
});

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const persona = useStore((s) => s.persona);
  const setPersona = useStore((s) => s.setPersona);
  const { profile, user, refreshProfile } = useAuth();
  const orgId = profile?.organization_id || user?.id;

  const queryClient = useQueryClient();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [savingAddons, setSavingAddons] = useState(false);
  const [addonDraft, setAddonDraft] = useState<Record<string, number> | null>(null);

  const { data: subscription } = useQuery({
    queryKey: ["billing_subscription"],
    queryFn: getSubscription,
  });
  const { data: invoices } = useQuery({
    queryKey: ["billing_invoices"],
    queryFn: getInvoices,
  });
  const { data: brandsData } = useQuery({
    queryKey: ["brands"],
    queryFn: getBrands,
  });

  // Effective plan entitlements (base + add-ons) for the "Plan includes" card.
  const entitlements = computeEntitlements(subscription);
  const brandsUsed = brandsData?.usage.used ?? 0;
  const brandLimit = brandsData?.usage.limit ?? entitlements.brands;

  const [fullName, setFullName] = useState("");
  const [emailVal, setEmailVal] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const currentPlan = profile?.plan || "free";

  // Admin is now handled entirely by the separate admin portal — a customer-app user
  // is never treated as admin here (Fazė 6). Kept as an inert const so the billing
  // branches below still compile without churn.
  const isAdmin = false;

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
    }
  }, [profile]);

  useEffect(() => {
    if (!orgId || !supabase) {
      setLoadingProfile(false);
      return;
    }

    async function loadOrgSettings() {
      try {
        const { data, error } = await supabase!
          .from("org_settings")
          .select("notification_email, firm_name")
          .eq("organization_id", orgId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setEmailVal(data.notification_email || user?.email || "");
          setOrgName(
            data.firm_name || (persona === "law_firm" ? "Chen & Partners IP" : "Helix Audio Inc."),
          );
        } else {
          setEmailVal(user?.email || "");
          setOrgName(persona === "law_firm" ? "Chen & Partners IP" : "Helix Audio Inc.");
        }
      } catch (err) {
        console.error("Error loading org settings:", err);
      } finally {
        setLoadingProfile(false);
      }
    }

    loadOrgSettings();
  }, [orgId, user, persona]);

  const handleSaveProfile = async () => {
    if (!user || !supabase) return;
    setSavingProfile(true);
    try {
      // 1. Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
        })
        .eq("id", user.id);
      if (profileError) throw profileError;

      // 2. Update org_settings table
      const { error: orgError } = await supabase.from("org_settings").upsert({
        organization_id: orgId,
        firm_name: orgName,
        notification_email: emailVal,
        updated_at: new Date().toISOString(),
      });
      if (orgError) throw orgError;

      // 3. Optional: update auth email if changed
      if (emailVal.trim() && emailVal.trim() !== user.email) {
        const { error: authError } = await supabase.auth.updateUser({ email: emailVal.trim() });
        if (authError) {
          console.warn("Auth email update error:", authError);
          toast.warning(
            "Profile saved. Confirm change on your email address(es) to update login email.",
          );
        }
      }

      await refreshProfile();
      toast.success("Profile saved successfully");
    } catch (err) {
      console.error("Error saving profile:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTestEmailClient = () => {
    if (!emailVal.trim()) {
      toast.error("Please enter an email address to test.");
      return;
    }
    const emailStr = emailVal.trim();
    const isGmail =
      emailStr.toLowerCase().endsWith("@gmail.com") || emailStr.toLowerCase().includes("gmail");
    const subject = "Test Alert — HAKKIU";
    const body = "This is a test notification from HAKKIU to verify your profile settings.";

    if (isGmail) {
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailStr)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(gmailUrl, "_blank");
      toast.success("Opened Gmail compose window in a new tab");
    } else {
      const mailtoUrl = `mailto:${encodeURIComponent(emailStr)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoUrl;
      toast.success("Opened default email client");
    }
  };

  const planMeta = getPlan(currentPlan);
  const interval = subscription?.interval ?? "month";
  const currentPlanInfo = {
    name: isAdmin ? "Admin Plan" : (planMeta ? `${planMeta.name} Plan` : "Free Plan"),
    price: isAdmin ? 0 : (planMeta ? planMeta.monthly : 0),
  };
  const shownMonthly = isAdmin ? 0 : (
    currentPlanInfo.price && currentPlanInfo.price > 0
      ? effectiveMonthly(currentPlanInfo.price, interval)
      : currentPlanInfo.price
  );
  const nextInvoiceDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString()
    : null;
  const currentAddons: AddonSelection[] = subscription?.addons ?? [];

  const getActiveTab = (path: string) => {
    if (path.endsWith("/profile")) return "profile";
    if (path.endsWith("/notifications")) return "notifications";
    if (path.endsWith("/billing")) return "billing";
    if (path.endsWith("/clients")) return "clients";
    return "profile";
  };

  const [activeTab, setActiveTab] = useState(() => getActiveTab(location.pathname));

  useEffect(() => {
    setActiveTab(getActiveTab(location.pathname));
  }, [location.pathname]);

  function handleTabChange(value: string) {
    if (value === "profile") {
      navigate({ to: "/settings/profile" });
    } else if (value === "notifications") {
      navigate({ to: "/settings/notifications" });
    } else if (value === "billing") {
      navigate({ to: "/settings/billing" });
    } else if (value === "clients") {
      navigate({ to: "/settings/clients" });
    } else {
      setActiveTab(value);
    }
  }

  async function switchPersona(p: Persona) {
    if (p === persona) return;
    setPersona(p);

    if (supabase && orgId) {
      try {
        await supabase.from("org_settings").upsert({
          organization_id: orgId,
          persona: p,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Failed to persist persona to Supabase:", err);
      }
    }

    toast.success(`Switched to ${p === "law_firm" ? "Law Firm" : "Brand Owner"} mode`);
  }

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      await cancelSubscription(true);
      await queryClient.invalidateQueries({ queryKey: ["billing_subscription"] });
      await queryClient.invalidateQueries({ queryKey: ["billing_invoices"] });
      await refreshProfile();
      toast.success("Subscription will end at the close of your billing period.");
      setShowCancelModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel subscription.");
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenPortal = async () => {
    setOpeningPortal(true);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing portal.");
      setOpeningPortal(false);
    }
  };

  // Add-on management: draft starts from the current subscription add-ons.
  const addonQty = (key: string): number =>
    addonDraft?.[key] ?? currentAddons.find((a) => a.key === key)?.quantity ?? 0;

  const setAddonQty = (key: string, next: number) => {
    setAddonDraft((prev) => {
      const base = prev ?? Object.fromEntries(currentAddons.map((a) => [a.key, a.quantity]));
      return { ...base, [key]: Math.max(0, next) };
    });
  };

  // Only enable "Save add-ons" when the draft actually differs from what's live.
  const addonsChanged =
    addonDraft !== null &&
    ADDONS.some(
      (a) => addonQty(a.key) !== (currentAddons.find((c) => c.key === a.key)?.quantity ?? 0),
    );

  const handleSaveAddons = async () => {
    setSavingAddons(true);
    try {
      const addons: AddonSelection[] = ADDONS.map((a) => ({
        key: a.key,
        quantity: addonQty(a.key),
      })).filter((a) => a.quantity > 0);
      // Pass the current plan + interval explicitly so the backend never drifts
      // the plan while we're only changing add-ons.
      await updateSubscription({
        plan: currentPlan,
        interval: interval as "month" | "year",
        addons,
      });
      await queryClient.invalidateQueries({ queryKey: ["billing_subscription"] });
      await queryClient.invalidateQueries({ queryKey: ["billing_invoices"] });
      await refreshProfile();
      setAddonDraft(null);
      toast.success("Add-ons updated. Prorated charges apply to your next invoice.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update add-ons.");
    } finally {
      setSavingAddons(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace configuration and preferences.</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {persona === "law_firm" && <TabsTrigger value="clients">Clients</TabsTrigger>}
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="api">API & Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card className="border-border/40 bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-5 w-5 text-accent" />
                Profile & Workspace Info
              </CardTitle>
              <CardDescription>
                Manage your profile details, organization settings, and notification alerts
                recipient.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingProfile ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="full-name">Full name</Label>
                      <Input
                        id="full-name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="bg-background/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-email">Alert Email Address</Label>
                      <div className="flex gap-2">
                        <Input
                          id="profile-email"
                          type="email"
                          value={emailVal}
                          onChange={(e) => setEmailVal(e.target.value)}
                          className="bg-background/50"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleTestEmailClient}
                          title="Test Opening Default Email Client"
                          className="shrink-0"
                        >
                          <Mail className="h-4 w-4 mr-2 text-accent" />
                          Test
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organization">Organization / Firm Name</Label>
                    <Input
                      id="organization"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSaveProfile} disabled={savingProfile}>
                      {savingProfile ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save changes"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {persona === "law_firm" && (
          <TabsContent value="clients" className="mt-4">
            <ClientsPage />
          </TabsContent>
        )}

        <TabsContent value="notifications" className="mt-4">
          <div className="space-y-6">
            <NotificationSettingsPanel />
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
                    <CardDescription>
                      {isAdmin ? "Full administrator access with API rights." : "Your current workspace tier."}
                    </CardDescription>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/15 text-accent border border-accent/20 capitalize">
                    {currentPlanInfo.name}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-3xl font-bold text-foreground">
                    {isAdmin ? "$0" : (shownMonthly !== null ? `$${(shownMonthly ?? 0).toLocaleString()}` : "Custom")}
                  </span>
                  {shownMonthly !== null && (
                    <span className="text-xs text-muted-foreground">
                      / month{interval === "year" && !isAdmin ? " (billed yearly)" : ""}
                    </span>
                  )}
                </div>
                {subscription?.cancel_at_period_end && !isAdmin && (
                  <p className="text-xs text-amber-500">
                    Your plan is set to cancel
                    {nextInvoiceDate ? ` on ${nextInvoiceDate}` : " at period end"}.
                  </p>
                )}
                {currentPlan !== "free" &&
                  !isAdmin &&
                  !subscription?.cancel_at_period_end &&
                  nextInvoiceDate && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Next invoice on {nextInvoiceDate}
                    </p>
                  )}
                {currentPlan === "free" && !isAdmin && (
                  <p className="text-xs text-muted-foreground">
                    Upgrade to unlock automatic takedowns, all platforms, and real-time monitoring.
                  </p>
                )}
                {isAdmin && (
                  <p className="text-xs text-muted-foreground">
                    You have unlimited access to all platform features and scraping resources.
                  </p>
                )}
              </CardContent>
              {!isAdmin && (
                <CardFooter className="flex gap-3 border-t border-border/30 pt-4 mt-2">
                  <Button asChild size="sm" className="cursor-pointer">
                    <Link to="/plans">
                      Change Plan <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                  {currentPlan !== "free" &&
                    currentPlan !== "enterprise" &&
                    !subscription?.cancel_at_period_end && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/30 cursor-pointer"
                        onClick={() => setShowCancelModal(true)}
                      >
                        Cancel Subscription
                      </Button>
                    )}
                </CardFooter>
              )}
            </Card>

            {/* Plan Includes / Entitlements Card */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Plan Includes</CardTitle>
                <CardDescription>What your current plan and add-ons unlock.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monitored brands</span>
                  <span className="font-medium text-foreground">
                    {brandsUsed} / {formatLimit(brandLimit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platforms per scan</span>
                  <span className="font-medium text-foreground">{formatLimit(entitlements.platforms)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scan regions</span>
                  <span className="font-medium text-foreground">{formatLimit(entitlements.regions)}</span>
                </div>
                {[
                  ["Domain tracking", entitlements.domainTracking],
                  ["Managed takedown", entitlements.managedTakedown],
                  ["Advanced reports", entitlements.advancedReports],
                  ["API access", entitlements.apiAccess],
                  ["Real-time monitoring", entitlements.realTimeScans],
                ].map(([label, on]) => (
                  <div key={String(label)} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-medium ${on ? "text-emerald-500" : "text-muted-foreground/60"}`}>
                      {on ? "Included" : "—"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Payment Method Card */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Payment Method</CardTitle>
                <CardDescription>Manage your card via the secure Stripe portal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isAdmin ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
                    <Lock className="h-4 w-4 shrink-0 text-accent" />
                    <span>No card required for Admin plan.</span>
                  </div>
                ) : currentPlan !== "free" ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground">
                    <Lock className="h-4 w-4 shrink-0 text-accent" />
                    <span>
                      Your card is stored securely by Stripe. Use the portal to view or update it.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                    <Lock className="h-4 w-4 shrink-0" />
                    <span>No card linked. Choose a plan to subscribe.</span>
                  </div>
                )}
              </CardContent>
              {!isAdmin && (
                <CardFooter className="flex gap-3 border-t border-border/30 pt-4 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={currentPlan === "free" || openingPortal}
                    onClick={handleOpenPortal}
                  >
                    {openingPortal ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Manage payment method"
                    )}
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>

          {/* Add-ons management */}
          {currentPlan !== "free" && currentPlan !== "enterprise" && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Add-ons</CardTitle>
                <CardDescription>
                  Extend your plan. Changes are prorated on your next invoice.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {ADDONS.map((addon) => {
                  const qty = addonQty(addon.key);
                  return (
                    <div
                      key={addon.key}
                      className="flex items-start justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{addon.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ${addon.price}/mo per {addon.unit}
                        </p>
                      </div>
                      {addon.perUnit ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setAddonQty(addon.key, qty - 1)}
                            disabled={qty === 0}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm tabular-nums">{qty}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setAddonQty(addon.key, qty + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant={qty > 0 ? "default" : "outline"}
                          size="sm"
                          className="shrink-0"
                          onClick={() => setAddonQty(addon.key, qty > 0 ? 0 : 1)}
                        >
                          {qty > 0 ? "Added" : "Add"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
              <CardFooter className="flex justify-end border-t border-border/30 pt-4 mt-2">
                <Button
                  size="sm"
                  className="cursor-pointer"
                  disabled={!addonsChanged || savingAddons}
                  onClick={handleSaveAddons}
                >
                  {savingAddons ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save add-ons"}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Invoice History */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Billing History</CardTitle>
              <CardDescription>Recent invoices and transaction receipts.</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices && invoices.length > 0 ? (
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
                      {invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="py-3.5 px-4 font-mono text-xs">
                            {inv.stripe_invoice_id ?? inv.id.slice(0, 8)}
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground">
                            {new Date(inv.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 font-medium">
                            {inv.currency.toUpperCase()} {(inv.amount_due / 100).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border capitalize",
                                inv.status === "paid"
                                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-500 border-amber-500/20",
                              )}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {inv.invoice_pdf ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                                className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg border-dashed border-border">
                  No invoices yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API key</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                readOnly
                value="mg_live_•••••••••••••••••••••••••••• 4f9a"
                className="font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Reveal
                </Button>
                <Button variant="outline" size="sm">
                  Rotate
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cancel Subscription Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-sm border-border bg-card shadow-2xl animate-fade-in animate-duration-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-destructive">
                Cancel Subscription
              </CardTitle>
              <CardDescription>
                Your plan stays active until the end of the current billing period.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              <p>Are you sure you want to cancel your subscription?</p>
              <p>
                You'll keep full access until
                {nextInvoiceDate ? ` ${nextInvoiceDate}` : " the end of the period"}, then downgrade
                to the <strong>Free Plan</strong>, which disables automated DMCA / C&amp;D takedowns
                and limits monitoring.
              </p>
            </CardContent>
            <CardFooter className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="ghost"
                disabled={cancelling}
                onClick={() => setShowCancelModal(false)}
                className="cursor-pointer"
              >
                No, Keep Plan
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={cancelling}
                onClick={handleCancelSubscription}
                className="cursor-pointer gap-2"
              >
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                Yes, Cancel
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}

function PersonaCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-2 rounded-lg border p-5 text-left transition-all",
        active
          ? "border-accent bg-accent/5 ring-1 ring-accent"
          : "hover:border-accent/40 hover:bg-muted/40",
      )}
    >
      {active && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-md",
          active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}
