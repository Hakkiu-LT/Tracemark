"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
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
import { CheckCircle2, Loader2, Phone } from "lucide-react";

const BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : "http://localhost:8000/api/v1";

const COUNTRY_CODES = [
  { code: "+370", flag: "🇱🇹", label: "LT +370" },
  { code: "+1",   flag: "🇺🇸", label: "US +1" },
  { code: "+44",  flag: "🇬🇧", label: "GB +44" },
  { code: "+49",  flag: "🇩🇪", label: "DE +49" },
  { code: "+33",  flag: "🇫🇷", label: "FR +33" },
  { code: "+48",  flag: "🇵🇱", label: "PL +48" },
  { code: "+46",  flag: "🇸🇪", label: "SE +46" },
  { code: "+31",  flag: "🇳🇱", label: "NL +31" },
  { code: "+34",  flag: "🇪🇸", label: "ES +34" },
  { code: "+39",  flag: "🇮🇹", label: "IT +39" },
];

interface TalkToSalesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TalkToSalesModal({ open, onOpenChange }: TalkToSalesModalProps) {
  const [countryCode, setCountryCode] = useState("+370");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "enterprise",
          source: "call_request",
          email,
          message: `Sales call request. Phone: ${countryCode}${phone}`,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Error ${res.status}`);
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose(v: boolean) {
    if (!v) {
      setPhone("");
      setEmail("");
      setCountryCode("+370");
      setError(null);
      setSubmitted(false);
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm sm:rounded-2xl">
        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
              <CheckCircle2 className="h-7 w-7 text-accent" strokeWidth={2} />
            </div>
            <div>
              <p className="font-display text-lg font-semibold">We'll be in touch</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Expect a call within 1 business day.
              </p>
            </div>
            <Button variant="outline" onClick={() => handleClose(false)} className="mt-2 h-11 w-full rounded-lg">
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="items-center pb-1 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
                <Phone className="h-5 w-5 text-accent" strokeWidth={2} />
              </div>
              <DialogTitle className="font-display text-xl font-semibold tracking-tight">
                Receive a free call from us
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                We'll connect you with the right person.
              </p>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ts-phone">Phone number</Label>
                <div className="flex gap-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="h-11 w-[110px] shrink-0 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_CODES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.flag} {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="ts-phone"
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="612 34567"
                    className="h-11 flex-1 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ts-email">Business email</Label>
                <Input
                  id="ts-email"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="h-11 rounded-lg"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-lg bg-accent font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  "Call me now"
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                By submitting, you agree to be contacted by our sales team.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
