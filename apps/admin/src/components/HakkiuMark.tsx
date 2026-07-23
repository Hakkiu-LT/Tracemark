import { cn } from "@/lib/utils";

/**
 * HAKKIU brand symbol (the hedgehog mark).
 *
 * Rendered as a CSS mask filled with `currentColor` so the mark matches its
 * surrounding text color on any background. Source asset served from `public/`.
 */
export function HakkiuMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="HAKKIU"
      className={cn("inline-block bg-current", className)}
      style={{
        WebkitMaskImage: "url(/hakkiu-mark.png)",
        maskImage: "url(/hakkiu-mark.png)",
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
