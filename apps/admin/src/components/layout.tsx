import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Building2,
  FileWarning,
  HardDrive,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Users,
  UserCog,
} from "lucide-react";
import type { ComponentType } from "react";

import { useAuth } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { SearchBox } from "@/components/SearchBox";

interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  permission?: Permission;
}

const NAV: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Companies", to: "/organizations", icon: Building2, permission: "customers.view" },
  { label: "Cases", to: "/cases", icon: FileWarning, permission: "customers.view" },
  { label: "Users", to: "/customers", icon: Users, permission: "customers.view" },
  { label: "Staff", to: "/staff", icon: UserCog, permission: "staff.manage" },
  { label: "API Usage", to: "/monitoring/api", icon: Activity, permission: "resources.view" },
  { label: "Resources", to: "/monitoring/resources", icon: HardDrive, permission: "resources.view" },
  { label: "Audit Log", to: "/audit", icon: ScrollText, permission: "audit.view" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { staff, permissions, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const visible = NAV.filter(
    (item) => !item.permission || staff?.is_super_admin || permissions.has(item.permission),
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <span className="text-sm font-semibold tracking-tight">Tracemark Admin</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {visible.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
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
