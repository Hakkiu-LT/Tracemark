import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  ArrowLeft,
  Download,
  Send,
  FileCheck2,
  Trash,
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  Plus,
} from "lucide-react";
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
    navigate({ to: "/cases/$caseId", params: { caseId: i!.id } });
  }

  function sendWebhook() {
    if (!webhookUrl) return toast.error("Enter a webhook URL");
    setWebhookOpen(false);
    updateCaseStatus(i!.id, "takedown_sent");
    toast.success("Notice dispatched", { description: `Webhook posted to ${webhookUrl}` });
    navigate({ to: "/cases/$caseId", params: { caseId: i!.id } });
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-2 text-sm">
            <Link to="/cases" className="hover:text-accent transition-colors">
              Cases
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link
              to="/cases/$caseId"
              params={{ caseId }}
              className="hover:text-accent transition-colors"
            >
              Case #{caseId.toUpperCase()}
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">Generate Takedown</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Takedown notice</h1>
          <p className="text-sm text-muted-foreground">
            Review the auto-drafted notice and the evidence package, then dispatch.
          </p>
        </div>
      </div>

      {/* Editor & Sidebar layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel: Document Editor */}
        <div className="col-span-12 xl:col-span-8 flex flex-col bg-card border rounded-lg overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b bg-muted/20">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Redo className="h-4 w-4" />
              </Button>
              <div className="w-px h-4 bg-border mx-2"></div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Underline className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <Tabs value={template} onValueChange={changeTemplate}>
                <TabsList className="h-8">
                  <TabsTrigger value="dmca" className="text-xs">
                    DMCA
                  </TabsTrigger>
                  <TabsTrigger value="cnd" className="text-xs">
                    Cease & Desist
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Editor Canvas */}
          <div className="flex-1 overflow-y-auto p-8 lg:p-12 bg-muted/10 flex justify-center min-h-[500px]">
            <div className="bg-card w-full p-10 shadow-sm border border-border min-h-[700px] flex flex-col">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full flex-1 resize-none bg-transparent border-0 focus-visible:ring-0 focus:outline-none p-0 font-mono text-sm leading-relaxed text-foreground"
              />
            </div>
          </div>
        </div>

        {/* Right Panel: Evidence Package Sidebar */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-6">
          <Card>
            <div className="p-6 border-b">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                Evidence Package
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Included automatically in submission
              </p>
            </div>
            <CardContent className="p-6 space-y-6">
              {/* Listing Capture */}
              <div className="bg-muted/10 rounded-lg border overflow-hidden">
                <div className="bg-muted/20 px-3 py-2 border-b flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Listing Capture
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="aspect-video bg-muted border rounded overflow-hidden relative">
                    <img
                      alt="Product listing screenshot"
                      className="w-full h-full object-cover"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuA2t1y3SPwJlnUT7ZHIP8uATwVv9VAbSXEMTYrL8tneerq6yehx_VjjYjK-Vpbhkv-g012VWsr7QZPG11o6SzvRxaGMWfhME4wbKpWI6LF5i740dLinCZLMLHUt4epFnbDjAWI8kCZiJ7rhJpqzJFXv7zwMqjApsTdkxDiiIHlDD27vN4N0wy6B15j-z3nEVeK3_sulRb75Tp_ySL74lH17vFYXtw2688xRlt_OVu88l6xvM59JIlVPSrUHlQnRfxJsxmhdtGQ-uD8"
                    />
                    <div className="absolute inset-0 bg-primary/5 border-2 border-destructive/40 rounded pointer-events-none"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-muted-foreground font-medium">Timestamp</div>
                    <div className="font-mono text-right text-foreground">
                      {new Date(i.evidence.timestamp)
                        .toISOString()
                        .replace("T", " ")
                        .slice(0, 16)}
                    </div>
                    <div className="text-muted-foreground font-medium">IP Address</div>
                    <div className="font-mono text-right text-foreground">
                      {i.infringer.ip}
                    </div>
                  </div>
                </div>
              </div>

              {/* Extracted Metadata */}
              <div className="bg-muted/10 rounded-lg border overflow-hidden">
                <div className="bg-muted/20 px-3 py-2 border-b">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Extracted Metadata
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center border-b pb-2 text-xs">
                    <span className="text-muted-foreground">Seller ID</span>
                    <span className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">
                      {i.infringer.seller}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2 text-xs">
                    <span className="text-muted-foreground">Price Listed</span>
                    <span className="font-mono text-destructive font-semibold">
                      {i.price || "$12.99"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Confidence Score</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="bg-destructive h-full"
                          style={{ width: `${i.analysis.confidence}%` }}
                        ></div>
                      </div>
                      <span className="font-mono font-semibold">
                        {i.analysis.confidence}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Add Evidence Button */}
              <Button
                variant="outline"
                className="w-full py-6 border-dashed text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Attach additional files
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Footer Actions */}
      <div className="fixed bottom-0 left-0 md:left-[260px] right-0 p-4 bg-card border-t border-border shadow-[0_-4px_12px_rgba(15,23,42,0.05)] flex justify-between items-center z-20">
        <Button
          variant="ghost"
          asChild
          className="text-muted-foreground hover:text-foreground"
        >
          <Link to="/cases/$caseId" params={{ caseId }}>
            <Trash className="mr-2 h-4 w-4" /> Discard Draft
          </Link>
        </Button>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={downloadPdf}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Button onClick={() => setWebhookOpen(true)} className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Send via Webhook
          </Button>
        </div>
      </div>

      {/* Webhook Dispatch Dialog */}
      <Dialog open={webhookOpen} onOpenChange={setWebhookOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send via webhook</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Post the notice and evidence package as JSON to your handling endpoint
            (Zapier, n8n, internal ticketing).
          </p>
          <Input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.zapier.com/…"
            className="font-mono text-xs"
          />
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setWebhookOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendWebhook}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
