import { cn } from "@/lib/utils";

/**
 * Full HAKKIU logo lockup: the hedgehog symbol + the "HAKKIU" wordmark at matching
 * heights (exactly the reference artwork). Rendered as a CSS mask filled with
 * `currentColor`, so it adapts to any background. Set the HEIGHT via className
 * (e.g. `h-8`); the width derives automatically from the baked aspect ratio.
 */
export function HakkiuLogo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="HAKKIU"
      className={cn("inline-block w-auto bg-current", className)}
      style={{
        aspectRatio: "1082 / 308",
        WebkitMaskImage: "url(/hakkiu-lockup.png)",
        maskImage: "url(/hakkiu-lockup.png)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "left center",
        maskPosition: "left center",
      }}
    />
  );
}
