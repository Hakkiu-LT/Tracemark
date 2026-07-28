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
import { Clock, Loader2 } from "lucide-react";
import { trackLead } from "@/lib/analytics";
import { apiErrorMessage } from "@/lib/api-error";
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
  const [interest, setInterest] = useState("");
  const [help, setHelp] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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
        setInterest("");
        setHelp("");
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
            illustrationLight="/thank-you-contacting-us-black.webp"
            illustrationDark="/thank-you-contacting-us-white.webp"
            illustrationAlt="Message received"
            title="Thank you for contacting us"
            subtitle="Your message has been received. Our team will get back to you within one business day."
            badge="Message delivered"
            onClose={() => handleClose(false)}
          />
        ) : (
          <>
            <DialogHeader className="space-y-2 pb-1 text-left">
              <DialogTitle className="font-display text-2xl font-semibold tracking-tight">
                Talk to sales
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Tell us what you need and our team will get back to you.
              </DialogDescription>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-0.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-emerald-500" />
                  Typically replies within one business day
                </span>
              </div>
            </DialogHeader>

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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
