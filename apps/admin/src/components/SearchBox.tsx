import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Building2, Package, Search, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { adminFetch } from "@/lib/api";
import { Input } from "@/components/ui";

interface Results {
  organizations: { id: string; name: string | null; industry: string | null }[];
  people: { user_id: string; email: string; full_name: string | null; organization_id: string | null }[];
  brands: { id: string; brand_name: string; organization_id: string | null }[];
}

export function SearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Cmd/Ctrl+K focuses the search box (power-user shortcut).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => adminFetch<Results>(`/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 1,
  });

  function go(to: string, params: Record<string, string>) {
    setOpen(false);
    setQ("");
    navigate({ to, params });
  }

  const hasResults =
    data && (data.organizations.length || data.people.length || data.brands.length);

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search companies, people, brands…  (⌘K)"
        className="pl-9"
      />
      {open && debounced.length >= 1 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg">
          {!hasResults ? (
            <p className="p-3 text-sm text-muted-foreground">No results.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto py-1">
              <Section label="Companies" items={data!.organizations} icon={Building2}
                render={(o) => o.name || "Unnamed"}
                onPick={(o) => go("/organizations/$orgId", { orgId: o.id })} />
              <Section label="People" items={data!.people} icon={User}
                render={(p) => `${p.full_name || "—"} · ${p.email}`}
                onPick={(p) => go("/customers/$userId", { userId: p.user_id })} />
              <Section label="Brands" items={data!.brands} icon={Package}
                render={(b) => b.brand_name}
                onPick={(b) => b.organization_id && go("/organizations/$orgId", { orgId: b.organization_id })} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section<T>({
  label,
  items,
  icon: Icon,
  render,
  onPick,
}: {
  label: string;
  items: T[];
  icon: React.ComponentType<{ className?: string }>;
  render: (item: T) => string;
  onPick: (item: T) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => onPick(item)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
        >
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate">{render(item)}</span>
        </button>
      ))}
    </div>
  );
}
