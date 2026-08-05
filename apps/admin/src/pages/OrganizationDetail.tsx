import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, Pencil, Plus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { adminFetch } from "@/lib/api";
import { PLATFORM_GROUPS, PLATFORM_OPTIONS, REGION_GROUPS } from "@/lib/brand-options";
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
  const [setupLimits, setSetupLimits] = useState(false);
  const limitsRef = useRef<HTMLDivElement>(null);

  // Landed here straight after creating this company? Prompt to set its plan limits FIRST
  // (before creating users/brands). The flag is dropped by the New-company dialog.
  useEffect(() => {
    if (sessionStorage.getItem("hakkiu:setup-limits") === orgId) {
      sessionStorage.removeItem("hakkiu:setup-limits");
      setSetupLimits(true);
      autoOpenedCreateUser.current = true; // don't also pop the create-user dialog over it
    }
  }, [orgId]);

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

  // Scroll the Plan & Limits card into view once it renders, when we're in setup mode.
  useEffect(() => {
    if (setupLimits && data) limitsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [setupLimits, data]);

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

  // Move a multi-company user onto THIS company as their active one — the support-side twin
  // of the customer app's company switcher. Fixes "I added a brand but can't see it": they
  // were just viewing a different active company.
  const setActiveOrg = useMutation({
    mutationFn: (userId: string) =>
      adminFetch(`/organizations/${orgId}/members/${userId}/set-active`, { method: "POST" }),
    onSuccess: () => toast.success("This company is now the customer's active company"),
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
                        <Can permission="organizations.set_active">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setActiveOrg.mutate(m.user_id)}
                            disabled={setActiveOrg.isPending}
                            title="Make this the customer's active company (so its brands show in their monitoring)"
                          >
                            {setActiveOrg.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set active"}
                          </Button>
                        </Can>
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
      <div ref={limitsRef}>
        <Can permission="limits.view">
          <LimitsCard orgId={orgId} autoEdit={setupLimits} />
        </Can>
      </div>

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
          orgId={orgId}
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

// Add/remove a value from a string[], returning a NEW array (immutable toggle).
function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// Read a company's plan limits once; shared by both brand dialogs so the pickers can cap
// selection to what the plan allows. react-query dedupes with LimitsCard's own query.
function useOrgLimits(orgId: string) {
  return useQuery({
    queryKey: ["org-limits", orgId],
    queryFn: () => adminFetch<OrgLimits>(`/organizations/${orgId}/limits`),
  });
}

const chipClass = (active: boolean) =>
  `flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
    active ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground hover:bg-muted/40"
  }`;

// Grouped marketplace picker. `available` = the apiKeys to SHOW (null/empty = show all). Used
// two ways: in Plan & Limits (available=null → show all 12, selected = the allowed whitelist);
// and in the brand dialogs (available = the plan's whitelist → show only what's allowed).
function PlatformPicker({
  selected,
  onChange,
  available,
  label = "Marketplaces / platforms",
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  available?: string[] | null;
  label?: string;
}) {
  const allow = available && available.length ? new Set(available) : null;
  const options = allow ? PLATFORM_OPTIONS.filter((p) => allow.has(p.apiKey)) : PLATFORM_OPTIONS;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{selected.length} selected</span>
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">No marketplaces available in this plan.</p>
      ) : (
        PLATFORM_GROUPS.map((group) => {
          const items = options.filter((p) => p.group === group.key);
          if (!items.length) return null;
          return (
            <div key={group.key} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {items.map((p) => {
                  const active = selected.includes(p.apiKey);
                  return (
                    <button key={p.apiKey} type="button" onClick={() => onChange(toggleValue(selected, p.apiKey))} className={chipClass(active)}>
                      <span className={`h-3.5 w-3.5 shrink-0 rounded border ${active ? "border-accent bg-accent" : "border-input"}`} />
                      <span className="truncate">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// Region picker at MACRO-REGION granularity (North America / Europe / APAC / LATAM — the same
// groups shown on the customer dashboard). Selecting a group toggles ALL its country codes, so
// the stored value stays country-code based (what scraping + the dashboard use). `available` =
// the allowed country codes; a group is only OFFERED when all its countries are allowed
// (null/empty = all groups). Used both in Plan & Limits (choose allowed groups) and the brand
// dialogs (pick from the allowed groups).
function RegionPicker({
  selected,
  onChange,
  available,
  label = "Target regions",
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  available?: string[] | null;
  label?: string;
}) {
  const allow = available && available.length ? new Set(available) : null;
  const groups = REGION_GROUPS.filter((g) => !allow || g.countries.every((c) => allow.has(c.code)));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{groups.filter((g) => g.countries.every((c) => selected.includes(c.code))).length} selected</span>
      </div>
      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">No regions available in this plan.</p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {groups.map((group) => {
            const codes = group.countries.map((c) => c.code);
            const active = codes.every((c) => selected.includes(c));
            return (
              <button
                key={group.key}
                type="button"
                onClick={() =>
                  onChange(
                    active
                      ? selected.filter((c) => !codes.includes(c))
                      : [...selected, ...codes.filter((c) => !selected.includes(c))],
                  )
                }
                className={chipClass(active)}
              >
                <span className={`h-3.5 w-3.5 shrink-0 rounded border ${active ? "border-accent bg-accent" : "border-input"}`} />
                <span className="truncate">{group.label} <span className="text-xs text-muted-foreground">({group.countries.map((c) => c.flag).join(" ")})</span></span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BrandEditDialog({
  brand,
  orgId,
  onClose,
  onSaved,
}: {
  brand: OrgDetail["brands"][number];
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const { data: limits } = useOrgLimits(orgId);
  const [brandName, setBrandName] = useState(brand.brand_name);
  const [website, setWebsite] = useState(brand.website || "");
  const [reg, setReg] = useState(brand.registration_number || "");
  const [status, setStatus] = useState(brand.status);
  const [domains, setDomains] = useState(toLines(brand.official_domains));
  const [advertisers, setAdvertisers] = useState(toLines(brand.official_advertisers));
  const [platforms, setPlatforms] = useState<string[]>((brand as {platforms?: string[] | null}).platforms || []);
  const [regions, setRegions] = useState<string[]>((brand as {target_regions?: string[] | null}).target_regions || []);
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
          platforms, target_regions: regions,
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
        <PlatformPicker selected={platforms} onChange={setPlatforms} available={limits?.allowed_platforms ?? null} />
        <RegionPicker selected={regions} onChange={setRegions} available={limits?.allowed_regions ?? null} />

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
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [domains, setDomains] = useState("");
  const [advertisers, setAdvertisers] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);

  const { data: limits } = useOrgLimits(orgId);
  // At the org's brand cap? Then adding another must be blocked here (mirrors the server RPC).
  const atBrandCap =
    !!limits && limits.brands_limit != null && limits.brands_used >= limits.brands_limit;

  const create = useMutation({
    // Full parity with the customer "Add monitored asset" form: create the brand row, then
    // upload the logo / product image to the SAME brand_assets store the customer app uses
    // (admin POST /brands/{id}/assets proxies to the main API's internal upload).
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        organization_id: orgId,
        brand_name: brandName.trim(),
      };
      if (website.trim()) body.website = website.trim();
      if (reg.trim()) body.registration_number = reg.trim();
      if (platforms.length) body.platforms = platforms;
      if (regions.length) body.target_regions = regions;
      const dom = fromLines(domains);
      const adv = fromLines(advertisers);
      if (dom.length) body.official_domains = dom;
      if (adv.length) body.official_advertisers = adv;

      const created = await adminFetch<{ id: string }>("/brands", {
        method: "POST",
        body: JSON.stringify(body),
      });

      // Upload any queued photos against the freshly-created brand id.
      const uploads: Promise<unknown>[] = [];
      if (logoFile) {
        const fd = new FormData();
        fd.append("asset_type", "logo");
        fd.append("file", logoFile);
        uploads.push(adminFetch(`/brands/${created.id}/assets`, { method: "POST", body: fd }));
      }
      if (productFile) {
        const fd = new FormData();
        fd.append("asset_type", "product_image");
        fd.append("file", productFile);
        uploads.push(adminFetch(`/brands/${created.id}/assets`, { method: "POST", body: fd }));
      }
      if (uploads.length) await Promise.all(uploads);
      return created;
    },
    onSuccess: () => { toast.success("Brand created for this company"); onCreated(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = brandName.trim().length > 0 && !atBrandCap;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add brand"
      description="Creates a monitored brand (asset) for this company — the same thing the customer adds under 'Add monitored asset'. Same fields, same tables."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !canSubmit}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create brand
          </Button>
        </>
      }
    >
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        {atBrandCap && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            This company is at its brand limit ({limits!.brands_used} / {limits!.brands_limit}). Raise the cap
            under <strong>Plan &amp; Limits</strong> before adding another brand.
          </div>
        )}
        <div className="space-y-1.5"><Label>Brand name</Label><Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Acme" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Website <span className="text-xs text-muted-foreground">(optional)</span></Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" /></div>
          <div className="space-y-1.5"><Label>Registration # <span className="text-xs text-muted-foreground">(optional)</span></Label><Input value={reg} onChange={(e) => setReg(e.target.value)} /></div>
        </div>
        <PlatformPicker selected={platforms} onChange={setPlatforms} available={limits?.allowed_platforms ?? null} />
        <RegionPicker selected={regions} onChange={setRegions} available={limits?.allowed_regions ?? null} />
        <div className="space-y-1.5">
          <Label>Official domains <span className="text-xs text-muted-foreground">(one per line)</span></Label>
          <textarea value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="acme.com" className="min-h-16 w-full rounded-md border border-input bg-transparent p-2 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label>Official advertisers <span className="text-xs text-muted-foreground">(one per line)</span></Label>
          <textarea value={advertisers} onChange={(e) => setAdvertisers(e.target.value)} placeholder="Acme Inc." className="min-h-16 w-full rounded-md border border-input bg-transparent p-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
          <div className="space-y-1.5">
            <Label>Logo <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-muted file:px-2 file:py-1 file:text-xs" />
            {logoFile && <span className="block truncate text-[11px] text-muted-foreground">{logoFile.name}</span>}
          </div>
          <div className="space-y-1.5">
            <Label>Product image <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <input type="file" accept="image/*" onChange={(e) => setProductFile(e.target.files?.[0] ?? null)} className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-muted file:px-2 file:py-1 file:text-xs" />
            {productFile && <span className="block truncate text-[11px] text-muted-foreground">{productFile.name}</span>}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

interface OrgLimits {
  organization_id: string;
  brands_limit: number | null; // null = unlimited (org-total brands)
  brands_used: number;
  allowed_platforms: string[] | null; // null = all marketplaces allowed; else whitelist (apiKeys)
  allowed_regions: string[] | null; // null = all regions allowed; else whitelist (country codes)
  note: string | null;
}

// One editable "unlimited | numeric cap" row inside the Plan & Limits editor.
function LimitField({
  label,
  hint,
  unlimited,
  setUnlimited,
  cap,
  setCap,
}: {
  label: string;
  hint?: string;
  unlimited: boolean;
  setUnlimited: (v: boolean) => void;
  cap: string;
  setCap: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5 rounded-md border border-border/60 p-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
          Unlimited
        </label>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {!unlimited && (
        <Input type="number" min={0} value={cap} onChange={(e) => setCap(e.target.value)} className="w-32" />
      )}
    </div>
  );
}

// Human labels for the read-only summary.
function platformLabels(codes: string[]): string {
  return codes.map((c) => PLATFORM_OPTIONS.find((p) => p.apiKey === c)?.label ?? c).join(", ");
}
function regionLabels(codes: string[]): string {
  const set = new Set(codes);
  const parts: string[] = [];
  const claimed = new Set<string>();
  // Collapse fully-selected groups into their macro label (North America, Europe, …).
  for (const g of REGION_GROUPS) {
    if (g.countries.every((c) => set.has(c.code))) {
      parts.push(g.label);
      g.countries.forEach((c) => claimed.add(c.code));
    }
  }
  const all = REGION_GROUPS.flatMap((g) => g.countries);
  for (const c of codes) if (!claimed.has(c)) parts.push(all.find((x) => x.code === c)?.name ?? c);
  return parts.join(", ");
}

// "Plan & Limits" — the deal you agree with a company: a brand cap PLUS exactly which
// marketplaces and regions they may use. Anyone with limits.view sees it; only limits.manage
// (admin/super-admin) can change it. `autoEdit` opens straight into edit mode — used right
// after creating a company so staff set the plan before anything else.
function LimitsCard({ orgId, autoEdit = false }: { orgId: string; autoEdit?: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(autoEdit);

  const [brandsUnlimited, setBrandsUnlimited] = useState(true);
  const [brandsCap, setBrandsCap] = useState("");
  // "Allow all" = no whitelist (unrestricted). When off, the picker chooses the allowed subset.
  const [allPlatforms, setAllPlatforms] = useState(true);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [allRegions, setAllRegions] = useState(true);
  const [regions, setRegions] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["org-limits", orgId],
    queryFn: () => adminFetch<OrgLimits>(`/organizations/${orgId}/limits`),
  });

  useEffect(() => {
    if (!data) return;
    setBrandsUnlimited(data.brands_limit == null);
    setBrandsCap(data.brands_limit == null ? "" : String(data.brands_limit));
    setAllPlatforms(data.allowed_platforms == null);
    setPlatforms(data.allowed_platforms ?? []);
    setAllRegions(data.allowed_regions == null);
    setRegions(data.allowed_regions ?? []);
    setNote(data.note ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      adminFetch(`/organizations/${orgId}/limits`, {
        method: "PUT",
        body: JSON.stringify({
          brands_limit: brandsUnlimited ? null : Math.max(0, parseInt(brandsCap || "0", 10)),
          allowed_platforms: allPlatforms ? null : platforms,
          allowed_regions: allRegions ? null : regions,
          note: note.trim() || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Plan updated");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["org-limits", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fmtBrands = (v: number | null) => (v == null ? "∞ (unlimited)" : v);
  const fmtAllow = (codes: string[] | null, labeller: (c: string[]) => string) =>
    codes == null || codes.length === 0 ? "All allowed" : labeller(codes);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Plan &amp; Limits</CardTitle>
        {!editing && (
          <Can permission="limits.manage">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit plan
            </Button>
          </Can>
        )}
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="h-10 w-full" />
        ) : !editing ? (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-start gap-8">
              <div>
                <div className="text-xs text-muted-foreground">Brands</div>
                <div className="font-medium tabular-nums">{data.brands_used} / {fmtBrands(data.brands_limit)}</div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Marketplaces</div>
                <div className="font-medium">{fmtAllow(data.allowed_platforms, platformLabels)}</div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Regions</div>
                <div className="font-medium">{fmtAllow(data.allowed_regions, regionLabels)}</div>
              </div>
            </div>
            {data.note && <div className="text-muted-foreground">{data.note}</div>}
          </div>
        ) : (
          <div className="space-y-4">
            {autoEdit && (
              <p className="rounded-md border border-accent/30 bg-accent/5 p-3 text-sm text-muted-foreground">
                Set this company's plan before onboarding users and brands: how many brands they get,
                and exactly which marketplaces &amp; regions they may monitor. Leave a box on "Allow all"
                for no restriction.
              </p>
            )}
            <div className="sm:max-w-xs">
              <LimitField
                label="Brands"
                hint={data.brands_used > 0 ? `Already has ${data.brands_used}. Max number of brands.` : "Max number of brands (monitored assets)."}
                unlimited={brandsUnlimited} setUnlimited={setBrandsUnlimited}
                cap={brandsCap} setCap={setBrandsCap}
              />
            </div>

            <div className="space-y-2 rounded-md border border-border/60 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allPlatforms} onChange={(e) => setAllPlatforms(e.target.checked)} />
                Allow all marketplaces
              </label>
              {!allPlatforms && (
                <PlatformPicker selected={platforms} onChange={setPlatforms} label="Allowed marketplaces" />
              )}
            </div>

            <div className="space-y-2 rounded-md border border-border/60 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allRegions} onChange={(e) => setAllRegions(e.target.checked)} />
                Allow all regions
              </label>
              {!allRegions && (
                <RegionPicker selected={regions} onChange={setRegions} label="Allowed regions" />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Note <span className="text-xs text-muted-foreground">(why this plan)</span></Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Agreed: 2 brands, Amazon only, USA only" />
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
