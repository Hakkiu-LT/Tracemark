import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StarBorderProps {
  /** Streak color — fades to transparent toward the core. */
  color?: string;
  /** Color of the static resting track beneath the streaks. */
  trackColor?: string;
  /** Animation duration, e.g. "6s". */
  speed?: string;
  /** Border thickness in pixels. */
  thickness?: number;
  /** Outer corner radius (CSS length). Match it to the wrapped element + thickness. */
  radius?: string;
  /** Fixed height of each edge glow, in px. Shorter elements want a smaller value. */
  streakHeight?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Adapted from React Bits' StarBorder. Instead of the stock dark inner box,
 * this wraps arbitrary content: two glowing streaks sweep along the top and
 * bottom edges over a faint static track, so the wrapped element gains an
 * animated comet border. Unlike the stock version (tuned for short buttons),
 * each streak is a fixed-height glow centered on its edge, so the comet stays
 * on the visible ring regardless of the element's height. The animation layer
 * is clipped to the rounded ring while the content layer is left un-clipped so
 * an overhanging child (e.g. a badge) can still bleed past the edge.
 */
export function StarBorder({
  color = "white",
  trackColor = "rgba(255,255,255,0.25)",
  speed = "6s",
  thickness = 2,
  radius = "1.625rem",
  streakHeight = 160,
  className,
  style,
  children,
}: StarBorderProps) {
  const streak = `radial-gradient(circle, ${color}, transparent 30%)`;
  return (
    <div
      className={cn("relative", className)}
      style={{ padding: `${thickness}px`, background: trackColor, borderRadius: radius, ...style }}
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ borderRadius: radius }}
        aria-hidden="true"
      >
        <div
          className="star-movement-top absolute left-[-250%] z-0 w-[300%] rounded-full opacity-90"
          style={{
            top: -streakHeight / 2,
            height: streakHeight,
            background: streak,
            animationDuration: speed,
          }}
        />
        <div
          className="star-movement-bottom absolute right-[-250%] z-0 w-[300%] rounded-full opacity-90"
          style={{
            bottom: -streakHeight / 2,
            height: streakHeight,
            background: streak,
            animationDuration: speed,
          }}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
