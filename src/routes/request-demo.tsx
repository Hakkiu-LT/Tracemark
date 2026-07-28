import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight, ArrowLeft, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { HakkiuLogo } from "@/components/hakkiu-logo";
import { trackLead } from "@/lib/analytics";

const BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : "http://localhost:8000/api/v1";

export const Route = createFileRoute("/request-demo")({
  head: () => ({
    meta: [
      { title: "Request a Demo — HAKKIU" },
      { name: "description", content: "Book a platform demo or get a free sales call." },
    ],
  }),
  component: RequestDemoPage,
});

type DemoType = "demo" | "sales";

interface FormData {
  type: DemoType | null;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  regions: string[];
  brandCount: string;
  brandNames: string;
  marketplaces: string[];
  currentSolution: string;
  primaryGoal: string[];
  message: string;
}

const BRAND_COUNT_OPTIONS = [
  { value: "1",     label: "1 brand" },
  { value: "2-3",   label: "2–3 brands" },
  { value: "4-5",   label: "4–5 brands" },
  { value: "6-10",  label: "6–10 brands" },
  { value: "11-20", label: "11–20 brands" },
  { value: "20+",   label: "20+ brands" },
];

const REGION_OPTIONS = [
  "North America", "Europe", "UK", "Asia-Pacific",
  "Latin America", "Middle East & Africa", "Global",
];

const MARKETPLACE_OPTIONS = [
  "Amazon", "eBay", "Alibaba", "AliExpress", "DHgate", "Temu",
  "Etsy", "Walmart", "Shopify stores", "Social media", "Standalone websites", "Other",
];

const CURRENT_SOLUTION_OPTIONS = [
  "Nothing yet", "In-house team", "Law firm / agency", "Another software tool", "Other",
];

const PRIMARY_GOAL_OPTIONS = [
  "Counterfeit products", "Unauthorized sellers", "Trademark / logo abuse",
  "Marketplace takedowns", "Domain / website abuse", "Social media impersonation",
];

const TOTAL_STEPS = 6; // type → you → contact → company → brands → needs

function RequestDemoPage() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [visible, setVisible] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    type: null,
    firstName: "",
    lastName: "",
    role: "",
    email: "",
    phone: "",
    company: "",
    website: "",
    regions: [],
    brandCount: "",
    brandNames: "",
    marketplaces: [],
    currentSolution: "",
    primaryGoal: [],
    message: "",
  });

  function patch(updates: Partial<FormData>) {
    setForm((f) => ({ ...f, ...updates }));
  }

  function canAdvance() {
    if (step === 0) return form.type !== null;
    if (step === 1) return form.firstName.trim() !== "" && form.lastName.trim() !== "" && form.role.trim() !== "";
    if (step === 2) return form.email.trim() !== "" && form.email.includes("@");
    if (step === 3) return form.company.trim() !== "" && form.website.trim() !== "";
    if (step === 4) return form.brandCount !== "";
    if (step === 5) return true; // final step — everything here is optional
    return false;
  }

  function transition(toStep: number, dir: "forward" | "back") {
    setDirection(dir);
    setVisible(false);
    setTimeout(() => {
      setStep(toStep);
      setVisible(true);
    }, 220);
  }

  function advance() {
    if (!canAdvance()) return;
    if (step < TOTAL_STEPS - 1) {
      transition(step + 1, "forward");
    } else {
      handleSubmit();
    }
  }

  function back() {
    if (step > 0) transition(step - 1, "back");
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: form.type === "sales" ? "enterprise" : "professional",
          source: "request_demo",
          first_name: form.firstName,
          last_name: form.lastName,
          role: form.role,
          email: form.email,
          phone: form.phone || undefined,
          company: form.company,
          website: form.website,
          regions: form.regions.length ? form.regions : undefined,
          brand_count_range: form.brandCount,
          brand_names: form.brandNames || undefined,
          marketplaces: form.marketplaces.length ? form.marketplaces : undefined,
          current_solution: form.currentSolution || undefined,
          primary_goal: form.primaryGoal.length ? form.primaryGoal : undefined,
          message: form.message || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Error ${res.status}`);
      }
      setSubmitted(true);
      // GA4 conversion — fires only if the visitor consented to analytics.
      trackLead({ source: "request_demo", leadType: form.type ?? "demo" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  // Allow Enter key to advance (but not from a textarea — Shift already excluded)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "TEXTAREA") return;
      if (e.key === "Enter" && !e.shiftKey && !submitted) {
        if (canAdvance()) advance();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="relative flex min-h-screen flex-col bg-[oklch(0.13_0.04_262)] text-white">
      {/* Top bar */}
      <header className="flex h-16 items-center justify-between px-8">
        <HakkiuLogo className="h-7 text-white" />
        <Button asChild variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/10 rounded-full">
          <Link to="/landing">
            <X className="h-5 w-5" />
          </Link>
        </Button>
      </header>

      {/* Progress bar */}
      {!submitted && (
        <div className="absolute top-16 left-0 right-0 h-0.5 bg-white/10">
          <div
            className="h-full bg-[oklch(0.58_0.18_255)] transition-all duration-500"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        {submitted ? (
          <SuccessScreen form={form} />
        ) : (
          <div
            className={cn(
              "w-full max-w-xl transition-all duration-220",
              visible
                ? "opacity-100 translate-y-0"
                : direction === "forward"
                  ? "opacity-0 translate-y-4"
                  : "opacity-0 -translate-y-4",
            )}
            style={{ transitionDuration: "220ms" }}
          >
            <StepContent
              step={step}
              form={form}
              patch={patch}
              advance={advance}
              canAdvance={canAdvance()}
              loading={loading}
              error={error}
            />
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      {!submitted && (
        <footer className="flex items-center justify-between px-8 py-6">
          <button
            onClick={back}
            className={cn(
              "flex items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white",
              step === 0 && "invisible",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === step
                    ? "w-6 bg-[oklch(0.58_0.18_255)]"
                    : i < step
                      ? "w-1.5 bg-white/50"
                      : "w-1.5 bg-white/20",
                )}
              />
            ))}
          </div>

          <span className="text-xs text-white/30">
            {step + 1} / {TOTAL_STEPS}
          </span>
        </footer>
      )}
    </div>
  );
}

// ── Step renderer ─────────────────────────────────────────────────────────────

function StepContent({
  step, form, patch, advance, canAdvance, loading, error,
}: {
  step: number;
  form: FormData;
  patch: (u: Partial<FormData>) => void;
  advance: () => void;
  canAdvance: boolean;
  loading: boolean;
  error: string | null;
}) {
  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <div className="space-y-8">
      {step === 0 && <Step0 form={form} patch={patch} />}
      {step === 1 && <Step1 form={form} patch={patch} />}
      {step === 2 && <Step2 form={form} patch={patch} />}
      {step === 3 && <Step3 form={form} patch={patch} />}
      {step === 4 && <Step4 form={form} patch={patch} />}
      {step === 5 && <Step5 form={form} patch={patch} />}

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <div className="flex items-center gap-4">
        <Button
          onClick={advance}
          disabled={!canAdvance || loading}
          className={cn(
            "h-12 gap-2 rounded-xl px-7 text-base font-semibold transition-all",
            canAdvance
              ? "bg-[oklch(0.58_0.18_255)] text-white hover:bg-[oklch(0.54_0.18_255)] shadow-lg shadow-[oklch(0.58_0.18_255/0.3)]"
              : "bg-white/10 text-white/40 cursor-not-allowed",
          )}
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
          ) : isLastStep ? (
            <>Submit <ArrowRight className="h-4 w-4" /></>
          ) : (
            <>OK <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>
        <span className="text-sm text-white/30">
          press <kbd className="rounded border border-white/20 px-1.5 py-0.5 text-xs font-mono">Enter ↵</kbd>
        </span>
      </div>
    </div>
  );
}

// ── Step 0 — Type selection ───────────────────────────────────────────────────

function Step0({ form, patch }: { form: FormData; patch: (u: Partial<FormData>) => void }) {
  const options: { value: DemoType; title: string; desc: string }[] = [
    { value: "demo",  title: "I'd like to request a platform demo", desc: "See HAKKIU in action with a guided walkthrough" },
    { value: "sales", title: "I'd like a free call from Sales",     desc: "Talk to our team about your specific needs and pricing" },
  ];

  return (
    <div>
      <QuestionLabel n={1} />
      <h2 className="mt-3 font-display text-3xl font-bold leading-snug md:text-4xl">
        How can we help you today?
      </h2>
      <p className="mt-2 text-white/60">We'll connect you with the right person.</p>
      <div className="mt-8 space-y-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => patch({ type: opt.value })}
            className={cn(
              "flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all",
              form.type === opt.value
                ? "border-[oklch(0.58_0.18_255)] bg-[oklch(0.58_0.18_255)]/15"
                : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/8",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                form.type === opt.value
                  ? "border-[oklch(0.58_0.18_255)] bg-[oklch(0.58_0.18_255)]"
                  : "border-white/30",
              )}
            >
              {form.type === opt.value && <span className="h-2 w-2 rounded-full bg-white" />}
            </span>
            <div>
              <p className="font-semibold">{opt.title}</p>
              <p className="mt-0.5 text-sm text-white/60">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 1 — Name + role ──────────────────────────────────────────────────────

function Step1({ form, patch }: { form: FormData; patch: (u: Partial<FormData>) => void }) {
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);

  return (
    <div>
      <QuestionLabel n={2} />
      <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">
        Let's start with your name
      </h2>
      <div className="mt-8 grid grid-cols-2 gap-4">
        <DemoInput
          ref={firstRef}
          placeholder="First name"
          value={form.firstName}
          onChange={(v) => patch({ firstName: v })}
          required
        />
        <DemoInput
          placeholder="Last name"
          value={form.lastName}
          onChange={(v) => patch({ lastName: v })}
          required
        />
      </div>
      <div className="mt-4">
        <FieldLabel>Your role</FieldLabel>
        <DemoInput
          placeholder="e.g. Brand Manager, Legal Counsel, Founder"
          value={form.role}
          onChange={(v) => patch({ role: v })}
          required
        />
      </div>
    </div>
  );
}

// ── Step 2 — Email + phone ──────────────────────────────────────────────────────

function Step2({ form, patch }: { form: FormData; patch: (u: Partial<FormData>) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div>
      <QuestionLabel n={3} />
      <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">
        How can we reach you?
      </h2>
      <p className="mt-2 text-white/60">
        By clicking OK, your data will be used to respond to your request.
      </p>
      <div className="mt-8 space-y-4">
        <div>
          <FieldLabel>Business email</FieldLabel>
          <DemoInput
            ref={ref}
            type="email"
            placeholder="name@company.com"
            value={form.email}
            onChange={(v) => patch({ email: v })}
            required
          />
        </div>
        <div>
          <FieldLabel optional>Phone number</FieldLabel>
          <DemoInput
            type="tel"
            placeholder="+1 555 000 0000"
            value={form.phone}
            onChange={(v) => patch({ phone: v })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 3 — Company + website + regions ────────────────────────────────────────

function Step3({ form, patch }: { form: FormData; patch: (u: Partial<FormData>) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div>
      <QuestionLabel n={4} />
      <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">
        Tell us about your company
      </h2>
      <div className="mt-8 space-y-4">
        <div>
          <FieldLabel>Company name</FieldLabel>
          <DemoInput
            ref={ref}
            placeholder="Company name"
            value={form.company}
            onChange={(v) => patch({ company: v })}
            required
          />
        </div>
        <div>
          <FieldLabel>Website</FieldLabel>
          <DemoInput
            type="text"
            placeholder="company.com"
            value={form.website}
            onChange={(v) => patch({ website: v })}
            required
          />
          <p className="mt-1.5 text-xs text-white/40">
            Helps us research your brand before the call.
          </p>
        </div>
        <div>
          <FieldLabel optional>Markets you sell in</FieldLabel>
          <ChipGroup
            options={REGION_OPTIONS.map((r) => ({ value: r, label: r }))}
            selected={form.regions}
            multi
            onToggle={(v) => patch({ regions: toggle(form.regions, v) })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 4 — Brands ─────────────────────────────────────────────────────────────

function Step4({ form, patch }: { form: FormData; patch: (u: Partial<FormData>) => void }) {
  return (
    <div>
      <QuestionLabel n={5} />
      <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">
        Tell us about your brands
      </h2>
      <div className="mt-8 space-y-5">
        <div>
          <FieldLabel>Number of brands you protect</FieldLabel>
          <ChipGroup
            options={BRAND_COUNT_OPTIONS}
            selected={form.brandCount ? [form.brandCount] : []}
            onToggle={(v) => patch({ brandCount: v })}
          />
        </div>
        <div>
          <FieldLabel optional>Brand / product names</FieldLabel>
          <DemoInput
            placeholder="e.g. Acme, Acme Pro, SuperWidget"
            value={form.brandNames}
            onChange={(v) => patch({ brandNames: v })}
          />
          <p className="mt-1.5 text-xs text-white/40">
            We can pre-scan these before your demo.
          </p>
        </div>
        <div>
          <FieldLabel optional>Where do you see infringement?</FieldLabel>
          <ChipGroup
            options={MARKETPLACE_OPTIONS.map((m) => ({ value: m, label: m }))}
            selected={form.marketplaces}
            multi
            onToggle={(v) => patch({ marketplaces: toggle(form.marketplaces, v) })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 5 — Needs ───────────────────────────────────────────────────────────────

function Step5({ form, patch }: { form: FormData; patch: (u: Partial<FormData>) => void }) {
  return (
    <div>
      <QuestionLabel n={6} />
      <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">
        What are you trying to solve?
      </h2>
      <div className="mt-8 space-y-5">
        <div>
          <FieldLabel optional>Primary goals</FieldLabel>
          <ChipGroup
            options={PRIMARY_GOAL_OPTIONS.map((g) => ({ value: g, label: g }))}
            selected={form.primaryGoal}
            multi
            onToggle={(v) => patch({ primaryGoal: toggle(form.primaryGoal, v) })}
          />
        </div>
        <div>
          <FieldLabel optional>How do you handle this today?</FieldLabel>
          <ChipGroup
            options={CURRENT_SOLUTION_OPTIONS.map((s) => ({ value: s, label: s }))}
            selected={form.currentSolution ? [form.currentSolution] : []}
            onToggle={(v) => patch({ currentSolution: v })}
          />
        </div>
        <div>
          <FieldLabel optional>Anything specific we should know?</FieldLabel>
          <DemoTextarea
            placeholder="Context, timeline, specific concerns…"
            value={form.message}
            onChange={(v) => patch({ message: v })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({ form }: { form: FormData }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[oklch(0.58_0.18_255)]/15 ring-1 ring-[oklch(0.58_0.18_255)]/30">
        <CheckCircle2 className="h-10 w-10 text-[oklch(0.58_0.18_255)]" strokeWidth={1.75} />
      </div>
      <div>
        <h2 className="font-display text-4xl font-bold">
          {form.type === "sales" ? "We'll call you soon" : "Demo booked!"}
        </h2>
        <p className="mt-3 text-lg text-white/60">
          Thanks{form.firstName ? `, ${form.firstName}` : ""}. We'll reach out within 1 business day.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 pt-2">
        <Button asChild className="h-12 gap-2 rounded-xl bg-[oklch(0.58_0.18_255)] px-6 hover:bg-[oklch(0.54_0.18_255)]">
          <Link to="/landing">
            Back to home
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-12 gap-2 rounded-xl border-white/25 bg-white/5 px-6 text-white hover:border-white/40 hover:bg-white/10 hover:text-white">
          <Link to="/landing" hash="features">
            Explore features
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function toggle(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function QuestionLabel({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm font-bold text-[oklch(0.58_0.18_255)]">{n}</span>
      <span className="font-mono text-sm text-white/30">→</span>
      <span className="text-xs text-white/30">{n} of {TOTAL_STEPS}</span>
    </div>
  );
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <p className="mb-2 text-sm font-medium text-white/70">
      {children}
      {optional && <span className="ml-1.5 text-xs font-normal text-white/30">(optional)</span>}
    </p>
  );
}

function ChipGroup({
  options, selected, onToggle, multi,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  multi?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" role={multi ? "group" : "radiogroup"}>
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(opt.value)}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-[oklch(0.58_0.18_255)] bg-[oklch(0.58_0.18_255)]/15 text-white"
                : "border-white/20 bg-white/5 text-white/70 hover:border-white/40",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const DemoInput = ({ ref: _ref, ...props }: {
  ref?: React.Ref<HTMLInputElement>;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) => (
  <Input
    ref={_ref as React.Ref<HTMLInputElement>}
    type={props.type ?? "text"}
    placeholder={props.placeholder}
    value={props.value}
    onChange={(e) => props.onChange(e.target.value)}
    required={props.required}
    className="h-14 rounded-xl border-white/20 bg-white/8 text-base text-white placeholder:text-white/30 focus:border-[oklch(0.58_0.18_255)] focus:ring-[oklch(0.58_0.18_255)]/30"
  />
);

function DemoTextarea({ placeholder, value, onChange }: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className="w-full resize-none rounded-xl border border-white/20 bg-white/8 px-4 py-3.5 text-base text-white placeholder:text-white/30 outline-none focus:border-[oklch(0.58_0.18_255)] focus:ring-2 focus:ring-[oklch(0.58_0.18_255)]/20 transition-colors"
    />
  );
}
