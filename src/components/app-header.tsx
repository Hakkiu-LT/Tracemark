import { Search, Bell } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";

export function AppHeader() {
  const persona = useStore((s) => s.persona);
  const clients = useStore((s) => s.clients);
  const activeClientId = useStore((s) => s.activeClientId);
  const setActiveClient = useStore((s) => s.setActiveClient);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger />
      <div className="relative hidden flex-1 max-w-md md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search marks, cases, infringers…" className="h-9 pl-9" />
      </div>
      <div className="ml-auto flex items-center gap-3">
        {persona === "law_firm" && (
          <Select value={activeClientId ?? "all"} onValueChange={(v) => setActiveClient(v === "all" ? null : v)}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <button className="relative rounded-md p-2 hover:bg-muted" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
        </button>
        <Badge variant="outline" className="hidden gap-1.5 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Scanners online
        </Badge>
      </div>
    </header>
  );
}
