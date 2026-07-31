import { cn } from "@/lib/utils";

/**
 * InfiniteGridBackdrop — a lightweight animated grid + colour-wash that sits
 * behind the marketing pages (landing, contact, about, solutions).
 *
 * ⚡ Performance rewrite: this used to run a `motion` `useAnimationFrame` loop
 * at 60fps that rewrote a full-viewport SVG pattern every frame, plus a
 * mouse-following reveal mask — which pegged mobile CPUs/GPUs (the page felt
 * frozen for a long time on phones). It is now 100% CSS:
 *   - the grid scrolls via a GPU-composited `background-position` animation
 *     (`.hakkiu-grid` in styles.css), which is disabled on mobile and under
 *     `prefers-reduced-motion`, so a phone never spends main-thread time on it;
 *   - the mouse-follow mask is replaced by a STATIC radial vignette (same look,
 *     zero JS), so there's no per-move listener or re-render;
 *   - the colour blobs use a smaller blur radius on mobile (`blur-[60px]`) —
 *     large `blur()` is one of the most expensive things a mobile GPU can do.
 *
 * The `motion` library was the ONLY landing-critical-path consumer of `motion`,
 * so removing it here drops that dependency (~50–100KB) from the bundle too.
 *
 * Same public API as before (`className`, `showBlobs`, `fixed`) so all five
 * call sites keep working unchanged.
 */
export const InfiniteGridBackdrop = ({
  className,
  showBlobs = true,
  fixed = false,
}: {
  className?: string;
  /** Render the coloured gradient blobs. */
  showBlobs?: boolean;
  /** Pin to the viewport as one continuous page-wide backdrop. */
  fixed?: boolean;
}) => {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none overflow-hidden",
        fixed ? "fixed inset-0 z-0" : "absolute inset-0 -z-10",
        className,
      )}
    >
      {/* Faint base grid across the whole backdrop. */}
      <div className="hakkiu-grid absolute inset-0 text-muted-foreground opacity-[0.06]" />

      {/* Brighter grid revealed through a STATIC radial vignette (top-centre),
          replacing the old cursor-tracking reveal mask. */}
      <div
        className="absolute inset-0 text-muted-foreground opacity-40"
        style={{
          maskImage: "radial-gradient(600px circle at 50% 30%, black, transparent)",
          WebkitMaskImage: "radial-gradient(600px circle at 50% 30%, black, transparent)",
        }}
      >
        <div className="hakkiu-grid absolute inset-0" />
      </div>

      {showBlobs && (
        <div className="absolute inset-0">
          <div className="absolute right-[-20%] top-[-20%] h-[40%] w-[40%] rounded-full bg-orange-500/40 blur-[60px] md:blur-[120px] dark:bg-orange-600/20" />
          <div className="absolute right-[10%] top-[-10%] h-[20%] w-[20%] rounded-full bg-primary/30 blur-[50px] md:blur-[100px]" />
          <div className="absolute bottom-[-20%] left-[-10%] h-[40%] w-[40%] rounded-full bg-blue-500/40 blur-[60px] md:blur-[120px] dark:bg-blue-600/20" />
        </div>
      )}
    </div>
  );
};
