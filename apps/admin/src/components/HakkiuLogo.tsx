import { cn } from "@/lib/utils";

/**
 * Full HAKKIU logo lockup (hedgehog + "HAKKIU" wordmark at matching heights).
 * Rendered as a CSS mask filled with `currentColor`. Set the HEIGHT via className
 * (e.g. `h-6`); width derives from the baked aspect ratio.
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
