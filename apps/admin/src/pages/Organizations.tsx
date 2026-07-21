import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import { adminFetch } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

interface OrgRow {
  id: string;
  name: string | null;
  industry: string | null;
  persona: string | null;
  plan: string;
  member_count: number;
  brand_count: number;
  mrr: number;
}

export function Organizations() {
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | "free" | "paying">("all");
  const [mrrDir, setMrrDir] = useState<"none" | "asc" | "desc">("none");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => adminFetch<OrgRow[]>("/organizations"),
  });

  let rows = (data ?? []).filter((o) => {
    if (q && !(o.name ?? "").toLowerCase().includes(q.toLowerCase())) return false;
    if (planFilter === "free" && o.plan !== "free") return false;
    if (planFilter === "paying" && o.plan === "free") return false;
    return true;
  });

  if (mrrDir !== "none") {
    rows = [...rows].sort((a, b) => mrrDir === "asc" ? a.mrr - b.mrr : b.mrr - a.mrr);
  }

  function cycleMrr() {
    setMrrDir((d) => d === "none" ? "desc" : d === "desc" ? "asc" : "none");
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
        <p className="text-sm text-muted-foreground">Every customer organization, its members and usage.</p>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{isLoading ? "Loading…" : `${rows.length} companies`}</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="Filter by name…" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
            <Select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as typeof planFilter)} className="w-36">
              <option value="all">All plans</option>
              <option value="paying">Paying</option>
              <option value="free">Free</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Failed to load companies. Check your connection.</p>
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
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Brands</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={cycleMrr}>
                    MRR{" "}
                    {mrrDir === "none" ? <ChevronsUpDown className="inline h-3 w-3 opacity-40" /> :
                     mrrDir === "desc" ? <ChevronDown className="inline h-3 w-3" /> :
                     <ChevronUp className="inline h-3 w-3" />}
                  </TableHead>
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
                    <TableCell>
                      <Badge variant={o.plan === "free" ? "secondary" : "success"} className="capitalize">
                        {o.plan}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{o.member_count}</TableCell>
                    <TableCell className="tabular-nums">{o.brand_count}</TableCell>
                    <TableCell className="tabular-nums">{o.mrr ? `$${o.mrr}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
