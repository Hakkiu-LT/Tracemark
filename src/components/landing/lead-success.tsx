"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Shared "thank you" view shown inside the Book-a-demo / Talk-to-sales modals
 * after a successful submission. Driven entirely by props so both modals share
 * one animated layout (illustration → title → subtitle → green badge → CTA).
 */
export function LeadSuccess({
  illustrationLight,
  illustrationDark,
  illustrationAlt,
  title,
  subtitle,
  badge,
  onClose,
}: {
  /** Dark-on-transparent art — shown in light theme. */
  illustrationLight: string;
  /** Light-on-transparent art — shown in dark theme. */
  illustrationDark: string;
  illustrationAlt: string;
  title: string;
  subtitle: string;
  badge: string;
  onClose: () => void;
}) {
  const imgClass =
    "mx-auto h-36 w-auto max-w-full select-none sm:h-48 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-500";

  return (
    <div className="flex flex-col items-center gap-2.5 text-center">
      {/* Accessible name/description for the dialog (Radix requires both). */}
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <DialogDescription className="sr-only">{subtitle}</DialogDescription>

      {/* Two theme variants; CSS shows exactly one via the `.dark` class on <html>. */}
      <img src={illustrationLight} alt={illustrationAlt} className={`${imgClass} block dark:hidden`} />
      <img src={illustrationDark} alt="" aria-hidden className={`${imgClass} hidden dark:block`} />

      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:delay-100">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      </div>

      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-500 motion-safe:delay-200 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        {badge}
      </span>

      <Button
        onClick={onClose}
        className="mt-0.5 h-[52px] w-full rounded-xl bg-foreground font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90 sm:h-14"
      >
        Back to HAKKIU
      </Button>

      <p className="text-xs text-muted-foreground">Check your inbox for a confirmation.</p>
    </div>
  );
}
