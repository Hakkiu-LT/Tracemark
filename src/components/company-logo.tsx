import { cn } from "@/lib/utils";

/**
 * Full company logo lockup: the symbol + wordmark at matching heights.
 * Rendered as a CSS mask filled with `currentColor`, so it adapts to any background.
 * Set the HEIGHT via className (e.g. `h-8`); the width derives automatically.
 */
export function CompanyLogo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Company Logo"
      className={cn("inline-block w-auto bg-current shrink-0", className)}
      style={{
        aspectRatio: "421 / 120",
        WebkitMaskImage: "url(/hakkiu-lockup.png)",
        maskImage: "url(/hakkiu-lockup.png)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

export const HakkiuLogo = CompanyLogo;
