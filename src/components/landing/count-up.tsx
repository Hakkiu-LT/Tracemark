import { useEffect, useState } from "react";
import { useInView, usePrefersReducedMotion } from "./reveal";

interface CountUpProps {
  /** Target value to count to. */
  to: number;
  /** Decimal places to keep (e.g. 1 → "99.4"). */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Thousands separator, e.g. "," → "1,842". */
  separator?: string;
  /** Animation length in ms. */
  duration?: number;
  className?: string;
}

function format(value: number, decimals: number, separator: string) {
  const fixed = value.toFixed(decimals);
  if (!separator) return fixed;
  const [int, frac] = fixed.split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return frac ? `${withSep}.${frac}` : withSep;
}

// easeOutExpo — quick start, gentle landing on the final number.
const ease = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Counts from 0 up to `to` the first time it scrolls into view. Snaps straight
 * to the final value when the user prefers reduced motion.
 */
export function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  separator = "",
  duration = 1600,
  className,
}: CountUpProps) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.4);
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setValue(to);
      return;
    }
    let raf = 0;
    let start = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setValue(to * ease(progress));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {format(value, decimals, separator)}
      {suffix}
    </span>
  );
}
