import { getPlatformLogo } from "@/lib/platform-logos";
import { cn } from "@/lib/utils";

/**
 * Renders the real logo for a platform on a white rounded chip (so even dark
 * marks like TikTok stay visible on any theme). Falls back to a letter avatar
 * when the platform has no known logo.
 *
 * Size is controlled by `className` (e.g. "h-10 w-10"); default is h-8 w-8.
 */
export function PlatformLogo({
  platform,
  className,
  imgClassName,
}: {
  platform: string;
  className?: string;
  imgClassName?: string;
}) {
  const logo = getPlatformLogo(platform);

  if (!logo) {
    return (
      <div
        className={cn(
          "h-8 w-8 shrink-0 rounded-md border bg-muted flex items-center justify-center font-bold text-xs uppercase text-muted-foreground select-none",
          className
        )}
      >
        {platform.slice(0, 2)}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "h-8 w-8 shrink-0 rounded-md border bg-white flex items-center justify-center overflow-hidden select-none",
        className
      )}
    >
      <img
        src={logo}
        alt={`${platform} logo`}
        className={cn("h-full w-full object-contain p-1.5", imgClassName)}
        loading="lazy"
        draggable={false}
      />
    </div>
  );
}
