import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { adminFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/ConfirmDialog";
import { ALL_PERMISSIONS, PERMISSIONS, ROLE_PRESETS, type Permission, type Role } from "@/lib/permissions";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Skeleton } from "@/components/ui";

interface StaffMember {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_super_admin: boolean;
  is_active: boolean;
  permissions: string[];
}

// super_admin is surfaced as a role option; internally it maps to the is_super_admin flag.
const BASE_ROLES = ["dev", "sales", "marketing", "admin"];

export function StaffDetail() {
  const { staffId } = useParams({ strict: false }) as { staffId: string };
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { staff: me } = useAuth();
  const iAmSuper = !!me?.is_super_admin;

  const { data, isLoading } = useQuery({
    queryKey: ["staff", staffId],
    queryFn: () => adminFetch<StaffMember>(`/staff/${staffId}`),
  });

  // Account form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("sales");
  const [active, setActive] = useState(true);
  const [granted, setGranted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!data) return;
    setFullName(data.full_name || "");
    setEmail(data.email || "");
    setRole(data.is_super_admin ? "super_admin" : data.role);
    setActive(data.is_active);
    setGranted(new Set(data.permissions));
  }, [data]);

  // Super-admin can assign the super_admin role; others only the base roles.
  const roleOptions = iAmSuper ? ["super_admin", ...BASE_ROLES] : BASE_ROLES;
  // A non-super viewer cannot change a super-admin's role.
  const roleLocked = data?.is_super_admin && !iAmSuper;

  const saveAccount = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      if (fullName !== (data?.full_name || "")) body.full_name = fullName;
      if (email !== data?.email) body.email = email;
      if (password.trim()) body.password = password.trim();
      if (active !== data?.is_active) body.is_active = active;

      // Role ⇄ super-admin mapping. Only send is_super_admin when it actually changes
      // (sending it requires the caller to be super-admin).
      const wasSuper = !!data?.is_super_admin;
      if (role === "super_admin") {
        if (!wasSuper) body.is_super_admin = true;
      } else {
        if (role !== data?.role) body.role = role;
        if (wasSuper) body.is_super_admin = false; // demotion
      }
      if (Object.keys(body).length === 0) {
        return Promise.resolve({} as unknown);
      }
      return adminFetch(`/staff/${staffId}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast.success("Staff updated");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["staff", staffId] });
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePerms = useMutation({
    mutationFn: () =>
      adminFetch(`/staff/${staffId}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ overrides: ALL_PERMISSIONS.map((p) => ({ permission: p, granted: granted.has(p) })) }),
      }),
    onSuccess: () => {
      toast.success("Permissions updated");
      qc.invalidateQueries({ queryKey: ["staff", staffId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 p-6 md:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  function toggle(p: Permission) {
    setGranted((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 md:p-8">
      <Link to="/staff" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to staff
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{data.full_name || data.email}</h1>
        {data.is_super_admin && <Badge>Super Admin</Badge>}
      </div>

      {/* Account */}
      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Email <span className="text-xs text-muted-foreground">(login)</span></Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>New password <span className="text-xs text-muted-foreground">(optional)</span></Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role {!iAmSuper && <span className="text-xs text-muted-foreground">(super-admin only)</span>}</Label>
              <Select value={role} onChange={(e) => setRole(e.target.value)} disabled={!iAmSuper || roleLocked}>
                {roleOptions.map((r) => <option key={r} value={r}>{r === "super_admin" ? "super admin" : r}</option>)}
              </Select>
              {role === "super_admin" && <p className="text-xs text-muted-foreground">Super admin — bypasses all permission checks.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Status {!iAmSuper && <span className="text-xs text-muted-foreground">(super-admin only)</span>}</Label>
              <Select value={active ? "active" : "disabled"} onChange={(e) => setActive(e.target.value === "active")} disabled={!iAmSuper}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            </div>
          </div>
          <Button size="sm" onClick={() => saveAccount.mutate()} disabled={saveAccount.isPending}>
            {saveAccount.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save account
          </Button>
        </CardContent>
      </Card>

      {/* Permissions — visible to all, editable only by super-admins */}
      <Card>
        <CardHeader><CardTitle>What this employee can see & change</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.is_super_admin ? (
            <p className="text-sm text-muted-foreground">Super-admin — has all permissions.</p>
          ) : !iAmSuper ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Editing permissions requires super-admin access.</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {data.permissions.map((p) => (
                  <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                <span className="text-xs text-muted-foreground">Apply role preset:</span>
                {(Object.keys(ROLE_PRESETS) as Role[]).map((r) => (
                  <Button key={r} size="sm" variant="outline" onClick={() => setGranted(new Set(ROLE_PRESETS[r]))}>{r}</Button>
                ))}
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                {ALL_PERMISSIONS.map((p) => (
                  <label key={p} className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-muted">
                    <input type="checkbox" checked={granted.has(p)} onChange={() => toggle(p)} className="mt-0.5 h-4 w-4" />
                    <span>
                      <span className="block text-sm font-medium">{p}</span>
                      <span className="block text-xs text-muted-foreground">{PERMISSIONS[p]}</span>
                    </span>
                  </label>
                ))}
              </div>
              <Button size="sm" onClick={() => savePerms.mutate()} disabled={savePerms.isPending}>
                {savePerms.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save permissions
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Danger zone — delete (super-admin only) */}
      {iAmSuper && me?.id !== data.id && (
        <Card>
          <CardHeader><CardTitle>Danger zone</CardTitle></CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                confirm.open({
                  title: `Delete ${data.full_name || data.email}?`,
                  description: "Permanently removes this staff member's admin access and login.",
                  confirmLabel: "Delete staff",
                  destructive: true,
                  onConfirm: async () => {
                    await adminFetch(`/staff/${staffId}`, { method: "DELETE" });
                    toast.success("Staff deleted");
                    qc.invalidateQueries({ queryKey: ["staff"] });
                    navigate({ to: "/staff" });
                  },
                })
              }
            >
              <Trash2 className="h-4 w-4" /> Delete staff member
            </Button>
          </CardContent>
        </Card>
      )}
      {confirm.element}
    </div>
  );
}
