import { useQuery } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMyOrganizations, switchOrganization } from "@/lib/api";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Company switcher for users who belong to more than one organization.
 *
 * The whole customer API scopes data by a single "active org" column
 * (profiles.organization_id). This lets a multi-company user pick which one they're
 * viewing — so a brand added to company B (here or in the admin portal) actually shows
 * up in monitoring once B is selected. On switch we wipe org-scoped local state and
 * hard-reload so every page refetches for the newly-active org.
 *
 * Renders nothing when the user has 0 or 1 company (nothing to switch between).
 */
export function CompanySwitcher({ collapsed }: { collapsed: boolean }) {
  const resetOrgScopedData = useStore((s) => s.resetOrgScopedData);
  const [switching, setSwitching] = useState(false);

  const { data } = useQuery({
    queryKey: ["my-organizations"],
    queryFn: getMyOrganizations,
    staleTime: 60_000,
  });

  const orgs = data?.organizations ?? [];
  if (orgs.length < 2) return null; // only one company — no switcher needed

  // Trust the server's active org. It may be NONE of the listed orgs (e.g. a staff account
  // still parked in the sentinel org) — in that case nothing is marked active and every
  // company stays selectable, so the user can move to a real one.
  const activeId = data?.active_organization_id ?? null;
  const active = orgs.find((o) => o.id === activeId) ?? null;

  async function onSelect(orgId: string) {
    if (orgId === activeId || switching) return;
    setSwitching(true);
    try {
      await switchOrganization(orgId);
      // Clear the previous org's local marks/cases/scan results, then reload so all
      // org-scoped queries refetch cleanly for the new active org.
      resetOrgScopedData();
      window.location.reload();
    } catch (e) {
      toast.error((e as Error).message);
      setSwitching(false);
    }
  }

  if (collapsed) {
    // Icon-only trigger to match the collapsed sidebar rail.
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent"
            title={active?.name ?? "Select company"}
          >
            {switching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
          </button>
        </DropdownMenuTrigger>
        <OrgList orgs={orgs} activeId={activeId} onSelect={onSelect} />
      </DropdownMenu>
    );
  }

  return (
    <div className="px-2 pb-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2 py-1.5 text-left text-xs hover:bg-sidebar-accent">
            {switching ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <Building2 className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/60" />
            )}
            <span className="flex-1 truncate font-medium text-sidebar-foreground">{active?.name ?? "Select company"}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
          </button>
        </DropdownMenuTrigger>
        <OrgList orgs={orgs} activeId={activeId} onSelect={onSelect} />
      </DropdownMenu>
    </div>
  );
}

function OrgList({
  orgs,
  activeId,
  onSelect,
}: {
  orgs: { id: string; name: string; role: string }[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <DropdownMenuContent align="start" className="w-56">
      <DropdownMenuLabel>Switch company</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {orgs.map((o) => (
        <DropdownMenuItem key={o.id} onSelect={() => onSelect(o.id)} className="gap-2">
          <Check className={cn("h-4 w-4", o.id === activeId ? "opacity-100" : "opacity-0")} />
          <span className="flex-1 truncate">{o.name}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{o.role}</span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );
}
