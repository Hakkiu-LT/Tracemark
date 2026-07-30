"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
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
import { ArrowRight } from "lucide-react";
import { trackLead } from "@/lib/analytics";
import { apiErrorMessage } from "@/lib/api-error";
import { LeadModalShell } from "./lead-modal-shell";
import { LeadSuccess } from "./lead-success";
import { DemoScheduler, type DemoAvailability } from "./demo-scheduler";

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

// Maps to the backend `brand_count_range` field. Values MUST match the CHECK
// constraint on sales_leads ('1','2-3','4-5','6-10','11-20','20+') so the lead
// persists and shows in the Admin Portal "Brands" column + notification email.
const BRAND_COUNT_OPTIONS = [
  { value: "1", label: "1 brand" },
  { value: "2-3", label: "2–3 brands" },
  { value: "4-5", label: "4–5 brands" },
  { value: "6-10", label: "6–10 brands" },
  { value: "11-20", label: "11–20 brands" },
  { value: "20+", label: "20+ brands" },
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
  const [brandCount, setBrandCount] = useState("");
  const [protect, setProtect] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Two-step flow: fill the form, then pick a slot ("Select a Date & Time").
  const [step, setStep] = useState<"form" | "schedule">("form");

  // Step 1 — validate the form, then advance to the scheduler. No POST yet: the
  // lead is only persisted once a slot is chosen so every demo lead has a time.
  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!brandCount) {
      setError("Please tell us how many brands you protect.");
      return;
    }
    if (!protect) {
      setError("Please tell us what you'd like to protect.");
      return;
    }
    setError(null);
    setStep("schedule");
  }

  // Step 2 — POST the lead together with the offered availability, then success.
  async function handleConfirmSlots(availability: DemoAvailability) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "request_demo",
          first_name: firstName,
          last_name: lastName,
          email,
          company,
          website,
          brand_count_range: brandCount || undefined,
          primary_goal: protect && protect !== "Not sure yet" ? [protect] : undefined,
          message: message || undefined,
          proposed_slots: availability.slots,
          scheduled_timezone: availability.timezone,
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
      console.error(err);
      // A network failure throws TypeError ("Failed to fetch") — show a clean
      // message. HTTP errors already carry a friendly apiErrorMessage string.
      setError(
        err instanceof TypeError
          ? "Connection lost — please check your internet and try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      );
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
        setBrandCount("");
        setProtect("");
        setMessage("");
        setError(null);
        setSubmitted(false);
        setStep("form");
      }, 200);
    }
    onOpenChange(v);
  }

  return (
    <LeadModalShell
      open={open}
      onOpenChange={handleClose}
      submitted={submitted}
      eyebrow="Book a demo"
      title={step === "schedule" ? "Pick a time that works." : "See HAKKIU on your channels."}
      subtitle={
        step === "schedule"
          ? "Choose a slot for your 30-minute video walkthrough. We'll confirm it by email."
          : "Tell us what you need to protect. We'll tailor a focused 30-minute walkthrough."
      }
      bullets={
        step === "schedule"
          ? ["30-minute video call", "Tailored to your brand", "Reschedule anytime"]
          : ["No setup fee", "Tailored to your channels", "NDA available"]
      }
      success={
        <LeadSuccess
          illustrationLight="/thank-you-booking-demo-black.webp"
          illustrationDark="/thank-you-booking-demo-white.webp"
          illustrationAlt="Demo request received"
          title="Thank you for booking a demo"
          subtitle="Your request has been received. We'll reach out shortly to confirm a time."
          badge="Demo request submitted"
          onClose={() => handleClose(false)}
        />
      }
    >
      {step === "schedule" ? (
        <DemoScheduler
          onBack={() => {
            setError(null);
            setStep("form");
          }}
          onConfirm={handleConfirmSlots}
          loading={loading}
          error={error}
        />
      ) : (
        <form onSubmit={handleContinue} className="space-y-4">
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
            <Label htmlFor="bd-brands">How many brands do you protect?</Label>
            <Select value={brandCount} onValueChange={setBrandCount} required>
              <SelectTrigger id="bd-brands" className="h-11 w-full rounded-lg">
                <SelectValue placeholder="Select a range" />
              </SelectTrigger>
              <SelectContent>
                {BRAND_COUNT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            className="h-11 w-full rounded-lg bg-foreground font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90"
          >
            Continue to scheduling <ArrowRight className="ml-1.5 h-4 w-4" />
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
      )}
    </LeadModalShell>
  );
}
