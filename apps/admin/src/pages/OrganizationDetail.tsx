import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Pencil, Plus, Settings, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { adminFetch } from "@/lib/api";
import { Can } from "@/components/Can";
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

interface Member {
  user_id: string;
  email: string;
  full_name: string | null;
  org_role: string;
  plan: string;
}
interface OrgDetail {
  id: string;
  name: string | null;
  industry: string | null;
  persona: string | null;
  plan: string;
  member_count: number;
  brand_count: number;
  mrr: number;
  members: Member[];
  brands: {
    id: string; brand_name: string; status: string; website: string | null; registration_number: string | null;
    official_domains?: string[] | null; official_advertisers?: string[] | null; logo_color?: string | null;
  }[];
  subscription: { plan: string; status: string; interval: string; cancel_at_period_end: boolean } | null;
  invoices: { id: string; amount_due: number; currency: string; status: string; hosted_invoice_url: string | null; created_at: string | null }[];
}
interface Usage {
  plan: string;
  limits: Record<string, unknown>;
  usage: {
    brands: number;
    brands_limit: number | null;
    cases: number;
    infringements: number;
    regions_used: number;
    regions: string[];
    regions_limit: number | null;
    platforms_limit: number | null;
    domain_tracking: boolean;
    managed_takedown: boolean;
    api_access: boolean;
    advanced_reports: boolean;
    real_time_scans: boolean;
  };
}

interface EntitlementOverride {
  brands_override?: number | null;
  platforms_override?: number | null;
  regions_override?: number | null;
  domain_tracking?: boolean | null;
  managed_takedown?: boolean | null;
  api_access?: boolean | null;
  advanced_reports?: boolean | null;
  real_time_scans?: boolean | null;
  note?: string | null;
}

const ORG_ROLES = ["owner", "admin", "member"];

function limitText(v: number | null | undefined) {
  return v === null || v === undefined ? "∞" : String(v);
}

export function OrganizationDetail() {
  const { orgId } = useParams({ strict: false }) as { orgId: string };
  const qc = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [brandEdit, setBrandEdit] = useState<OrgDetail["brands"][number] | null>(null);
  const [addingMember, setAddingMember] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => adminFetch<OrgDetail>(`/organizations/${orgId}`),
  });
  const { data: usage } = useQuery({
    queryKey: ["organization-usage", orgId],
    queryFn: () => adminFetch<Usage>(`/organizations/${orgId}/usage`),
  });
  const { data: cases } = useQuery({
    queryKey: ["organization-cases", orgId],
    queryFn: () => adminFetch<{ id: string; brand_name: string; status: string; risk_level: string | null; infringement_count: number }[]>(`/cases?organization_id=${orgId}`),
  });
  const { data: overrideData, refetch: refetchOverride } = useQuery({
    queryKey: ["organization-override", orgId],
    queryFn: () => adminFetch<EntitlementOverride>(`/organizations/${orgId}/entitlement-override`),
  });
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  useEffect(() => {
    if (data?.name != null) setName(data.name);
  }, [data?.name]);

  const saveName = useMutation({
    mutationFn: (newName: string) =>
      adminFetch(`/organizations/${orgId}`, { method: "PATCH", body: JSON.stringify({ name: newName }) }),
    onSuccess: () => {
      toast.success("Company name updated");
      setEditingName(false);
      qc.invalidateQueries({ queryKey: ["organization", orgId] });
      qc.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setMemberRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminFetch(`/organizations/${orgId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      toast.success("Member role updated");
      qc.invalidateQueries({ queryKey: ["organization", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      adminFetch(`/organizations/${orgId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Member removed");
      qc.invalidateQueries({ queryKey: ["organization", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-6 md:p-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const u = usage?.usage;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 md:p-8">
      <Link to="/organizations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to companies
      </Link>

      {/* Header / editable name */}
      <div className="flex items-center gap-3">
        {editingName ? (
          <>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs text-lg" />
            <Button size="sm" onClick={() => saveName.mutate(name)} disabled={saveName.isPending}>
              {saveName.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">{data.name || "Unnamed company"}</h1>
            <Can permission="customers.edit">
              <Button size="icon" variant="ghost" onClick={() => setEditingName(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </Can>
            <Badge variant="outline">{data.persona === "law_firm" ? "Law Firm" : "Brand Owner"}</Badge>
            <Badge variant={data.plan === "free" ? "secondary" : "success"} className="capitalize">{data.plan}</Badge>
          </>
        )}
      </div>

      {/* Usage vs limits */}
      <Card>
        <CardHeader><CardTitle>Usage</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {u ? (
            <>
              <Metric label="Brands" value={`${u.brands} / ${limitText(u.brands_limit)}`} />
              <Metric label="Scans / cases" value={String(u.cases)} />
              <Metric label="Infringements" value={String(u.infringements)} />
              <Metric label="Regions" value={`${u.regions_used} / ${limitText(u.regions_limit)}`} />
              <Metric label="Platforms limit" value={limitText(u.platforms_limit)} />
              <Metric label="Domain tracking" value={u.domain_tracking ? "On" : "Off"} />
              <Metric label="Managed takedown" value={u.managed_takedown ? "On" : "Off"} />
              <Metric label="API access" value={u.api_access ? "On" : "Off"} />
            </>
          ) : (
            <Skeleton className="col-span-full h-16 w-full" />
          )}
        </CardContent>
      </Card>

      {/* Entitlement overrides */}
      <Can permission="entitlements.manage">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Custom limits override</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Applied on top of plan+add-ons. Use for negotiated Pro/Enterprise deals.
              </p>
            </div>
            <div className="flex gap-2">
              {overrideData && Object.keys(overrideData).some((k) => overrideData[k as keyof EntitlementOverride] != null) && (
                <ClearOverrideButton orgId={orgId} onCleared={() => { refetchOverride(); qc.invalidateQueries({ queryKey: ["organization-usage", orgId] }); }} />
              )}
              <Button size="sm" variant="outline" onClick={() => setShowOverrideModal(true)}>
                <Settings className="h-4 w-4 mr-1" /> Set override
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {overrideData && Object.keys(overrideData).some((k) => overrideData[k as keyof EntitlementOverride] != null) ? (
              <div className="flex flex-wrap gap-3 text-sm">
                {overrideData.brands_override != null && (
                  <span className="rounded-md bg-accent/10 px-2 py-1 font-mono text-xs">
                    brands: {overrideData.brands_override < 0 ? "∞" : overrideData.brands_override}
                  </span>
                )}
                {overrideData.platforms_override != null && (
                  <span className="rounded-md bg-accent/10 px-2 py-1 font-mono text-xs">
                    platforms: {overrideData.platforms_override < 0 ? "∞" : overrideData.platforms_override}
                  </span>
                )}
                {overrideData.regions_override != null && (
                  <span className="rounded-md bg-accent/10 px-2 py-1 font-mono text-xs">
                    regions: {overrideData.regions_override < 0 ? "∞" : overrideData.regions_override}
                  </span>
                )}
                {(["domain_tracking", "managed_takedown", "api_access", "advanced_reports", "real_time_scans"] as const).map((flag) =>
                  overrideData[flag] != null ? (
                    <span key={flag} className={`rounded-md px-2 py-1 font-mono text-xs ${overrideData[flag] ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
                      {flag.replace(/_/g, " ")}: {overrideData[flag] ? "on" : "off"}
                    </span>
                  ) : null
                )}
                {overrideData.note && (
                  <span className="text-muted-foreground italic">Note: {overrideData.note}</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No custom override set — using plan+add-on computed limits.</p>
            )}
          </CardContent>
        </Card>
      </Can>

      {/* Members */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Users ({data.members.length})</CardTitle>
          <Can permission="customers.edit">
            <Button size="sm" variant="outline" onClick={() => setAddingMember(true)}>
              <Plus className="h-4 w-4" /> Add member
            </Button>
          </Can>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.members.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell className="font-medium">
                    <Link to="/customers/$userId" params={{ userId: m.user_id }} className="text-accent hover:underline">
                      {m.full_name || "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell>
                    <Can permission="customers.edit" fallback={<Badge variant="outline" className="capitalize">{m.org_role}</Badge>}>
                      <Select
                        value={m.org_role}
                        onChange={(e) => setMemberRole.mutate({ userId: m.user_id, role: e.target.value })}
                        className="h-8 w-32"
                      >
                        {ORG_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </Select>
                    </Can>
                  </TableCell>
                  <TableCell className="text-right">
                    <Can permission="customers.edit">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => removeMember.mutate(m.user_id)}
                        disabled={removeMember.isPending}
                      >
                        {removeMember.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
                      </Button>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cases */}
      <Card>
        <CardHeader><CardTitle>Cases ({cases?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!cases || cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cases yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Infringements</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((cs) => (
                  <TableRow key={cs.id}>
                    <TableCell className="font-medium">
                      <Link to="/cases/$caseId" params={{ caseId: cs.id }} className="text-accent hover:underline">
                        {cs.brand_name}
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{cs.status}</Badge></TableCell>
                    <TableCell>{cs.risk_level || "—"}</TableCell>
                    <TableCell className="tabular-nums">{cs.infringement_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Billing */}
      <Can permission="billing.view">
        <Card>
          <CardHeader><CardTitle>Billing</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {data.subscription ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="outline" className="capitalize">{data.subscription.plan}</Badge>
                <span className="text-muted-foreground">{data.subscription.status} / {data.subscription.interval}</span>
                {data.subscription.cancel_at_period_end && <Badge variant="warning">Cancels at period end</Badge>}
                {data.mrr > 0 && <span className="text-muted-foreground">MRR ${data.mrr}</span>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active subscription.{data.mrr > 0 ? ` MRR $${data.mrr}` : ""}</p>
            )}
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
                        ) : `${inv.id.slice(0, 14)}…`}
                      </TableCell>
                      <TableCell>{(inv.amount_due / 100).toFixed(2)} {inv.currency.toUpperCase()}</TableCell>
                      <TableCell><Badge variant={inv.status === "paid" ? "success" : "secondary"}>{inv.status}</Badge></TableCell>
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
          <CardHeader><CardTitle>Brands ({data.brands.length})</CardTitle></CardHeader>
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
                      <TableCell><Badge variant="outline" className="capitalize">{b.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{b.website || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Can permission="brands.edit">
                          <Button size="sm" variant="ghost" onClick={() => setBrandEdit(b)}>Edit</Button>
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

      {showOverrideModal && (
        <EntitlementOverrideDialog
          orgId={orgId}
          current={overrideData || {}}
          onClose={() => setShowOverrideModal(false)}
          onSaved={() => {
            setShowOverrideModal(false);
            refetchOverride();
            qc.invalidateQueries({ queryKey: ["organization-usage", orgId] });
          }}
        />
      )}

      {addingMember && (
        <AddMemberDialog
          orgId={orgId}
          onClose={() => setAddingMember(false)}
          onAdded={() => {
            setAddingMember(false);
            qc.invalidateQueries({ queryKey: ["organization", orgId] });
          }}
        />
      )}

      {brandEdit && (
        <BrandEditDialog
          brand={brandEdit}
          onClose={() => setBrandEdit(null)}
          onSaved={() => {
            setBrandEdit(null);
            qc.invalidateQueries({ queryKey: ["organization", orgId] });
          }}
        />
      )}
    </div>
  );
}

// ── ClearOverrideButton ───────────────────────────────────────────────────────
function ClearOverrideButton({ orgId, onCleared }: { orgId: string; onCleared: () => void }) {
  const clear = useMutation({
    mutationFn: () => adminFetch(`/organizations/${orgId}/entitlement-override`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Overrides cleared"); onCleared(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button size="sm" variant="outline" className="text-destructive" onClick={() => clear.mutate()} disabled={clear.isPending}>
      {clear.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
      Clear
    </Button>
  );
}

// ── EntitlementOverrideDialog ─────────────────────────────────────────────────
const NUMERIC_FIELDS: { key: keyof EntitlementOverride; label: string }[] = [
  { key: "brands_override", label: "Max brands (-1 = unlimited)" },
  { key: "platforms_override", label: "Max platforms (-1 = unlimited)" },
  { key: "regions_override", label: "Max regions (-1 = unlimited)" },
];
const BOOL_FLAGS: { key: keyof EntitlementOverride; label: string }[] = [
  { key: "domain_tracking", label: "Domain tracking" },
  { key: "managed_takedown", label: "Managed takedown" },
  { key: "api_access", label: "API access" },
  { key: "advanced_reports", label: "Advanced reports" },
  { key: "real_time_scans", label: "Real-time scans" },
];

function EntitlementOverrideDialog({
  orgId,
  current,
  onClose,
  onSaved,
}: {
  orgId: string;
  current: EntitlementOverride;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, string | boolean | null>>({
    brands_override: current.brands_override != null ? String(current.brands_override) : "",
    platforms_override: current.platforms_override != null ? String(current.platforms_override) : "",
    regions_override: current.regions_override != null ? String(current.regions_override) : "",
    domain_tracking: current.domain_tracking ?? null,
    managed_takedown: current.managed_takedown ?? null,
    api_access: current.api_access ?? null,
    advanced_reports: current.advanced_reports ?? null,
    real_time_scans: current.real_time_scans ?? null,
    note: current.note ?? "",
  });

  const save = useMutation({
    mutationFn: () => {
      // Always send all 8 fields. null = "revert this field to plan+addon default".
      // This lets staff un-override a single flag without deleting the whole row.
      const payload: EntitlementOverride = {};
      for (const { key } of NUMERIC_FIELDS) {
        const v = form[key];
        payload[key] = (v !== "" && v != null ? parseInt(v as string, 10) : null) as never;
      }
      for (const { key } of BOOL_FLAGS) {
        payload[key] = (form[key] ?? null) as never;
      }
      if (form.note) payload.note = form.note as string;
      return adminFetch(`/organizations/${orgId}/entitlement-override`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => { toast.success("Overrides saved"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Custom entitlement overrides"
      description="Leave fields blank to keep the plan+add-on default. Use -1 for unlimited on numeric fields."
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save overrides
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-3">
          {NUMERIC_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="number"
                placeholder="blank = no override"
                value={form[key] as string}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="h-9"
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Feature flags</p>
          {BOOL_FLAGS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <select
                className="h-8 rounded border bg-background px-2 text-sm"
                value={form[key] == null ? "" : form[key] ? "true" : "false"}
                onChange={(e) => setForm((f) => ({
                  ...f,
                  [key]: e.target.value === "" ? null : e.target.value === "true",
                }))}
              >
                <option value="">— no override —</option>
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="override-note">Staff note (why this override exists)</Label>
          <Input
            id="override-note"
            placeholder="e.g. Enterprise deal, 12-month contract"
            value={form.note as string}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="h-9"
          />
        </div>
      </div>
    </Dialog>
  );
}

interface BrandAsset {
  id: string;
  asset_type: string;
  signed_url: string | null;
  metadata: { filename?: string } | null;
}

function toLines(arr?: string[] | null) {
  return (arr || []).join("\n");
}
function fromLines(s: string) {
  return s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
}

function BrandEditDialog({
  brand,
  onClose,
  onSaved,
}: {
  brand: OrgDetail["brands"][number];
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [brandName, setBrandName] = useState(brand.brand_name);
  const [website, setWebsite] = useState(brand.website || "");
  const [reg, setReg] = useState(brand.registration_number || "");
  const [status, setStatus] = useState(brand.status);
  const [domains, setDomains] = useState(toLines(brand.official_domains));
  const [advertisers, setAdvertisers] = useState(toLines(brand.official_advertisers));
  const [platforms, setPlatforms] = useState(toLines((brand as {platforms?: string[] | null}).platforms));
  const [targetRegions, setTargetRegions] = useState(toLines((brand as {target_regions?: string[] | null}).target_regions));
  const [logoColor, setLogoColor] = useState(brand.logo_color || "");
  const [assetType, setAssetType] = useState<"logo" | "product_image">("logo");
  const [uploading, setUploading] = useState(false);

  const { data: assets } = useQuery({
    queryKey: ["brand-assets", brand.id],
    queryFn: () => adminFetch<BrandAsset[]>(`/brands/${brand.id}/assets`),
  });

  const save = useMutation({
    mutationFn: () =>
      adminFetch(`/brands/${brand.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          brand_name: brandName, website, registration_number: reg, status,
          official_domains: fromLines(domains), official_advertisers: fromLines(advertisers),
          platforms: fromLines(platforms).length ? fromLines(platforms) : undefined,
          target_regions: fromLines(targetRegions).length ? fromLines(targetRegions) : undefined,
          logo_color: logoColor || undefined,
        }),
      }),
    onSuccess: () => { toast.success("Brand updated"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAsset = useMutation({
    mutationFn: (assetId: string) => adminFetch(`/brands/${brand.id}/assets/${assetId}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Photo removed"); qc.invalidateQueries({ queryKey: ["brand-assets", brand.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("asset_type", assetType);
      fd.append("file", file);
      await adminFetch(`/brands/${brand.id}/assets`, { method: "POST", body: fd });
      toast.success("Photo uploaded");
      qc.invalidateQueries({ queryKey: ["brand-assets", brand.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit brand — ${brand.brand_name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save fields
          </Button>
        </>
      }
    >
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        <div className="space-y-1.5"><Label>Brand name</Label><Input value={brandName} onChange={(e) => setBrandName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Registration #</Label><Input value={reg} onChange={(e) => setReg(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">active</option>
              <option value="on_hold">on_hold</option>
              <option value="locked">locked</option>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Logo color</Label><Input value={logoColor} onChange={(e) => setLogoColor(e.target.value)} placeholder="oklch(…) or #hex" /></div>
        </div>
        <div className="space-y-1.5">
          <Label>Official domains <span className="text-xs text-muted-foreground">(one per line)</span></Label>
          <textarea value={domains} onChange={(e) => setDomains(e.target.value)} className="min-h-16 w-full rounded-md border border-input bg-transparent p-2 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label>Official advertisers <span className="text-xs text-muted-foreground">(one per line)</span></Label>
          <textarea value={advertisers} onChange={(e) => setAdvertisers(e.target.value)} className="min-h-16 w-full rounded-md border border-input bg-transparent p-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Platforms <span className="text-xs text-muted-foreground">(one per line)</span></Label>
            <textarea value={platforms} onChange={(e) => setPlatforms(e.target.value)} className="min-h-16 w-full rounded-md border border-input bg-transparent p-2 text-sm" placeholder="amazon&#10;ebay&#10;aliexpress" />
          </div>
          <div className="space-y-1.5">
            <Label>Target regions <span className="text-xs text-muted-foreground">(one per line)</span></Label>
            <textarea value={targetRegions} onChange={(e) => setTargetRegions(e.target.value)} className="min-h-16 w-full rounded-md border border-input bg-transparent p-2 text-sm" placeholder="US&#10;EU&#10;GB" />
          </div>
        </div>

        {/* Photos */}
        <div className="space-y-2 border-t border-border pt-3">
          <Label>Photos (logos / product images)</Label>
          <div className="flex flex-wrap gap-3">
            {(assets || []).map((a) => (
              <div key={a.id} className="relative">
                {a.signed_url ? (
                  <img src={a.signed_url} alt={a.asset_type} className="h-20 w-20 rounded border border-border object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded border border-border text-[10px] text-muted-foreground">{a.asset_type}</div>
                )}
                <button
                  onClick={() => removeAsset.mutate(a.id)}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                  title="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
                <span className="mt-0.5 block text-center text-[9px] text-muted-foreground">{a.asset_type}</span>
              </div>
            ))}
            {(assets || []).length === 0 && <p className="text-xs text-muted-foreground">No photos yet.</p>}
          </div>
          <div className="flex items-center gap-2">
            <Select value={assetType} onChange={(e) => setAssetType(e.target.value as "logo" | "product_image")} className="h-8 w-36">
              <option value="logo">logo</option>
              <option value="product_image">product_image</option>
            </Select>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0] ?? null)} />
              <span className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm hover:bg-muted">
                {uploading ? "Uploading…" : "Upload photo"}
              </span>
            </label>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function AddMemberDialog({ orgId, onClose, onAdded }: { orgId: string; onClose: () => void; onAdded: () => void }) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("member");

  const add = useMutation({
    mutationFn: () =>
      adminFetch(`/organizations/${orgId}/members`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId.trim(), role }),
      }),
    onSuccess: () => { toast.success("Member added"); onAdded(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add member"
      description="Add an existing customer to this organization by their user ID."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => add.mutate()} disabled={add.isPending || !userId.trim()}>
            {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Add
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label>Customer user ID</Label>
        <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="uuid…" className="font-mono text-xs" />
        <p className="text-xs text-muted-foreground">Find the ID on the customer's detail page.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="owner">owner</option>
          <option value="admin">admin</option>
          <option value="member">member</option>
        </Select>
      </div>
    </Dialog>
  );
}
