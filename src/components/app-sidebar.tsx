import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Radar, ShieldAlert, Briefcase, Settings, CreditCard } from "lucide-react";
import { CompanyMark } from "@/components/company-mark";
import { CompanyLogo } from "@/components/company-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { CompanySwitcher } from "@/components/company-switcher";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const persona = useStore((s) => s.persona);
  const orgName = useStore((s) => s.orgName);
  const orgLogoUrl = useStore((s) => s.orgLogoUrl);
  const { user, profile } = useAuth();

  const items = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Monitoring", url: "/monitoring", icon: Radar },
    { title: "Cases", url: "/cases", icon: ShieldAlert },
    ...(persona === "law_firm" ? [{ title: "Clients", url: "/clients", icon: Briefcase }] : []),
    { title: "Settings", url: "/settings", icon: Settings },
  ];

  const isActive = (url: string) => {
    if (url === "/cases") {
      return pathname.startsWith("/cases") || (pathname.startsWith("/monitoring/") && !pathname.startsWith("/monitoring/new"));
    }
    if (url === "/monitoring") {
      return pathname === "/monitoring" || pathname.startsWith("/monitoring/new");
    }
    return pathname.startsWith(url);
  };

  const displayName = orgName || (persona === "law_firm" ? "Chen & Partners IP" : "Helix Audio Inc.");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader
        className={cn(
          "border-b border-sidebar-border transition-all",
          collapsed
            ? "flex h-14 items-center justify-center p-0"
            : "flex flex-col items-center justify-center py-2.5 px-3"
        )}
      >
        {collapsed ? (
          <Link
            to="/"
            className="flex h-full w-full items-center justify-center transition-opacity hover:opacity-80"
            title={displayName}
          >
            {orgLogoUrl ? (
              <img
                src={orgLogoUrl}
                alt={displayName}
                className="h-7 w-7 rounded object-contain shrink-0"
              />
            ) : (
              <CompanyMark className="h-7 w-7 shrink-0 text-sidebar-primary" />
            )}
          </Link>
        ) : (
          <Link
            to="/"
            className="group flex flex-col items-center justify-center gap-1 text-center transition-opacity hover:opacity-90 max-w-full px-2"
            title={displayName}
          >
            {orgLogoUrl ? (
              <div className="flex items-center justify-center gap-2 max-w-[210px]">
                <img
                  src={orgLogoUrl}
                  alt={displayName}
                  className="h-6 w-6 rounded object-contain shrink-0 transition-transform group-hover:scale-105"
                />
                <span className="font-bold text-sm tracking-tight text-sidebar-foreground truncate">
                  {displayName}
                </span>
              </div>
            ) : orgName && orgName !== "HAKKIU" ? (
              <div className="flex items-center justify-center gap-1.5 max-w-[210px]">
                <CompanyMark className="h-5 w-5 text-sidebar-primary shrink-0" />
                <span className="font-bold text-sm tracking-tight text-sidebar-foreground truncate">
                  {displayName}
                </span>
              </div>
            ) : (
              <CompanyLogo className="h-5.5 text-sidebar-foreground transition-transform group-hover:scale-[1.02]" />
            )}
            <span className="rounded-full border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/75 shadow-xs select-none">
              {persona === "law_firm" ? "Law Firm" : "Brand Owner"}
            </span>
          </Link>
        )}
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <CompanySwitcher collapsed={collapsed} />
        <SidebarGroup className="pt-1.5">
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
