import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useScopedMarks, useStore } from "@/lib/store";
import { Plus, Radar } from "lucide-react";

export const Route = createFileRoute("/monitoring")({
  head: () => ({
    meta: [
      { title: "Monitoring — Tracemark" },
      { name: "description", content: "Manage the trademarks and brand assets Tracemark scans across the web." },
    ],
  }),
  component: MonitoringPage,
});

function MonitoringPage() {
  const marks = useScopedMarks();
  const infringements = useStore((s) => s.infringements);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monitored assets</h1>
          <p className="text-sm text-muted-foreground">Brands, trademarks, and product lines under active surveillance.</p>
        </div>
        <Button asChild>
          <Link to="/monitoring/new"><Plus className="mr-1 h-4 w-4" /> Add asset</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radar className="h-4 w-4 text-accent" />
            Active monitoring ({marks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand / Mark</TableHead>
                <TableHead>Registration #</TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead className="text-right">Active alerts</TableHead>
                <TableHead className="text-right">Last scan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marks.map((m) => {
                const alerts = infringements.filter((i) => i.markId === m.id && i.status === "active").length;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md" style={{ background: `linear-gradient(135deg, ${m.logoColor}, oklch(0.3 0.05 260))` }} />
                        <div>
                          <p className="font-medium">{m.brandName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{m.website}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{m.registrationNumber}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.platforms.map((p) => (
                          <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={alerts > 0 ? "font-semibold text-risk-high" : "text-muted-foreground"}>{alerts}</span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{m.lastScan}</TableCell>
                  </TableRow>
                );
              })}
              {marks.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No monitored assets yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
