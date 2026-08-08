import { createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
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
  Image as ImageIcon,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NotificationSettingsPanel } from "@/components/notification-settings-panel";
import { useAuth } from "@/lib/auth";
import { ClientsPage } from "@/components/ClientsPage";
import { apiFetch, testEmailNotification } from "@/lib/api";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — HAKKIU" }] }),
  component: () => <SettingsPage />,
});

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const persona = useStore((s) => s.persona);
  const setPersona = useStore((s) => s.setPersona);
  const setOrgInfo = useStore((s) => s.setOrgInfo);
  const { profile, user, refreshProfile } = useAuth();
  const orgId = profile?.organization_id || user?.id;

  const [fullName, setFullName] = useState("");
  const [emailVal, setEmailVal] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          .select("notification_email, firm_name, firm_logo_url")
          .eq("organization_id", orgId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setEmailVal(data.notification_email || user?.email || "");
          const name =
            data.firm_name || (persona === "law_firm" ? "Chen & Partners IP" : "Helix Audio Inc.");
          setOrgName(name);
          setOrgLogoUrl(data.firm_logo_url || null);
          setOrgInfo({
            orgName: name,
            orgLogoUrl: data.firm_logo_url || null,
          });
        } else {
          setEmailVal(user?.email || "");
          const defaultName = persona === "law_firm" ? "Chen & Partners IP" : "Helix Audio Inc.";
          setOrgName(defaultName);
          setOrgLogoUrl(null);
          setOrgInfo({
            orgName: defaultName,
            orgLogoUrl: null,
          });
        }
      } catch (err) {
        console.error("Error loading org settings:", err);
      } finally {
        setLoadingProfile(false);
      }
    }

    loadOrgSettings();
  }, [orgId, user, persona, setOrgInfo]);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG, WebP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file must be under 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setOrgLogoUrl(result);
      setOrgInfo({ orgLogoUrl: result });
      toast.success("Logo preview updated — click 'Save changes' to save.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setOrgLogoUrl(null);
    setOrgInfo({ orgLogoUrl: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast.info("Logo removed — click 'Save changes' to persist.");
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    // notification_email is now nullable at the DB level (owner-less companies created by
    // staff have no recipient yet). Keep a client-side guard so a real customer can't blank
    // out the address that breach alerts are sent to.
    if (!emailVal.trim()) {
      toast.error("Notification email can't be empty.");
      return;
    }
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
        firm_logo_url: orgLogoUrl,
        notification_email: emailVal,
        updated_at: new Date().toISOString(),
      });
      if (orgError) throw orgError;

      // Update global store state immediately
      setOrgInfo({
        orgName,
        orgLogoUrl,
      });

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

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      // The backend ignores the passed address for security (anti open-relay)
      // and always sends the test to the caller's own verified account email.
      const res = await testEmailNotification(emailVal.trim());
      toast.success(res.message || "Test email sent — check your inbox.");
    } catch (err: any) {
      toast.error(err?.message || "Couldn't send the test email. Please try again.");
    } finally {
      setTestingEmail(false);
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
                          onClick={handleTestEmail}
                          disabled={testingEmail}
                          title="Send a real test email to your account address"
                          className="shrink-0"
                        >
                          {testingEmail ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin text-accent" />
                          ) : (
                            <Mail className="h-4 w-4 mr-2 text-accent" />
                          )}
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
                      placeholder="e.g. Acme Corp or Chen & Partners IP"
                      className="bg-background/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      This name is displayed in your workspace header and on legal notices.
                    </p>
                  </div>

                  <div className="space-y-2 pt-1">
                    <Label>Company Logo</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg border border-border/50 bg-background/30 p-4">
                      {orgLogoUrl ? (
                        <div className="relative flex h-16 w-36 shrink-0 items-center justify-center rounded-md border border-border bg-white p-2 shadow-xs">
                          <img
                            src={orgLogoUrl}
                            alt="Company logo preview"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-16 w-36 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
                          <div className="flex flex-col items-center gap-1">
                            <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
                            <span>Default Logo</span>
                          </div>
                        </div>
                      )}

                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <Upload className="h-3.5 w-3.5 text-accent" />
                            {orgLogoUrl ? "Change logo" : "Upload logo"}
                          </Button>
                          {orgLogoUrl && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleRemoveLogo}
                              className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove logo
                            </Button>
                          )}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            onChange={handleLogoFileChange}
                            className="hidden"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG, SVG, or WebP up to 5MB. Displayed in your sidebar header and brand reports.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    {profile?.org_role === "member" && (
                      <p className="text-xs text-amber-500 font-medium">
                        Read-only: Contact an organization owner to change workspace settings.
                      </p>
                    )}
                    <div className="ml-auto">
                      <Button onClick={handleSaveProfile} disabled={savingProfile || profile?.org_role === "member"}>
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
