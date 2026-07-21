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
  Select,
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
interface Subscription {
  plan: string;
  status: string;
  interval: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}
interface Invoice {
  id: string;
  amount_due: number;
  currency: string;
  status: string;
  hosted_invoice_url: string | null;
  created_at: string | null;
}
interface CustomerDetail {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
  plan: string;
  persona: string | null;
  brands: Brand[];
  subscription: Subscription | null;
  invoices: Invoice[];
}

const PLANS = ["free", "starter", "growth", "pro", "agency", "enterprise"];

export function CustomerDetail() {
  const { userId } = useParams({ strict: false }) as { userId: string };
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { staff } = useAuth();
  const confirm = useConfirm();
  const [plan, setPlan] = useState<string>("");
  const [billingMode, setBillingMode] = useState<"comp" | "charge">("comp");
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

  const changePlan = useMutation({
    mutationFn: ({ newPlan, mode }: { newPlan: string; mode: "comp" | "charge" }) =>
      adminFetch(`/customers/${userId}/plan`, {
        method: "PUT",
        body: JSON.stringify({ plan: newPlan, mode }),
      }),
    onSuccess: () => {
      toast.success("Plan updated");
      qc.invalidateQueries({ queryKey: ["customer", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelSub = useMutation({
    mutationFn: (cancel: boolean) =>
      adminFetch(`/customers/${userId}/cancel-subscription`, {
        method: "POST",
        body: JSON.stringify({ cancel }),
      }),
    onSuccess: () => {
      toast.success("Subscription updated");
      qc.invalidateQueries({ queryKey: ["customer", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
            persona: data.persona, plan: data.plan, organization_id: data.organization_id,
          }}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground">ID</p>
            <div className="mt-1"><CopyableId id={data.id} length={12} /></div>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Plan</p>
            <Badge variant={data.plan === "free" ? "secondary" : "success"} className="mt-1 capitalize">
              {data.plan}
            </Badge>
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

      {/* Billing */}
      <Can permission="billing.view">
        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.subscription ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="outline" className="capitalize">{data.subscription.plan}</Badge>
                <span className="text-muted-foreground">{data.subscription.status}</span>
                <span className="text-muted-foreground">/ {data.subscription.interval}</span>
                {data.subscription.current_period_end && (
                  <span className="text-muted-foreground">
                    renews {new Date(data.subscription.current_period_end).toLocaleDateString()}
                  </span>
                )}
                {data.subscription.cancel_at_period_end && (
                  <Badge variant="warning">Cancels at period end</Badge>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active subscription.</p>
            )}

            <Can permission="billing.manage">
              <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <Select value={plan || data.plan} onChange={(e) => setPlan(e.target.value)} className="w-40">
                    {PLANS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Apply as</p>
                  <Select value={billingMode} onChange={(e) => setBillingMode(e.target.value as "comp" | "charge")} className="w-56">
                    <option value="comp">Comp — no charge (free)</option>
                    <option value="charge">Charge — bill via Stripe (prorated)</option>
                  </Select>
                </div>
                <Button
                  size="sm"
                  onClick={() => changePlan.mutate({ newPlan: plan || data.plan, mode: billingMode })}
                  disabled={changePlan.isPending}
                >
                  {changePlan.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Apply plan
                </Button>
                {data.subscription && !data.subscription.cancel_at_period_end && (
                  <Button size="sm" variant="destructive" onClick={() => cancelSub.mutate(true)}>
                    Cancel subscription
                  </Button>
                )}
                {data.subscription?.cancel_at_period_end && (
                  <Button size="sm" variant="outline" onClick={() => cancelSub.mutate(false)}>
                    Resume subscription
                  </Button>
                )}
              </div>
            </Can>

            {data.invoices.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {inv.created_at ? new Date(inv.created_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {inv.hosted_invoice_url ? (
                          <a href={inv.hosted_invoice_url} target="_blank" rel="noopener" className="text-accent hover:underline">
                            {inv.id.slice(0, 14)}…
                          </a>
                        ) : (
                          `${inv.id.slice(0, 14)}…`
                        )}
                      </TableCell>
                      <TableCell>
                        {(inv.amount_due / 100).toFixed(2)} {inv.currency.toUpperCase()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={inv.status === "paid" ? "success" : "secondary"}>{inv.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Can>

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
