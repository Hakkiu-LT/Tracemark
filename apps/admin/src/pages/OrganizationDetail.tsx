import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Pencil, Plus, X } from "lucide-react";
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
}
interface OrgDetail {
  id: string;
  name: string | null;
  industry: string | null;
  persona: string | null;
  member_count: number;
  brand_count: number;
  members: Member[];
  brands: {
    id: string; brand_name: string; status: string; website: string | null; registration_number: string | null;
    official_domains?: string[] | null; official_advertisers?: string[] | null; logo_color?: string | null;
  }[];
}

const ORG_ROLES = ["owner", "admin", "member"];

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
  const { data: cases } = useQuery({
    queryKey: ["organization-cases", orgId],
    queryFn: () => adminFetch<{ id: string; brand_name: string; status: string; risk_level: string | null; infringement_count: number }[]>(`/cases?organization_id=${orgId}`),
  });

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
          </>
        )}
      </div>

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
