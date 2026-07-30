"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Clock, Globe, Loader2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

/** The visitor's offered availability, ready to POST alongside the lead form. */
export interface DemoAvailability {
  /** UTC instants (ISO) the visitor is available — one per picked day+time. */
  slots: string[];
  /** IANA timezone the visitor picked in (their browser tz). */
  timezone: string;
  /** Human label for the animated confirmation screen. */
  label: string;
}

// Bookable window: 09:00–17:00, 30-minute slots. It's a *request* (staff pick one
// later), so every slot is offered — we only hide slots already in the past today.
const SLOT_START_HOUR = 9;
const SLOT_END_HOUR = 17; // exclusive — last slot is 16:30
function buildSlots(): { value: string; h: number; m: number }[] {
  const out: { value: string; h: number; m: number }[] = [];
  for (let h = SLOT_START_HOUR; h < SLOT_END_HOUR; h++) {
    for (const m of [0, 30]) {
      out.push({ value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, h, m });
    }
  }
  return out;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** ISO (UTC) for a chosen local wall-clock day+time in the browser's timezone. */
function slotIso(day: Date, h: number, m: number) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0).toISOString();
}

/** Short chip label, e.g. "Tue 13 Aug · 10:00". */
function chipLabel(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Calendly-style "Select a Date & Time" step shown between the Book-a-demo form
 * and the shared success animation. The visitor can pick SEVERAL day+time slots
 * they're free; staff later confirm the one that suits us. Each slot's local
 * wall-clock time is stored as a UTC instant (their browser tz is captured so
 * staff/emails can render it back in local time).
 */
export function DemoScheduler({
  onBack,
  onConfirm,
  loading,
  error,
}: {
  onBack: () => void;
  onConfirm: (availability: DemoAvailability) => void;
  loading: boolean;
  error: string | null;
}) {
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const times = useMemo(buildSlots, []);
  const [day, setDay] = useState<Date | undefined>(undefined);
  // Set of chosen slots, keyed by their UTC ISO string (unique per day+time).
  const [selected, setSelected] = useState<string[]>([]);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isToday = day ? sameDay(day, now) : false;

  function slotPassed(h: number, m: number) {
    if (!isToday) return false;
    return h < now.getHours() || (h === now.getHours() && m <= now.getMinutes());
  }

  function toggle(iso: string) {
    setSelected((prev) => (prev.includes(iso) ? prev.filter((s) => s !== iso) : [...prev, iso]));
  }

  const sortedSelected = useMemo(() => [...selected].sort(), [selected]);

  function handleConfirm() {
    if (selected.length === 0) return;
    const label = selected.length === 1 ? chipLabel(sortedSelected[0]) : `${selected.length} times`;
    onConfirm({ slots: sortedSelected, timezone, label });
  }

  return (
    <div className="space-y-4">
      {/* Meeting summary — mirrors the Calendly "Product Demo · 30 min · Video" header */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-4 w-4" /> 30 min
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Video className="h-4 w-4" /> Video call
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        Pick <strong className="text-foreground">every time you're free</strong> — we'll confirm the
        one that works best for both of us.
      </p>

      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        {/* Calendar */}
        <div className="flex justify-center rounded-xl border border-border/70 bg-background p-1 sm:justify-start">
          <Calendar
            mode="single"
            selected={day}
            onSelect={setDay}
            startMonth={today}
            disabled={[{ before: today }, { dayOfWeek: [0, 6] }]}
            className="p-2"
          />
        </div>

        {/* Time slots — appear once a day is chosen; clicking toggles the slot */}
        <div className="min-w-0">
          {day ? (
            <>
              <div className="mb-2 text-sm font-medium text-foreground">
                {day.toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </div>
              <div className="grid max-h-[220px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {times.map((s) => {
                  const passed = slotPassed(s.h, s.m);
                  const iso = slotIso(day, s.h, s.m);
                  const active = selected.includes(iso);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      disabled={passed}
                      onClick={() => toggle(iso)}
                      className={cn(
                        "h-10 rounded-lg border text-sm font-medium transition-colors",
                        passed && "cursor-not-allowed border-border/50 text-muted-foreground/40",
                        !passed &&
                          !active &&
                          "border-border text-foreground hover:border-foreground/40 hover:bg-muted",
                        active && "border-foreground bg-foreground text-background",
                      )}
                    >
                      {s.value}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[160px] items-center justify-center rounded-xl border border-dashed border-border/70 p-4 text-center text-sm text-muted-foreground">
              Pick a day to add available times.
            </div>
          )}
        </div>
      </div>

      {/* Selected availability — removable chips across all chosen days */}
      {sortedSelected.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your availability ({sortedSelected.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {sortedSelected.map((iso) => (
              <span
                key={iso}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground"
              >
                {chipLabel(iso)}
                <button
                  type="button"
                  onClick={() => toggle(iso)}
                  aria-label={`Remove ${chipLabel(iso)}`}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timezone note — matches the mockup's "Time zone" line */}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Globe className="h-3.5 w-3.5" />
        Times shown in your timezone ({timezone}).
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="h-11 rounded-lg"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={sortedSelected.length === 0 || loading}
          className="h-11 flex-1 rounded-lg bg-foreground font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Booking…
            </>
          ) : (
            <>
              {sortedSelected.length > 1 ? `Send ${sortedSelected.length} times` : "Confirm demo"}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
