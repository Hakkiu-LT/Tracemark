import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { Download, Table, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export function ClientBillingCard() {
  const clients = useStore((s) => s.clients);
  const marks = useStore((s) => s.marks);
  const infringements = useStore((s) => s.infringements);

  const totalMrr = clients.reduce((acc, c) => acc + c.mrr, 0);

  const handleExportCSV = () => {
    try {
      const headers = ["Client ID", "Client Name", "Industry", "Plan", "MRR ($)", "Contact", "Marks Count", "Active Cases"];
      const rows = clients.map((c) => {
        const cMarks = marks.filter((m) => m.clientId === c.id).length;
        const cCases = infringements.filter((i) => i.clientId === c.id && i.status === "active").length;
        return [
          c.id,
          `"${c.name.replace(/"/g, '""')}"`,
          `"${c.industry.replace(/"/g, '""')}"`,
          c.plan,
          c.mrr,
          c.contact,
          cMarks,
          cCases
        ];
      });

      const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `client-metrics-${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV report downloaded successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export client metrics CSV");
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">Client Billing Metrics</CardTitle>
          <CardDescription>Law firm portfolio overview and billing aggregates.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="flex items-center gap-1.5 no-print">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/30 p-4 border border-border/40">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Client MRR</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono">${totalMrr.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">/ month</span>
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 p-4 border border-border/40">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Clients</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono">{clients.length}</span>
              <span className="text-xs text-muted-foreground">active tenants</span>
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 p-4 border border-border/40">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Monitored Marks</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono">{marks.length}</span>
              <span className="text-xs text-muted-foreground">across portfolio</span>
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-md border border-border/60">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3 text-right">Marks</th>
                <th className="px-4 py-3 text-right">Active Cases</th>
                <th className="px-4 py-3 text-right">MRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {clients.map((c) => {
                const cMarks = marks.filter((m) => m.clientId === c.id).length;
                const cCases = infringements.filter((i) => i.clientId === c.id && i.status === "active").length;
                return (
                  <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-foreground">{c.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{c.contact}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {c.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono">{cMarks}</td>
                    <td className="px-4 py-3.5 text-right font-mono">{cCases}</td>
                    <td className="px-4 py-3.5 text-right font-semibold font-mono text-success">${c.mrr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
