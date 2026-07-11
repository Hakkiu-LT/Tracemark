import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Radar, ShieldAlert, Briefcase, Settings, ShieldCheck, CreditCard, Activity, Users as UsersIcon } from "lucide-react";
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

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const persona = useStore((s) => s.persona);
  const { user, profile } = useAuth();

  const isAdmin = !!profile?.is_admin;

  const items = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Monitoring", url: "/monitoring", icon: Radar },
    { title: "Cases", url: "/cases", icon: ShieldAlert },
    ...(persona === "law_firm" ? [{ title: "Clients", url: "/clients", icon: Briefcase }] : []),
    { title: "Settings", url: "/settings", icon: Settings },
    ...(isAdmin ? [
      { title: "API Usage", url: "/api-usage", icon: Activity },
      { title: "Users", url: "/users", icon: UsersIcon },
    ] : []),
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
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/landing" className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-sidebar-foreground">Tracemark</span>
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
