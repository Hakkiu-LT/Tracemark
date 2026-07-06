import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export function NotificationSettingsPanel() {
  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-md animate-fade-in">
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
  );
}
