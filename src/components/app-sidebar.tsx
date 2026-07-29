import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Radar, ShieldAlert, Briefcase, Settings, CreditCard } from "lucide-react";
import { HakkiuMark } from "@/components/hakkiu-mark";
import { HakkiuLogo } from "@/components/hakkiu-logo";
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

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const persona = useStore((s) => s.persona);
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={cn("border-b border-sidebar-border", collapsed && "p-0 flex items-center justify-center")}>
        <Link
          to="/"
          className={cn(
            "flex items-center gap-2 py-3 transition-all",
            collapsed ? "w-full justify-center px-0" : "px-2"
          )}
        >
          {collapsed ? (
            <HakkiuMark className="h-7 w-7 shrink-0 text-sidebar-primary" />
          ) : (
            <div className="flex flex-col gap-1 leading-tight">
              <HakkiuLogo className="h-5 text-sidebar-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                {persona === "law_firm" ? "Law Firm" : "Brand Owner"}
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
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
