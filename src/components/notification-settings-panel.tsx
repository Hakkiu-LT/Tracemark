import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { testEmailNotification } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Mail, Loader2, Save, Send } from "lucide-react";

export function NotificationSettingsPanel() {
  const { profile, user } = useAuth();
  const [email, setEmail] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Determine active organization ID, fallback to user ID
  const orgId = profile?.organization_id || user?.id;

  // Sync null organization ID in database if needed
  useEffect(() => {
    if (profile && !profile.organization_id && user?.id && supabase) {
      supabase
        .from("profiles")
        .update({ organization_id: user.id })
        .eq("id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Failed to sync organization_id:", error);
          }
        });
    }
  }, [profile, user]);

  // Load existing settings
  useEffect(() => {
    if (!orgId || !supabase) {
      setIsLoading(false);
      return;
    }

    async function loadSettings() {
      try {
        const { data, error } = await supabase!
          .from("org_settings")
          .select("notification_email")
          .eq("organization_id", orgId)
          .maybeSingle();

        if (error) throw error;

        if (data?.notification_email) {
          setEmail(data.notification_email);
          setTestEmail(data.notification_email);
        } else if (user?.email) {
          // Default to user's email if no settings saved yet
          setEmail(user.email);
          setTestEmail(user.email);
        }
      } catch (err: any) {
        console.error("Error loading notification settings:", err);
        toast.error("Failed to load notification settings");
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [orgId, user?.email]);

  async function handleSave() {
    if (!orgId || !supabase) return;
    if (!email.trim()) {
      toast.error("Notification email cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase!
        .from("org_settings")
        .upsert({
          organization_id: orgId,
          notification_email: email.trim(),
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast.success("Notification settings saved successfully");
    } catch (err: any) {
      console.error("Error saving settings:", err);
      toast.error(err.message || "Failed to save notification settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    const targetEmail = testEmail.trim() || email.trim();
    if (!targetEmail) {
      toast.error("Please enter a valid email to send a test message");
      return;
    }

    setIsTesting(true);
    try {
      const res = await testEmailNotification(targetEmail);
      if (res.success) {
        toast.success(res.message || `Test email dispatched to ${targetEmail}`);
      } else {
        toast.error(res.message || "Failed to send test email");
      }
    } catch (err: any) {
      console.error("Error sending test email:", err);
      toast.error(err.message || "SMTP connection failed. Check your backend env variables.");
    } finally {
      setIsTesting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border/40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/40 bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Mail className="h-5 w-5 text-accent" />
            Alert Recipients
          </CardTitle>
          <CardDescription>
            Configure where automated alerts and system notifications are sent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="notification-email">Notification Email Address</Label>
            <div className="flex max-w-md gap-3">
              <Input
                id="notification-email"
                type="email"
                placeholder="alerts@yourdomain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50"
              />
              <Button onClick={handleSave} disabled={isSaving} className="shrink-0">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This address will receive high-risk detection summaries and critical system status updates.
            </p>
          </div>

          <div className="border-t border-border/40 pt-4 space-y-4">
            <div>
              <h4 className="text-sm font-semibold">SMTP Connection Test</h4>
              <p className="text-xs text-muted-foreground">
                Verify that your SMTP setup is dispatching emails correctly by sending a mock alert.
              </p>
            </div>
            <div className="flex max-w-md gap-3">
              <Input
                type="email"
                placeholder="test@yourdomain.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="bg-background/50"
              />
              <Button variant="outline" onClick={handleTest} disabled={isTesting} className="shrink-0">
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-base">Alert Preferences</CardTitle>
          <CardDescription>
            Tailor system notification triggers and frequencies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            ["High-risk detections", "Email + in-app, immediate notifications on potential violations", true],
            ["Medium-risk detections", "Daily compiled email digest", true],
            ["Low-risk detections", "Weekly compiled email summary", false],
            ["Takedown status updates", "In-app notifications for status transition audits", true],
          ].map(([title, desc, isChecked]) => (
            <div key={title as string} className="flex items-center justify-between border-b border-border/30 pb-3 last:border-0 last:pb-0">
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch defaultChecked={isChecked as boolean} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
