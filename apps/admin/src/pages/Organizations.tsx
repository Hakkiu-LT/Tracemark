import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
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
import { ErrorState } from "@/components/error-state";

interface OrgRow {
  id: string;
  name: string | null;
  industry: string | null;
  persona: string | null;
  member_count: number;
  brand_count: number;
}

export function Organizations() {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => adminFetch<OrgRow[]>("/organizations"),
  });

  const rows = (data ?? []).filter((o) => {
    if (q && !(o.name ?? "").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">Every customer organization, its members and usage.</p>
        </div>
        <Can permission="customers.create">
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New company
          </Button>
        </Can>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{isLoading ? "Loading…" : `${rows.length} companies`}</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="Filter by name…" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <ErrorState variant="block" error={error} title="Failed to load companies" onRetry={() => refetch()} />
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
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Brands</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      <Link to="/organizations/$orgId" params={{ orgId: o.id }} className="text-accent hover:underline">
                        {o.name || "—"}
                      </Link>
                      {o.industry && <span className="ml-2 text-xs text-muted-foreground">{o.industry}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{o.persona === "law_firm" ? "Law Firm" : "Brand Owner"}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{o.member_count}</TableCell>
                    <TableCell className="tabular-nums">{o.brand_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {creating && (
        <CreateOrgDialog
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

// ── CreateOrgDialog ───────────────────────────────────────────────────────────
// Creates an EMPTY company (no owner login). Users are added afterwards on the company
// detail page — separating "make the company" from "create/attach a login" is what fixes
// the old hijack + accidental-auto-assign behaviour. On success we navigate straight to the
// detail page, which auto-opens the Create-user dialog so onboarding still feels like one flow.
function CreateOrgDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [persona, setPersona] = useState<"brand_owner" | "law_firm">("brand_owner");

  const create = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { name: name.trim(), persona };
      if (industry.trim()) body.industry = industry.trim();
      return adminFetch<{ id: string }>("/organizations", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (org) => {
      toast.success("Company created — now add its first user");
      onCreated();
      if (org?.id) navigate({ to: "/organizations/$orgId", params: { orgId: org.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = name.trim().length > 0;

  return (
    <Dialog
      open
      onClose={onClose}
      title="New company"
      description="Creates the company group. You'll add its first user (login) on the next screen."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !canSubmit}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create company
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label>Company name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Industry <span className="text-xs text-muted-foreground">(optional)</span></Label>
          <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Retail" />
        </div>
        <div className="space-y-1.5">
          <Label>Workspace type</Label>
          <Select value={persona} onChange={(e) => setPersona(e.target.value as "brand_owner" | "law_firm")}>
            <option value="brand_owner">Brand Owner</option>
            <option value="law_firm">Law Firm</option>
          </Select>
        </div>
      </div>
    </Dialog>
  );
}
