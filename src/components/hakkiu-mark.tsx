import { cn } from "@/lib/utils";

/**
 * HAKKIU brand symbol (the hedgehog mark).
 *
 * The source asset (`/hakkiu-logo-symbol.png`, served from `public/`) is a solid
 * monochrome shape. We render it as a CSS mask filled with `currentColor` so the
 * mark automatically matches its surrounding text color — white on dark headers,
 * dark on light ones — exactly like the Lucide icon it replaces.
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
