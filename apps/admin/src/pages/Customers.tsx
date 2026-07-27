import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { adminFetch } from "@/lib/api";
import { Can } from "@/components/Can";
import { CustomerEditDialog, type EditableCustomer } from "@/components/CustomerEditDialog";
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

interface CustomerRow {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
  persona: string | null;
}

export function Customers() {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["customers"],
    queryFn: () => adminFetch<CustomerRow[]>("/customers"),
  });
  const { data: orgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => adminFetch<{ id: string; name: string | null }[]>("/organizations"),
  });
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const [editing, setEditing] = useState<EditableCustomer | null>(null);

  const rows = (data ?? []).filter((u) => {
    if (search && !u.email.toLowerCase().includes(search.toLowerCase()) && !(u.full_name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Individual login accounts. Each belongs to a company.</p>
        </div>
        <Can permission="customers.create">
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Create customer
          </Button>
        </Can>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{isLoading ? "Loading…" : `${rows.length} customer(s)`}</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="Search by email or name…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" />
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Failed to load customers. Check your connection.</p>
              <Button size="sm" variant="outline" onClick={() => refetch()} className="mt-3">Retry</Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/customers/$userId"
                        params={{ userId: u.id }}
                        className="text-accent hover:underline"
                      >
                        {u.full_name || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {u.organization_id ? (
                        <Link to="/organizations/$orgId" params={{ orgId: u.organization_id }} className="text-accent hover:underline">
                          {orgName.get(u.organization_id) || "—"}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {u.persona === "law_firm" ? "Law Firm" : "Brand Owner"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEditing({
                            id: u.id, full_name: u.full_name, email: u.email,
                            persona: u.persona, organization_id: u.organization_id,
                          })
                        }
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {editing && <CustomerEditDialog customer={editing} onClose={() => setEditing(null)} />}
      {creating && (
        <CreateCustomerDialog
          orgs={orgs ?? []}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// ── CreateCustomerDialog ──────────────────────────────────────────────────────
function CreateCustomerDialog({
  orgs,
  onClose,
  onCreated,
}: {
  orgs: { id: string; name: string | null }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgId, setOrgId] = useState("");

  const create = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { email: email.trim(), password };
      if (fullName.trim()) body.full_name = fullName.trim();
      if (orgId) body.organization_id = orgId;
      return adminFetch("/customers", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast.success("Customer login created");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = email.trim().length > 3 && password.length >= 8;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Create customer login"
      description="Creates a dashboard login (Supabase auth user) the customer can sign in with."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !canSubmit}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" />
      </div>
      <div className="space-y-1.5">
        <Label>Password <span className="text-xs text-muted-foreground">(min 8 characters)</span></Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <div className="space-y-1.5">
        <Label>Full name <span className="text-xs text-muted-foreground">(optional)</span></Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="—" />
      </div>
      <div className="space-y-1.5">
        <Label>Organization <span className="text-xs text-muted-foreground">(optional)</span></Label>
        <Select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
          <option value="">— none —</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name || o.id}</option>
          ))}
        </Select>
      </div>
    </Dialog>
  );
}
