import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import bgUrl from "./bg.png?url";
import DotField from "./dot-field";

const ACCENT = "oklch(0.58 0.18 255)";

/** Fires once when the element first scrolls into view. */
function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          ob.disconnect();
        }
      },
      { threshold },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [inView, threshold]);
  return { ref, inView };
}

/** True when the user has asked the OS to minimize motion. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function CTA() {
  const { ref, inView } = useInView<HTMLElement>();
  const reduced = usePrefersReducedMotion();

  return (
    <section ref={ref} className="relative overflow-hidden border-b border-border bg-background px-6 py-16 md:py-20">
      <div
        className="pointer-events-none absolute inset-0 bg-repeat opacity-50"
        style={{ backgroundImage: `url(${bgUrl})`, backgroundSize: "1366px auto" }}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative mx-auto max-w-[80rem] overflow-hidden rounded-3xl bg-[oklch(0.21_0.05_260)] text-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.55)] transition-all duration-700 ease-out motion-reduce:transition-none",
          inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        )}
      >
        {/* Interactive dot field — dots drift and bulge under the cursor. Masked
            to fade in from the right so the headline keeps its contrast. */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, transparent 30%, #000 80%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, transparent 30%, #000 80%)",
          }}
        >
          <DotField
            dotRadius={1.5}
            dotSpacing={14}
            cursorRadius={140}
            bulgeStrength={reduced ? 0 : 26}
            sparkle={false}
            waveAmplitude={reduced ? 0 : 6}
            gradientFrom="rgba(150, 178, 255, 0.75)"
            gradientTo="rgba(170, 186, 214, 0.45)"
            glowColor="transparent"
          />
        </div>

        <div className="relative flex flex-col gap-8 px-7 py-9 md:px-12 md:py-10 lg:flex-row lg:items-center lg:justify-between">
          {/* Left — icon + message */}
          <div className="flex items-start gap-5">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-[0_10px_30px_-10px_rgba(37,64,235,0.7)]"
              style={{ backgroundColor: ACCENT }}
            >
              <ShieldCheck className="h-7 w-7" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                Your brand won&rsquo;t protect itself.
              </h2>
              <p className="mt-2 max-w-md text-base leading-relaxed text-white/65">
                Start monitoring in minutes. Detect, document, and take action from one
                workspace.
              </p>
            </div>
          </div>

          {/* Right — actions + assurance */}
          <div className="flex flex-col items-start gap-4 lg:items-end">
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="text-white hover:opacity-90"
                style={{ backgroundColor: ACCENT }}
              >
                <Link to="/dashboard">
                  Start monitoring
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/25 bg-white/5 text-white hover:border-white/40 hover:bg-white/10 hover:text-white"
              >
                <Link to="/plans">
                  Book a demo
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/65">
              <CheckCircle2
                className="h-4 w-4 shrink-0"
                strokeWidth={2}
                style={{ color: ACCENT }}
                aria-hidden="true"
              />
              Setup in minutes. Cancel anytime.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
