import { useInView } from "./reveal";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  /** Final fill width, e.g. "92%". */
  width: string;
  /** Delay before the fill animates, for staggering rows. */
  delay?: number;
  className?: string;
  /** Fill (bar) class — colour, rounding, etc. */
  barClassName?: string;
}

/**
 * A track + fill bar that grows from 0 to `width` the first time it scrolls
 * into view. Reduced-motion users get the CSS transition suppressed, so the
 * bar simply appears filled.
 */
export function ProgressBar({ width, delay = 0, className, barClassName }: ProgressBarProps) {
  const { ref, inView } = useInView<HTMLDivElement>(0.5);
  return (
    <div
      ref={ref}
      className={cn("overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-[1100ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none",
          barClassName,
        )}
        style={{
          width: inView ? width : "0%",
          transitionDelay: `${delay}ms`,
          backgroundColor: barClassName ? undefined : "var(--mint, #18c889)",
        }}
      />
    </div>
  );
}
