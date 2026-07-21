import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { adminFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ALL_PERMISSIONS, PERMISSIONS, ROLE_PRESETS, type Permission, type Role } from "@/lib/permissions";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  Input,
  Label,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

interface StaffMember {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_super_admin: boolean;
  is_active: boolean;
  permissions: string[];
}

const ROLES = ["dev", "sales", "marketing", "admin"];

export function Staff() {
  const qc = useQueryClient();
  const { staff: me } = useAuth();
  const iAmSuper = !!me?.is_super_admin;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () => adminFetch<StaffMember[]>("/staff"),
  });

  const updateStaff = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      adminFetch(`/staff/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      toast.success("Staff updated");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
          <p className="text-sm text-muted-foreground">Employees with admin-portal access and their permissions.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Add staff
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isLoading ? "Loading…" : `${staff?.length ?? 0} member(s)`}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(staff ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <Link to="/staff/$staffId" params={{ staffId: m.id }} className="text-accent hover:underline">
                        {m.full_name || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell>
                      {m.is_super_admin ? (
                        <Badge>Super Admin</Badge>
                      ) : (
                        <Select
                          value={m.role}
                          onChange={(e) => updateStaff.mutate({ id: m.id, patch: { role: e.target.value } })}
                          className="h-8 w-32"
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.is_super_admin ? "all" : `${m.permissions.length} granted`}
                    </TableCell>
                    <TableCell>
                      {m.is_super_admin ? (
                        <Badge variant="success">active</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStaff.mutate({ id: m.id, patch: { is_active: !m.is_active } })}
                          className={m.is_active ? "text-[var(--success)]" : "text-muted-foreground"}
                        >
                          {m.is_active ? "Active" : "Disabled"}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to="/staff/$staffId" params={{ staffId: m.id }}>
                        <Button size="sm" variant="outline">Edit</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {creating && (
        <CreateStaffDialog
          canSuper={iAmSuper}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["staff"] });
          }}
        />
      )}
      {editing && (
        <PermissionsDialog
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["staff"] });
          }}
        />
      )}
    </div>
  );
}

function CreateStaffDialog({ canSuper, onClose, onCreated }: { canSuper: boolean; onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("sales");
  const [isSuper, setIsSuper] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      adminFetch("/staff", {
        method: "POST",
        body: JSON.stringify({ email, password, full_name: fullName, role, is_super_admin: canSuper && isSuper }),
      }),
    onSuccess: () => {
      toast.success("Staff member created");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add staff member"
      description="Creates a login and grants admin-portal access with the role's default permissions."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Temporary password</Label>
        <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Full name</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select value={role} onChange={(e) => setRole(e.target.value)} disabled={isSuper}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </div>
      {canSuper && (
        <label className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted">
          <input type="checkbox" checked={isSuper} onChange={(e) => setIsSuper(e.target.checked)} className="h-4 w-4" />
          <span className="text-sm">Super admin (full access, bypasses all permission checks)</span>
        </label>
      )}
    </Dialog>
  );
}

function PermissionsDialog({
  member,
  onClose,
  onSaved,
}: {
  member: StaffMember;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Start from the member's current effective permissions.
  const [granted, setGranted] = useState<Set<string>>(new Set(member.permissions));

  const save = useMutation({
    mutationFn: () =>
      adminFetch(`/staff/${member.id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({
          // Send an explicit grant/deny for every catalog permission so the effective
          // set matches exactly what the admin toggled (independent of the role preset).
          overrides: ALL_PERMISSIONS.map((p) => ({ permission: p, granted: granted.has(p) })),
        }),
      }),
    onSuccess: () => {
      toast.success("Permissions updated");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(p: Permission) {
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Permissions — ${member.full_name || member.email}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <span className="text-xs text-muted-foreground">Apply preset:</span>
        {(Object.keys(ROLE_PRESETS) as Role[]).map((r) => (
          <Button key={r} size="sm" variant="outline" onClick={() => setGranted(new Set(ROLE_PRESETS[r]))}>
            {r}
          </Button>
        ))}
      </div>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {ALL_PERMISSIONS.map((p) => (
          <label key={p} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted">
            <input type="checkbox" checked={granted.has(p)} onChange={() => toggle(p)} className="h-4 w-4" />
            <span className="flex-1">
              <span className="block text-sm font-medium">{p}</span>
              <span className="block text-xs text-muted-foreground">{PERMISSIONS[p]}</span>
            </span>
          </label>
        ))}
      </div>
    </Dialog>
  );
}
