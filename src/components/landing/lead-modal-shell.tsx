"use client";

import type { ReactNode } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { HakkiuLogo } from "@/components/hakkiu-logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface LeadModalShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, render the success screen (single column) instead of the form. */
  submitted: boolean;
  success: ReactNode;
  /** Small mono label above the heading, e.g. "Book a demo". */
  eyebrow: string;
  /** Left-panel heading (also the accessible dialog title). */
  title: string;
  /** Left-panel supporting line (also the accessible description). */
  subtitle: string;
  /** Reassurance checklist shown under the heading (desktop only). */
  bullets: string[];
  /** The form for this modal — its fields are passed through untouched. */
  children: ReactNode;
}

/**
 * Shared two-column shell for the lead-capture modals (Book a demo / Request a
 * call). The left panel carries the brand + value props; the right panel holds
 * each modal's own form, unchanged. On success the shell collapses to a single
 * centered column so the shared `LeadSuccess` screen reads the same as before.
 *
 * Fields, validation, and submit logic all stay in the individual modals — this
 * component is purely the frame around them.
 */
export function LeadModalShell({
  open,
  onOpenChange,
  submitted,
  success,
  eyebrow,
  title,
  subtitle,
  bullets,
  children,
}: LeadModalShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden border bg-card p-0",
          submitted
            ? "sm:max-w-[560px] sm:rounded-3xl"
            : "sm:max-w-3xl sm:rounded-2xl",
        )}
      >
        {submitted ? (
          <div className="p-6">{success}</div>
        ) : (
          <div className="grid md:grid-cols-[0.85fr_1.15fr]">
            {/* Left — branded panel */}
            <div className="relative flex flex-col justify-between gap-6 overflow-hidden border-b border-border/60 bg-gradient-to-b from-muted/70 to-muted/25 p-6 sm:p-7 md:border-b-0 md:border-r">
              {/* faint blueprint dots for depth (decorative) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                  backgroundImage:
                    "radial-gradient(rgba(71,85,105,0.14) 1px, transparent 0)",
                  backgroundSize: "16px 16px",
                  maskImage:
                    "linear-gradient(to bottom, black, transparent 90%)",
                }}
              />

              <div className="relative flex items-center gap-2.5">
                <HakkiuLogo className="h-3.5 text-foreground" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {eyebrow}
                </span>
              </div>

              <div className="relative space-y-3">
                <DialogTitle className="font-display text-3xl font-bold leading-[1.08] tracking-tight text-foreground">
                  {title}
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                  {subtitle}
                </DialogDescription>
              </div>

              <ul className="relative hidden space-y-2.5 md:block">
                {bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2.5 text-sm text-foreground">
                    <CheckCircle2
                      className="h-4 w-4 shrink-0"
                      style={{ color: "var(--mint, #18c889)" }}
                    />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — the form (fields untouched) */}
            <div className="p-6 sm:p-7">
              {children}
              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Your information is handled securely.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
