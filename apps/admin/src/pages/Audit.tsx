import { useQuery } from "@tanstack/react-query";

import { adminFetch } from "@/lib/api";
import {
  Badge,
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

interface AuditRow {
  id: string;
  staff_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  created_at: string;
}

export function Audit() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => adminFetch<AuditRow[]>("/audit-log"),
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Every admin action, newest first.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{isLoading ? "Loading…" : `${data?.length ?? 0} entries`}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs">{r.staff_email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.action}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.target_type}
                      {r.target_id ? `:${r.target_id.slice(0, 8)}…` : ""}
                    </TableCell>
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
