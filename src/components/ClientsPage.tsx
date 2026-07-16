import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useStore, type Client } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Plus, Trash2, Briefcase, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function ClientsPage() {
  const persona = useStore((s) => s.persona);
  const clients = useStore((s) => s.clients);
  const infringements = useStore((s) => s.infringements);
  const marks = useStore((s) => s.marks);
  const addClient = useStore((s) => s.addClient);
  const removeClient = useStore((s) => s.removeClient);

  const { profile, user } = useAuth();
  const orgId = profile?.organization_id || user?.id;

  const [dbClients, setDbClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""), [industry, setIndustry] = useState(""), [contact, setContact] = useState("");

  useEffect(() => {
    if (!supabase) {
      setDbClients(clients);
      setIsLoading(false);
      return;
    }

    async function fetchDbClients() {
      try {
        const { data, error } = await supabase!
          .from("clients")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (data) {
          setDbClients(data.map((c: any) => ({
            id: c.id,
            name: c.name,
            industry: c.industry || "—",
            plan: c.plan || "Pro",
            mrr: c.mrr || 0,
            contact: c.contact || "—",
          })));
        }
      } catch (err: any) {
        console.warn("Failed to load clients from DB, using Zustand store:", err);
        setDbClients(clients);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDbClients();
  }, [orgId, clients]);

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

  async function submit() {
    if (!name) return toast.error("Client name required");

    const newClientData = {
      name,
      industry: industry || "—",
      contact: contact || "—",
      plan: "Pro" as const,
      mrr: 899,
    };

    addClient(newClientData);

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("clients")
          .insert({
            name,
            industry: industry || "—",
            contact: contact || "—",
            plan: "Pro",
            mrr: 899,
            organization_id: orgId,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const clientObj: Client = {
            id: data.id,
            name: data.name,
            industry: data.industry,
            plan: data.plan,
            mrr: data.mrr,
            contact: data.contact,
          };
          setDbClients(prev => [clientObj, ...prev.filter(c => c.name !== name)]);
        }
      } catch (err: any) {
        console.warn("Failed to insert client to database:", err);
      }
    }

    toast.success(`${name} added`);
    setName(""); setIndustry(""); setContact(""); setOpen(false);
  }

  async function handleRemove(id: string, name: string) {
    removeClient(id);
    setDbClients(prev => prev.filter(c => c.id !== id));

    if (supabase) {
      try {
        const { error } = await supabase
          .from("clients")
          .delete()
          .eq("id", id);
        if (error) throw error;
      } catch (err: any) {
        console.warn("Failed to delete client from database:", err);
      }
    }

    toast.success(`${name} removed`);
  }

  const totalMrr = dbClients.reduce((s, c) => s + c.mrr, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Client portfolio</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading clients...</span>
            ) : (
              `${dbClients.length} clients · $${totalMrr.toLocaleString()} MRR`
            )}
          </p>
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
              {dbClients.map((c) => {
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
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(c.id, c.name)}>
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
        {dbClients.map((c) => {
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
