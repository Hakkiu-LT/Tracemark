import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Building2,
  ChevronDown,
  ChevronRight,
  FileWarning,
  Gauge,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Package,
  ScrollText,
  Shield,
  Users,
  UserCog,
} from "lucide-react";
import { useState, type ComponentType } from "react";

import { useAuth } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { SearchBox } from "@/components/SearchBox";

type IconType = ComponentType<{ className?: string }>;

interface NavItem {
  label: string;
  to: string;
  icon: IconType;
  permission?: Permission;
}

interface NavGroup {
  label: string;
  icon: IconType;
  items: NavItem[];
}

// A standalone top-level item (no folder) …
const DASHBOARD: NavItem = { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard };

// … followed by collapsible folders of related items.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Customers",
    icon: Users,
    items: [
      { label: "Companies", to: "/organizations", icon: Building2, permission: "customers.view" },
      { label: "Users", to: "/customers", icon: Users, permission: "customers.view" },
      { label: "Cases", to: "/cases", icon: FileWarning, permission: "customers.view" },
      { label: "Brands", to: "/brands", icon: Package, permission: "brands.view" },
    ],
  },
  {
    label: "Monitoring",
    icon: Gauge,
    items: [
      { label: "API Usage", to: "/monitoring/api", icon: Activity, permission: "resources.view" },
      { label: "Scraper Health", to: "/monitoring/scrapers", icon: Activity, permission: "scraper_health.view" },
      { label: "Resources", to: "/monitoring/resources", icon: HardDrive, permission: "resources.view" },
    ],
  },
  {
    label: "Administration",
    icon: Shield,
    items: [
      { label: "Staff", to: "/staff", icon: UserCog, permission: "staff.manage" },
      { label: "Audit Log", to: "/audit", icon: ScrollText, permission: "audit.view" },
      { label: "Integrations", to: "/integrations", icon: KeyRound, permission: "integrations.manage" },
    ],
  },
];

const GROUP_STATE_KEY = "admin.nav.collapsedGroups";

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(GROUP_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { staff, permissions, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Which folders the user has explicitly collapsed (persisted across reloads).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  function toggleGroup(label: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota / disabled storage */
      }
      return next;
    });
  }

  const canSee = (item: NavItem) =>
    !item.permission || staff?.is_super_admin || permissions.has(item.permission);

  const isActive = (to: string) => pathname.startsWith(to);

  const itemClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
      active ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted",
    );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <span className="text-sm font-semibold tracking-tight">Tracemark Admin</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {/* Standalone Dashboard */}
          <Link to={DASHBOARD.to} className={itemClass(isActive(DASHBOARD.to))}>
            <DASHBOARD.icon className="h-4 w-4" />
            {DASHBOARD.label}
          </Link>

          {/* Collapsible folders */}
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(canSee);
            if (visibleItems.length === 0) return null; // hide empty folders

            const hasActiveChild = visibleItems.some((i) => isActive(i.to));
            // A folder stays open unless the user collapsed it — but a folder that
            // contains the current page is always shown expanded.
            const expanded = hasActiveChild || !collapsed[group.label];
            const GroupIcon = group.icon;
            const Chevron = expanded ? ChevronDown : ChevronRight;

            return (
              <div key={group.label} className="pt-2">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80 transition-colors hover:bg-muted"
                >
                  <GroupIcon className="h-4 w-4" />
                  {group.label}
                  <Chevron className="ml-auto h-4 w-4" />
                </button>
                {expanded && (
                  <div className="mt-1 space-y-1">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link key={item.to} to={item.to} className={cn(itemClass(isActive(item.to)), "pl-9")}>
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium">{staff?.full_name || staff?.email}</p>
            <p className="truncate text-xs text-muted-foreground">
              {staff?.is_super_admin ? "Super Admin" : staff?.role}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-x-hidden bg-background">
        <header className="flex h-14 items-center gap-4 border-b border-border px-6">
          <SearchBox />
        </header>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
