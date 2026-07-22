"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : "http://localhost:8000/api/v1";

interface RequestPricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: "professional" | "enterprise";
}

export function RequestPricingModal({ open, onOpenChange, tier }: RequestPricingModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [brandCount, setBrandCount] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tierLabel = tier === "professional" ? "Professional" : "Enterprise";
  const ctaLabel = tier === "professional" ? "Book a Demo" : "Contact Sales";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          first_name: firstName,
          last_name: lastName,
          email,
          company,
          brand_count_range: brandCount,
          message: message || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Error ${res.status}`);
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose(v: boolean) {
    if (!v) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setCompany("");
      setBrandCount("");
      setMessage("");
      setError(null);
      setSubmitted(false);
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[oklch(0.58_0.18_255)]/10">
              <CheckCircle2 className="h-7 w-7 text-[oklch(0.58_0.18_255)]" strokeWidth={2} />
            </div>
            <div>
              <p className="text-lg font-semibold">Request received</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We&rsquo;ll reach out within 1 business day.
              </p>
            </div>
            <Button variant="outline" onClick={() => handleClose(false)} className="mt-2 w-full">
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Request a demo — {tierLabel}</DialogTitle>
              <DialogDescription>
                Tell us about your brand protection needs and we&rsquo;ll put together a tailored
                proposal.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="mt-2 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rp-first">First name</Label>
                  <Input
                    id="rp-first"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rp-last">Last name</Label>
                  <Input
                    id="rp-last"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rp-email">Work email</Label>
                <Input
                  id="rp-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rp-company">Company</Label>
                <Input
                  id="rp-company"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Inc."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rp-brands">Number of brands</Label>
                <Select value={brandCount} onValueChange={setBrandCount} required>
                  <SelectTrigger id="rp-brands">
                    <SelectValue placeholder="Select a range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 brand</SelectItem>
                    <SelectItem value="2-3">2–3 brands</SelectItem>
                    <SelectItem value="4-5">4–5 brands</SelectItem>
                    <SelectItem value="6-10">6–10 brands</SelectItem>
                    <SelectItem value="11-20">11–20 brands</SelectItem>
                    <SelectItem value="20+">20+ brands</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rp-message">
                  Message{" "}
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="rp-message"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Any specific requirements, platforms, or questions…"
                  className="resize-none"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                disabled={loading || !brandCount}
                className="w-full bg-[oklch(0.58_0.18_255)] text-white hover:bg-[oklch(0.54_0.18_255)]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  ctaLabel
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
