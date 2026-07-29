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
import { Loader2 } from "lucide-react";
import { trackLead } from "@/lib/analytics";
import { apiErrorMessage } from "@/lib/api-error";
import { LeadModalShell } from "./lead-modal-shell";
import { LeadSuccess } from "./lead-success";

const BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : "http://localhost:8000/api/v1";

const INTEREST_OPTIONS = [
  "Pricing & plans",
  "Platform demo",
  "Enterprise / high volume",
  "Partnership",
  "Something else",
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

interface TalkToSalesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TalkToSalesModal({ open, onOpenChange }: TalkToSalesModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [brandCount, setBrandCount] = useState("");
  const [interest, setInterest] = useState("");
  const [help, setHelp] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandCount) {
      setError("Please tell us how many brands you protect.");
      return;
    }
    if (!interest) {
      setError("Please tell us what you're interested in.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const message = `Interested in: ${interest}\n\n${help}`.trim();
      const res = await fetch(`${BASE}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "enterprise",
          source: "call_request",
          first_name: firstName,
          last_name: lastName,
          email,
          company,
          phone,
          brand_count_range: brandCount || undefined,
          message,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(apiErrorMessage(data, res.status));
      }
      setSubmitted(true);
      // GA4 conversion — fires only if the visitor consented to analytics.
      trackLead({ source: "call_request", leadType: "sales" });
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
      setTimeout(() => {
        setFirstName("");
        setLastName("");
        setEmail("");
        setCompany("");
        setPhone("");
        setBrandCount("");
        setInterest("");
        setHelp("");
        setError(null);
        setSubmitted(false);
      }, 200);
    }
    onOpenChange(v);
  }

  return (
    <LeadModalShell
      open={open}
      onOpenChange={handleClose}
      submitted={submitted}
      eyebrow="Request a call"
      title="Talk to our team."
      subtitle="Tell us what you need and our team will get back to you within one business day."
      bullets={["Replies within one business day", "Direct line to a specialist", "No commitment"]}
      success={
        <LeadSuccess
          illustrationLight="/thank-you-contacting-us-black.webp"
          illustrationDark="/thank-you-contacting-us-white.webp"
          illustrationAlt="Message received"
          title="Thank you for contacting us"
          subtitle="Your message has been received. Our team will get back to you within one business day."
          badge="Message delivered"
          onClose={() => handleClose(false)}
        />
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ts-first">First name</Label>
                  <Input
                    id="ts-first"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ts-last">Last name</Label>
                  <Input
                    id="ts-last"
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
                  <Label htmlFor="ts-email">Work email</Label>
                  <Input
                    id="ts-email"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@company.com"
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ts-company">Company</Label>
                  <Input
                    id="ts-company"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company name"
                    className="h-11 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ts-phone">Phone number</Label>
                <Input
                  id="ts-phone"
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+370 600 00000"
                  className="h-11 rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ts-brands">How many brands do you protect?</Label>
                <Select value={brandCount} onValueChange={setBrandCount} required>
                  <SelectTrigger id="ts-brands" className="h-11 w-full rounded-lg">
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
                <Label htmlFor="ts-interest">I'm interested in</Label>
                <Select value={interest} onValueChange={setInterest} required>
                  <SelectTrigger id="ts-interest" className="h-11 w-full rounded-lg">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTEREST_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ts-help">How can we help?</Label>
                <textarea
                  id="ts-help"
                  required
                  value={help}
                  onChange={(e) => setHelp(e.target.value)}
                  rows={3}
                  placeholder="Tell us about your brand protection needs…"
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
                  "Send message"
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                By submitting, you agree to our{" "}
                <Link
                  to="/legal/privacy"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Privacy Policy
                </Link>
                .
              </p>
      </form>
    </LeadModalShell>
  );
}
