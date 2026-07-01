import { cn } from "@/lib/utils";

export type HeroVersion = "v1" | "v2" | "v3";

const VERSIONS: { id: HeroVersion; label: string }[] = [
  { id: "v1", label: "Hero V1" },
  { id: "v2", label: "Hero V2" },
  { id: "v3", label: "Hero V3" },
];

export function HeroVersionSwitcher({
  value,
  onChange,
}: {
  value: HeroVersion;
  onChange: (version: HeroVersion) => void;
}) {
  return (
    <div className="fixed left-4 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-1 rounded-full border border-white/15 bg-black/60 p-1.5 backdrop-blur">
      {VERSIONS.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onChange(v.id)}
          aria-pressed={value === v.id}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium tracking-wide text-white/70 transition-colors",
            value === v.id
              ? "bg-white text-black"
              : "hover:bg-white/10 hover:text-white",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}