import { useNavigate } from "@tanstack/react-router";
import { LogOut, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";

function initials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "?";
}

export function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const fullName = profile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? null;
  const avatarUrl = profile?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined) ?? undefined;
  const email = user.email ?? null;

  async function onSignOut() {
    await signOut();
    navigate({ to: "/auth/sign-in", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl} alt={fullName ?? email ?? "User"} />
          <AvatarFallback>{initials(fullName, email)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-medium">{fullName ?? "Account"}</span>
          {email && <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
          <UserIcon className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
