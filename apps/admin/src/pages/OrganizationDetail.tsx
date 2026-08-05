import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, Pencil, Plus, UserPlus, X } from "lucide-react";
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
  is_staff?: boolean;
  last_sign_in_at?: string | null;
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

const ORG_ROLES = ["owner", "member"];

export function OrganizationDetail() {
  const { orgId } = useParams({ strict: false }) as { orgId: string };
  const qc = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [brandEdit, setBrandEdit] = useState<OrgDetail["brands"][number] | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [deletingMember, setDeletingMember] = useState<OrgDetail["members"][number] | null>(null);
  const autoOpenedCreateUser = useRef(false);

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

  // A company with no users cannot be logged into. As soon as we land on a 0-member company
  // (typically right after creating it), auto-open the Create-user dialog ONCE so onboarding
  // flows straight from "create company" to "create its first login". Only once per mount —
  // if staff close it deliberately it won't nag.
  useEffect(() => {
    if (data && data.members.length === 0 && !autoOpenedCreateUser.current) {
      autoOpenedCreateUser.current = true;
      setCreatingUser(true);
    }
  }, [data]);

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

  // Full delete: removes the login from EVERYWHERE (auth user + profile + all
  // memberships), not just this company. Backend = delete_customer. Used for real
  // customers only — staff accounts are detached instead (see detachMember).
  const deleteUser = useMutation({
    mutationFn: (userId: string) =>
      adminFetch(`/customers/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("User deleted everywhere");
      setDeletingMember(null);
      qc.invalidateQueries({ queryKey: ["organization", orgId] });
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Detach only: removes the org membership but keeps the login. Used for staff /
  // super-admin members (never delete their auth account from a company view).
  const detachMember = useMutation({
    mutationFn: (userId: string) =>
      adminFetch(`/organizations/${orgId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Removed from company");
      qc.invalidateQueries({ queryKey: ["organization", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Emails the customer a set-password ("login") link. Works for onboarding a new user or
  // when a customer says "I can't log in". Backend sends only to the stored email.
  const sendInvite = useMutation({
    mutationFn: (userId: string) => adminFetch(`/customers/${userId}/send-invite`, { method: "POST" }),
    onSuccess: () => toast.success("Login link emailed to the customer"),
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
          <div className="flex gap-2">
            <Can permission="customers.create">
              <Button size="sm" onClick={() => setCreatingUser(true)}>
                <Plus className="h-4 w-4" /> Create user
              </Button>
            </Can>
            <Can permission="customers.edit">
              <Button size="sm" variant="outline" onClick={() => setAddingMember(true)}>
                <Plus className="h-4 w-4" /> Add existing
              </Button>
            </Can>
          </div>
        </CardHeader>
        <CardContent>
          {data.members.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-muted/30 py-8 text-center">
              <UserPlus className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">This company has no logins yet</p>
                <p className="text-sm text-muted-foreground">Nobody can sign in until you create the first user.</p>
              </div>
              <Can permission="customers.create">
                <Button size="sm" onClick={() => setCreatingUser(true)}>
                  <Plus className="h-4 w-4" /> Create first user
                </Button>
              </Can>
            </div>
          ) : (
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
              {(() => {
                const ownerCount = data.members.filter((m) => m.org_role === "owner").length;
                return data.members.map((m) => {
                  const isLastOwner = m.org_role === "owner" && ownerCount <= 1;
                  return (
                    <TableRow key={m.user_id}>
                      <TableCell className="font-medium">
                        <Link to="/customers/$userId" params={{ userId: m.user_id }} className="text-accent hover:underline">
                          {m.full_name || "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.email}
                        {!m.is_staff && !m.last_sign_in_at && (
                          <Badge variant="outline" className="ml-2 text-[10px]">Never signed in</Badge>
                        )}
                      </TableCell>
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
                        {!m.is_staff && (
                          <Can permission="customers.invite">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => sendInvite.mutate(m.user_id)}
                              disabled={sendInvite.isPending}
                              title="Email this user a set-password / login link"
                            >
                              {sendInvite.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send login link"}
                            </Button>
                          </Can>
                        )}
                        <Can permission="customers.edit">
                          {m.is_staff ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => detachMember.mutate(m.user_id)}
                              disabled={detachMember.isPending || isLastOwner}
                              title={isLastOwner ? "Cannot remove the last owner. Transfer ownership first." : "Staff account — only detaches from this company (login is kept)"}
                            >
                              {detachMember.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => setDeletingMember(m)}
                              disabled={deleteUser.isPending || isLastOwner}
                              title={isLastOwner ? "Cannot delete the last owner. Transfer ownership first." : "Permanently deletes this login everywhere"}
                            >
                              Delete
                            </Button>
                          )}
                        </Can>
                      </TableCell>
                    </TableRow>
                  );
                });
              })()}
            </TableBody>
          </Table>
          )}
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
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Brands ({data.brands.length})</CardTitle>
            <Can permission="brands.create">
              <Button size="sm" onClick={() => setCreatingBrand(true)}>
                <Plus className="h-4 w-4" /> Add brand
              </Button>
            </Can>
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

      {/* Plan & Limits */}
      <Can permission="limits.view">
        <LimitsCard orgId={orgId} />
      </Can>

      {creatingUser && (
        <CreateUserDialog
          orgId={orgId}
          onClose={() => setCreatingUser(false)}
          onCreated={() => {
            setCreatingUser(false);
            qc.invalidateQueries({ queryKey: ["organization", orgId] });
          }}
        />
      )}

      {creatingBrand && (
        <BrandCreateDialog
          orgId={orgId}
          onClose={() => setCreatingBrand(false)}
          onCreated={() => {
            setCreatingBrand(false);
            qc.invalidateQueries({ queryKey: ["organization", orgId] });
          }}
        />
      )}

      {addingMember && (
        <AddMemberDialog
          orgId={orgId}
          existingIds={data.members.map((m) => m.user_id)}
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

      {deletingMember && (
        <Dialog
          open
          onClose={() => setDeletingMember(null)}
          title="Delete this user everywhere?"
          description="This permanently deletes the login, profile and ALL company memberships — not just from this company. This cannot be undone."
          footer={
            <>
              <Button variant="outline" onClick={() => setDeletingMember(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteUser.mutate(deletingMember.user_id)}
                disabled={deleteUser.isPending}
              >
                {deleteUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete everywhere
              </Button>
            </>
          }
        >
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <div className="font-medium">{deletingMember.full_name || "—"}</div>
            <div className="text-muted-foreground">{deletingMember.email}</div>
          </div>
        </Dialog>
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

// Creates a brand-new login (Supabase auth user) already attached to this company.
function CreateUserDialog({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  // Default to emailing the customer a set-password link — the recommended way to hand over
  // a new login (no manual password to transmit). Staff can uncheck to set one directly.
  const [sendInvite, setSendInvite] = useState(true);

  const create = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        email: email.trim(),
        organization_id: orgId,
        send_invite: sendInvite,
      };
      if (!sendInvite) body.password = password;
      if (fullName.trim()) body.full_name = fullName.trim();
      return adminFetch("/customers", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast.success(sendInvite ? "User created — login link emailed" : "User login created in this company");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = email.trim().length > 3 && (sendInvite || password.length >= 8);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Create user"
      description="Creates a new dashboard login already attached to this company."
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
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} />
        Email the customer a set-password link (recommended)
      </label>
      {!sendInvite && (
        <div className="space-y-1.5">
          <Label>Password <span className="text-xs text-muted-foreground">(min 8 characters)</span></Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Full name <span className="text-xs text-muted-foreground">(optional)</span></Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="—" />
      </div>
    </Dialog>
  );
}

// A person returned by the global /search endpoint (staff accounts are excluded server-side).
interface SearchPerson {
  user_id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
}
interface SearchResults {
  organizations: unknown[];
  people: SearchPerson[];
  brands: unknown[];
}

// Adds an EXISTING customer login to this company. Instead of pasting a raw UUID, staff
// search by name/email (debounced /search) and pick from the results.
function AddMemberDialog({
  orgId,
  existingIds,
  onClose,
  onAdded,
}: {
  orgId: string;
  existingIds: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<SearchPerson | null>(null);
  const [role, setRole] = useState("member");

  // Debounce the query so we don't fire a request on every keystroke (mirrors SearchBox).
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["member-search", debounced],
    // include_staff=true so staff / super-admin logins can be attached to a company
    // (the global search box omits it and stays customer-only).
    queryFn: () => adminFetch<SearchResults>(`/search?q=${encodeURIComponent(debounced)}&include_staff=true`),
    enabled: debounced.length >= 1 && !selected,
  });

  // Hide anyone who is already a member of THIS company.
  const results = (data?.people ?? []).filter((p) => !existingIds.includes(p.user_id));

  const add = useMutation({
    mutationFn: () =>
      adminFetch(`/organizations/${orgId}/members`, {
        method: "POST",
        body: JSON.stringify({ user_id: selected!.user_id, role }),
      }),
    onSuccess: () => { toast.success("Member added"); onAdded(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add member"
      description="Search for an existing customer by name or email, then add them to this company."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => add.mutate()} disabled={add.isPending || !selected}>
            {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Add
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label>Customer</Label>
        {selected ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{selected.full_name || "—"}</div>
              <div className="truncate text-xs text-muted-foreground">{selected.email}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setQuery(""); }}>
              <X className="h-4 w-4" /> Change
            </Button>
          </div>
        ) : (
          <>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              autoFocus
            />
            {debounced.length >= 1 && (
              <div className="mt-1 max-h-56 overflow-y-auto rounded-md border border-border">
                {isFetching ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                  </div>
                ) : results.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No matching customers.</div>
                ) : (
                  results.map((p) => (
                    <button
                      key={p.user_id}
                      type="button"
                      onClick={() => setSelected(p)}
                      className="block w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted/40"
                    >
                      <div className="truncate text-sm">{p.full_name || "—"}</div>
                      <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                    </button>
                  ))
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Only existing customer logins appear here; staff accounts are excluded.</p>
          </>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="owner">owner</option>
          <option value="member">member</option>
        </Select>
      </div>
    </Dialog>
  );
}

// Creates a brand for this company on the customer's behalf. Mirrors the fields the customer
// sees when THEY add a brand; the rest (domains, advertisers, logos) are editable afterwards.
function BrandCreateDialog({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const [brandName, setBrandName] = useState("");
  const [website, setWebsite] = useState("");
  const [reg, setReg] = useState("");
  const [platforms, setPlatforms] = useState("");
  const [targetRegions, setTargetRegions] = useState("");

  const create = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        organization_id: orgId,
        brand_name: brandName.trim(),
      };
      if (website.trim()) body.website = website.trim();
      if (reg.trim()) body.registration_number = reg.trim();
      if (fromLines(platforms).length) body.platforms = fromLines(platforms);
      if (fromLines(targetRegions).length) body.target_regions = fromLines(targetRegions);
      return adminFetch("/brands", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => { toast.success("Brand created for this company"); onCreated(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = brandName.trim().length > 0;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add brand"
      description="Creates a monitored brand for this company. You can add logos, domains and advertisers after."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !canSubmit}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create brand
          </Button>
        </>
      }
    >
      <div className="space-y-1.5"><Label>Brand name</Label><Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Acme" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Website <span className="text-xs text-muted-foreground">(optional)</span></Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" /></div>
        <div className="space-y-1.5"><Label>Registration # <span className="text-xs text-muted-foreground">(optional)</span></Label><Input value={reg} onChange={(e) => setReg(e.target.value)} /></div>
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
    </Dialog>
  );
}

interface OrgLimits {
  organization_id: string;
  brands_limit: number | null; // null = unlimited
  brands_used: number;
  note: string | null;
}

// "Plan & Limits" — a company's brand cap + usage. Anyone with limits.view sees it; only
// limits.manage (admin/super-admin) can change the cap (raising it is a commercial concession).
function LimitsCard({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [unlimited, setUnlimited] = useState(true);
  const [cap, setCap] = useState("");
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["org-limits", orgId],
    queryFn: () => adminFetch<OrgLimits>(`/organizations/${orgId}/limits`),
  });

  useEffect(() => {
    if (!data) return;
    setUnlimited(data.brands_limit == null);
    setCap(data.brands_limit == null ? "" : String(data.brands_limit));
    setNote(data.note ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      adminFetch(`/organizations/${orgId}/limits`, {
        method: "PUT",
        body: JSON.stringify({
          brands_limit: unlimited ? null : Math.max(0, parseInt(cap || "0", 10)),
          note: note.trim() || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Limits updated");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["org-limits", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Plan &amp; Limits</CardTitle>
        {!editing && (
          <Can permission="limits.manage">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit limits
            </Button>
          </Can>
        )}
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="h-10 w-full" />
        ) : !editing ? (
          <div className="flex items-center gap-6 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Brands</div>
              <div className="font-medium tabular-nums">
                {data.brands_used} / {data.brands_limit == null ? "∞ (unlimited)" : data.brands_limit}
              </div>
            </div>
            {data.note && <div className="text-muted-foreground">{data.note}</div>}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
              Unlimited brands
            </label>
            {!unlimited && (
              <div className="space-y-1.5">
                <Label>Brand cap</Label>
                <Input type="number" min={0} value={cap} onChange={(e) => setCap(e.target.value)} className="w-32" />
                {data.brands_used > 0 && (
                  <p className="text-xs text-muted-foreground">This company already has {data.brands_used} brand(s).</p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Note <span className="text-xs text-muted-foreground">(why this limit)</span></Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Enterprise deal — 20 brands" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
