"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import { trackLead } from "@/lib/analytics";
import { apiErrorMessage } from "@/lib/api-error";
import { LeadSuccess } from "./lead-success";

const BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : "http://localhost:8000/api/v1";

// Maps to the backend `primary_goal` field. Single-select keeps the modal
// compact (matches the mockup); it is still stored as an array server-side.
const PROTECT_OPTIONS = [
  "Counterfeit products",
  "Unauthorized / grey-market sellers",
  "Trademark & logo abuse",
  "Marketplace listings",
  "Domains & websites",
  "Social media impersonation",
  "Not sure yet",
];

interface BookDemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookDemoModal({ open, onOpenChange }: BookDemoModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [protect, setProtect] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!protect) {
      setError("Please tell us what you'd like to protect.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "professional",
          source: "request_demo",
          first_name: firstName,
          last_name: lastName,
          email,
          company,
          website,
          primary_goal: protect && protect !== "Not sure yet" ? [protect] : undefined,
          message: message || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(apiErrorMessage(data, res.status));
      }
      setSubmitted(true);
      // GA4 conversion — fires only if the visitor consented to analytics.
      trackLead({ source: "request_demo", leadType: "demo" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose(v: boolean) {
    if (!v) {
      // Reset only after the close animation so the form doesn't flicker.
      setTimeout(() => {
        setFirstName("");
        setLastName("");
        setEmail("");
        setCompany("");
        setWebsite("");
        setProtect("");
        setMessage("");
        setError(null);
        setSubmitted(false);
      }, 200);
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={submitted ? "sm:max-w-[560px] sm:rounded-3xl" : "sm:max-w-lg sm:rounded-2xl"}
      >
        {submitted ? (
          <LeadSuccess
            illustrationLight="/thank-you-booking-demo-black.webp"
            illustrationDark="/thank-you-booking-demo-white.webp"
            illustrationAlt="Demo request received"
            title="Thank you for booking a demo"
            subtitle="Your request has been received. We'll reach out shortly to confirm a time."
            badge="Demo request submitted"
            onClose={() => handleClose(false)}
          />
        ) : (
          <>
            <DialogHeader className="space-y-2 pb-1 text-left">
              <DialogTitle className="font-display text-2xl font-semibold tracking-tight">
                Book a demo
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                See how HAKKIU protects your brand across every marketplace.
              </DialogDescription>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-0.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarCheck className="h-3.5 w-3.5 text-emerald-500" />
                  30-minute walkthrough
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  No commitment
                </span>
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bd-first">First name</Label>
                  <Input
                    id="bd-first"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bd-last">Last name</Label>
                  <Input
                    id="bd-last"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="h-11 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bd-email">Work email</Label>
                  <Input
                    id="bd-email"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@company.com"
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bd-company">Company</Label>
                  <Input
                    id="bd-company"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company name"
                    className="h-11 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bd-website">Company website</Label>
                <Input
                  id="bd-website"
                  required
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="company.com"
                  className="h-11 rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bd-protect">What would you like to protect?</Label>
                <Select value={protect} onValueChange={setProtect} required>
                  <SelectTrigger id="bd-protect" className="h-11 w-full rounded-lg">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROTECT_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bd-message">
                  Anything we should know?{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <textarea
                  id="bd-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  placeholder="Context, timeline, specific concerns…"
                  className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-lg bg-foreground font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    Book my demo <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                By continuing, you agree to our{" "}
                <Link
                  to="/legal/privacy"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
