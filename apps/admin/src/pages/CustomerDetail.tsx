import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { adminFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Can } from "@/components/Can";
import { CopyableId } from "@/components/CopyableId";
import { CustomerEditDialog } from "@/components/CustomerEditDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { Pencil } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

interface Brand {
  id: string;
  brand_name: string;
  status: string;
  website: string | null;
}
interface CustomerDetail {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
  persona: string | null;
  brands: Brand[];
}

export function CustomerDetail() {
  const { userId } = useParams({ strict: false }) as { userId: string };
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { staff } = useAuth();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customer", userId],
    queryFn: () => adminFetch<CustomerDetail>(`/customers/${userId}`),
  });
  const { data: orgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => adminFetch<{ id: string; name: string | null }[]>("/organizations"),
  });
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  const impersonate = useMutation({
    mutationFn: () => adminFetch<{ action_link: string }>(`/customers/${userId}/impersonate`, { method: "POST" }),
    onSuccess: (res) => {
      window.open(res.action_link, "_blank", "noopener");
      toast.success("Impersonation link opened");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBrand = useMutation({
    mutationFn: (brandId: string) => adminFetch(`/brands/${brandId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Brand deleted");
      qc.invalidateQueries({ queryKey: ["customer", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCustomer = useMutation({
    mutationFn: () => adminFetch(`/customers/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Customer deleted");
      qc.invalidateQueries({ queryKey: ["customers"] });
      navigate({ to: "/customers" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-6 md:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 md:p-8">
      <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{data.full_name || data.email}</h1>
          <p className="text-sm text-muted-foreground">{data.email}</p>
        </div>
        <Can permission="customers.edit">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Edit customer
          </Button>
        </Can>
      </div>

      {editing && (
        <CustomerEditDialog
          customer={{
            id: data.id, full_name: data.full_name, email: data.email,
            persona: data.persona, organization_id: data.organization_id,
          }}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">ID</p>
            <div className="mt-1"><CopyableId id={data.id} length={12} /></div>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Workspace</p>
            <p className="mt-1 text-sm">{data.persona === "law_firm" ? "Law Firm" : "Brand Owner"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Organization</p>
            {data.organization_id ? (
              <Link to="/organizations/$orgId" params={{ orgId: data.organization_id }} className="mt-1 block text-sm text-accent hover:underline">
                {orgName.get(data.organization_id) || <CopyableId id={data.organization_id} />}
              </Link>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">—</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Brands */}
      <Can permission="brands.view">
        <Card>
          <CardHeader>
            <CardTitle>Brands ({data.brands.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.brands.length === 0 ? (
              <p className="text-sm text-muted-foreground">No brands.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.brands.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.brand_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{b.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{b.website || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Can permission="brands.delete">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteBrand.mutate(b.id)}
                            disabled={deleteBrand.isPending}
                          >
                            {deleteBrand.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
                          </Button>
                        </Can>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Can>

      {/* Actions */}
      {staff?.is_super_admin && (
        <Card>
          <CardHeader>
            <CardTitle>Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => impersonate.mutate()} disabled={impersonate.isPending}>
              {impersonate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Impersonate customer
            </Button>
            <Can permission="customers.delete">
              <Button
                variant="destructive"
                onClick={() =>
                  confirm.open({
                    title: `Delete ${data.full_name || data.email}?`,
                    description: "Permanently deletes their login and all associated data. This cannot be undone.",
                    confirmLabel: "Delete customer",
                    destructive: true,
                    onConfirm: async () => { await deleteCustomer.mutateAsync(); },
                  })
                }
                disabled={deleteCustomer.isPending}
              >
                {deleteCustomer.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete customer
              </Button>
            </Can>
          </CardContent>
        </Card>
      )}
      {confirm.element}
    </div>
  );
}
