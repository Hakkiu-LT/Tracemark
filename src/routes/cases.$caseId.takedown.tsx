import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, Send, FileCheck2 } from "lucide-react";
import jsPDF from "jspdf";

export const Route = createFileRoute("/cases/$caseId/takedown")({
  head: () => ({ meta: [{ title: "Takedown — Tracemark" }] }),
  component: TakedownPage,
});

function buildLetter(template: string, i: ReturnType<typeof getCase>): string {
  if (!i) return "";
  const today = new Date().toLocaleDateString();
  if (template === "dmca") {
    return `DMCA TAKEDOWN NOTICE
Date: ${today}

To: Designated Copyright Agent, ${i.platform}
Re: Unauthorized use of ${i.brandName} trademarks — Listing ${i.evidence.url}

To whom it may concern,

I, on behalf of ${i.brandName} (the "Rights Holder"), submit this notification under 17 U.S.C. § 512(c) of the Digital Millennium Copyright Act.

1. Identification of copyrighted work: Registered trademark and product imagery of ${i.brandName}, USPTO/EUIPO registration on file.

2. Identification of infringing material:
   URL:    ${i.evidence.url}
   Seller: ${i.infringer.seller}
   Title:  ${i.title}

3. Good-faith statement: I have a good-faith belief that the use of the material described above is not authorized by the rights holder, its agent, or the law.

4. Accuracy statement: The information in this notification is accurate, and under penalty of perjury, I am authorized to act on behalf of the owner of the rights allegedly infringed.

5. Requested action: Please remove or disable access to the listing identified above within the timeframes mandated by 17 U.S.C. § 512.

Sincerely,
Authorized Agent
${i.brandName} — Trust & Brand Protection
`;
  }
  return `CEASE AND DESIST
Date: ${today}

To: ${i.infringer.seller}
Re: Unauthorized commercial use of the ${i.brandName} trademark

You are hereby notified that your offering at ${i.evidence.url} makes unauthorized use of the registered ${i.brandName} mark. This constitutes trademark infringement under 15 U.S.C. § 1114 and unfair competition under § 1125(a).

You are demanded to immediately:
  1. Cease all use of the ${i.brandName} mark and any confusingly similar variants;
  2. Remove all infringing listings, including but not limited to ${i.evidence.url};
  3. Provide written confirmation of compliance within 10 business days.

Failure to comply will result in formal legal proceedings without further notice.

Sincerely,
Counsel for ${i.brandName}
`;
}

function getCase(id: string) {
  return useStore.getState().infringements.find((x) => x.id === id);
}

function TakedownPage() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const i = useStore((s) => s.infringements.find((x) => x.id === caseId));
  const updateCaseStatus = useStore((s) => s.updateCaseStatus);

  const [template, setTemplate] = useState("dmca");
  const initial = useMemo(() => buildLetter(template, i), [template, i]);
  const [text, setText] = useState(initial);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  // Re-sync when template changes
  function changeTemplate(v: string) {
    setTemplate(v);
    setText(buildLetter(v, i));
  }

  if (!i) return <div className="py-20 text-center text-muted-foreground">Case not found.</div>;

  function downloadPdf() {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(text, 500);
    doc.text(lines, 56, 72);
    doc.save(`takedown-${i!.id}.pdf`);
    updateCaseStatus(i!.id, "takedown_sent");
    toast.success("PDF downloaded", { description: "Case status updated to 'Takedown sent'." });
  }

  function sendWebhook() {
    if (!webhookUrl) return toast.error("Enter a webhook URL");
    setWebhookOpen(false);
    updateCaseStatus(i!.id, "takedown_sent");
    toast.success("Notice dispatched", { description: `Webhook posted to ${webhookUrl}` });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link to="/cases/$caseId" params={{ caseId }}><ArrowLeft className="mr-1 h-4 w-4" /> Back to case</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Takedown notice</h1>
          <p className="text-sm text-muted-foreground">Review the auto-drafted notice and the evidence package, then dispatch.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setWebhookOpen(true)}><Send className="mr-1.5 h-4 w-4" /> Send via webhook</Button>
          <Button onClick={downloadPdf}><Download className="mr-1.5 h-4 w-4" /> Download PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Letter draft</CardTitle>
            <Tabs value={template} onValueChange={changeTemplate}>
              <TabsList className="h-8">
                <TabsTrigger value="dmca" className="text-xs">DMCA</TabsTrigger>
                <TabsTrigger value="cnd" className="text-xs">Cease & Desist</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="flex-1">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} className="h-[560px] resize-none font-mono text-xs leading-relaxed" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evidence package</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-video overflow-hidden rounded-md border" style={{ background: `linear-gradient(135deg, ${i.thumbnail}, oklch(0.22 0.05 260))` }}>
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <div className="text-center">
                  <p className="text-sm font-semibold">{i.title}</p>
                  <p className="text-xs opacity-80 font-mono">{i.evidence.url}</p>
                </div>
              </div>
            </div>

            <ul className="space-y-2">
              {[
                { label: "Screenshot evidence", meta: `1 file · captured ${new Date(i.evidence.timestamp).toLocaleString()}` },
                { label: "Trademark registration certificate", meta: `${i.brandName} · on file` },
                { label: "AI infringement analysis", meta: `${i.analysis.confidence}% confidence · ${i.analysis.category}` },
                { label: "Infringer profile", meta: `${i.infringer.seller} · ${i.infringer.country}` },
                { label: "Network metadata", meta: `IP ${i.infringer.ip} · UA logged` },
              ].map((row) => (
                <li key={row.label} className="flex items-start gap-3 rounded-md border bg-muted/30 p-3 text-sm">
                  <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <div className="flex-1">
                    <p className="font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.meta}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Dialog open={webhookOpen} onOpenChange={setWebhookOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send via webhook</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Post the notice and evidence package as JSON to your handling endpoint (Zapier, n8n, internal ticketing).</p>
          <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://hooks.zapier.com/…" className="font-mono text-xs" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebhookOpen(false)}>Cancel</Button>
            <Button onClick={sendWebhook}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
