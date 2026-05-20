import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { Plus, Trash2, Briefcase } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/clients")({
  head: () => ({ meta: [{ title: "Clients — Tracemark" }, { name: "description", content: "Manage your law-firm client portfolio and billing." }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const persona = useStore((s) => s.persona);
  const clients = useStore((s) => s.clients);
  const infringements = useStore((s) => s.infringements);
  const marks = useStore((s) => s.marks);
  const addClient = useStore((s) => s.addClient);
  const removeClient = useStore((s) => s.removeClient);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""), [industry, setIndustry] = useState(""), [contact, setContact] = useState("");

  if (persona !== "law_firm") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <Briefcase className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Law-firm mode required</h1>
        <p className="mt-2 text-sm text-muted-foreground">Switch persona in Settings to manage multiple client accounts and per-client billing.</p>
        <Button asChild className="mt-6"><Link to="/settings">Open settings</Link></Button>
      </div>
    );
  }

  function submit() {
    if (!name) return toast.error("Client name required");
    addClient({ name, industry: industry || "—", contact: contact || "—", plan: "Pro", mrr: 899 });
    toast.success(`${name} added`);
    setName(""); setIndustry(""); setContact(""); setOpen(false);
  }

  const totalMrr = clients.reduce((s, c) => s + c.mrr, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Client portfolio</h1>
          <p className="text-sm text-muted-foreground">{clients.length} clients · ${totalMrr.toLocaleString()} MRR</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Add client</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add client</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Client name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" /></div>
              <div><Label>Industry</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Consumer Electronics" /></div>
              <div><Label>Primary contact</Label><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="legal@acme.com" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit}>Add client</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Clients</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Marks</TableHead>
                <TableHead className="text-right">Active cases</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => {
                const cMarks = marks.filter((m) => m.clientId === c.id).length;
                const cCases = infringements.filter((i) => i.clientId === c.id && i.status === "active").length;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{c.contact}</p>
                    </TableCell>
                    <TableCell className="text-sm">{c.industry}</TableCell>
                    <TableCell><Badge variant="secondary">{c.plan}</Badge></TableCell>
                    <TableCell className="text-right font-mono text-sm">{cMarks}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{cCases}</TableCell>
                    <TableCell className="text-right font-mono text-sm">${c.mrr}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { removeClient(c.id); toast.success("Client removed"); }}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {clients.map((c) => {
          const cCases = infringements.filter((i) => i.clientId === c.id);
          const td = cCases.filter((i) => i.status === "takedown_sent" || i.status === "resolved").length;
          return (
            <Card key={c.id}>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{c.name}</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Billing period</span><span className="font-mono">${c.mrr}/mo</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cases this period</span><span className="font-mono">{cCases.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Takedowns delivered</span><span className="font-mono">{td}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Last invoice</span><span className="font-mono text-success">Paid</span></div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
