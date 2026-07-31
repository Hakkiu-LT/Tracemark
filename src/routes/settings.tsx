import { createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStore, type Persona } from "@/lib/store";
import {
  Building2,
  Check,
  Loader2,
  Mail,
  MessageSquare,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NotificationSettingsPanel } from "@/components/notification-settings-panel";
import { useAuth } from "@/lib/auth";
import { ClientsPage } from "@/components/ClientsPage";
import { apiFetch } from "@/lib/api";

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

  const [fullName, setFullName] = useState("");
  const [emailVal, setEmailVal] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
    }
  }, [profile]);

  useEffect(() => {
    if (!orgId) {
      setLoadingProfile(false);
      return;
    }

    async function loadOrgSettings() {
      try {
        const { supabase } = await import("@/lib/supabase");
        if (!supabase) return;
        const { data, error } = await supabase
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
    if (!user) return;
    const { supabase } = await import("@/lib/supabase");
    if (!supabase) return;
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
      toast.error("Couldn't save your profile. Please try again.");
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

  const getActiveTab = (path: string) => {
    if (path.endsWith("/profile")) return "profile";
    if (path.endsWith("/notifications")) return "notifications";
    if (path.endsWith("/clients")) return "clients";
    if (path.endsWith("/support")) return "support";
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
    } else if (value === "clients") {
      navigate({ to: "/settings/clients" });
    } else if (value === "support") {
      navigate({ to: "/settings/support" });
    } else {
      setActiveTab(value);
    }
  }

  async function switchPersona(p: Persona) {
    if (p === persona) return;
    setPersona(p);

    const { supabase } = await import("@/lib/supabase");
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
          <TabsTrigger value="api">API & Webhooks</TabsTrigger>
          <TabsTrigger value="support">Contact Support</TabsTrigger>
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

        <TabsContent value="support" className="mt-4">
          <ContactSupportPanel userEmail={user?.email} />
        </TabsContent>
      </Tabs>

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

/* ── Contact Support panel ──────────────────────────────────────────── */

function ContactSupportPanel({ userEmail }: { userEmail?: string }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const canSend = subject.trim().length > 0 && message.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    try {
      await apiFetch("/support/contact", {
        method: "POST",
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      toast.success("Message sent! We'll get back to you shortly.");
      setSent(true);
      setSubject("");
      setMessage("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-accent" />
          Contact Support
        </CardTitle>
        <CardDescription>
          Have a question, bug report, or feature request? Send us a message and we'll get back to you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <Check className="h-6 w-6 text-accent" />
            </div>
            <p className="font-medium">Message sent successfully</p>
            <p className="text-sm text-muted-foreground">
              Our team will review your message and respond shortly.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setSent(false)}>
              Send another message
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="support-subject">Subject</Label>
              <Input
                id="support-subject"
                placeholder="e.g. Issue with brand monitoring"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="bg-background/50"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-message">Message</Label>
              <Textarea
                id="support-message"
                placeholder="Describe your issue or question in detail..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="bg-background/50 min-h-[140px]"
                maxLength={5000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {message.length} / 5,000
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={!canSend || sending}>
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
