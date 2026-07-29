import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { UserMenu } from "@/components/user-menu";

export function AppHeader() {
  const persona = useStore((s) => s.persona);
  const clients = useStore((s) => s.clients);
  const activeClientId = useStore((s) => s.activeClientId);
  const setActiveClient = useStore((s) => s.setActiveClient);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger />
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
        <UserMenu />
      </div>
    </header>
  );
}
