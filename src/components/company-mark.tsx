import { cn } from "@/lib/utils";

/**
 * Company brand symbol mark (monochrome icon).
 * Rendered as a CSS mask filled with `currentColor` so the mark automatically
 * matches its surrounding text color.
 */
export function CompanyMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Company Mark"
      className={cn("inline-block bg-current shrink-0", className)}
      style={{
        aspectRatio: "512 / 421",
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

export const Mark = CompanyMark;
export const HakkiuMark = CompanyMark;
