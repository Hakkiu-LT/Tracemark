import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Section-reveal primitives for the landing page. Motion is intentionally
 * quiet: transform + opacity only, each element animates once when it scrolls
 * into view, and everything collapses to the final state under
 * `prefers-reduced-motion`. See MOTION-SPEC — reveals run 560–720ms on a
 * cubic-bezier(.22, 1, .36, 1) curve with 45–80ms child stagger.
 */

/** Fires once when the element first scrolls into view (18–25% visible). */
export function useInView<T extends HTMLElement>(threshold = 0.2) {
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
export function usePrefersReducedMotion(): boolean {
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

interface RevealProps {
  children: ReactNode;
  /** Element to render. Defaults to a div. */
  as?: ElementType;
  className?: string;
  /** Stagger delay in ms (child elements offset by 45–80ms). */
  delay?: number;
  /** Initial vertical offset in px (default 18, per hero spec). */
  y?: number;
  /** Reveal at this visibility ratio. */
  threshold?: number;
  id?: string;
}

/**
 * Reveals its children once, sliding up `y`px and fading in. Respects reduced
 * motion (renders final state immediately, no transition).
 */
export function Reveal({
  children,
  as: Tag = "div",
  className,
  delay = 0,
  y = 18,
  threshold = 0.2,
  id,
}: RevealProps) {
  const { ref, inView } = useInView<HTMLElement>(threshold);
  return (
    <Tag
      ref={ref}
      id={id}
      className={cn(
        "transition-[transform,opacity] duration-[640ms] ease-[cubic-bezier(.22,1,.36,1)] will-change-transform motion-reduce:transition-none motion-reduce:transform-none",
        inView ? "translate-y-0 opacity-100" : "opacity-0",
        className,
      )}
      style={{
        transitionDelay: inView ? `${delay}ms` : "0ms",
        transform: inView ? undefined : `translateY(${y}px)`,
      }}
    >
      {children}
    </Tag>
  );
}
