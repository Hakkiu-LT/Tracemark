import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import {
  ChevronRight,
  Download,
  Send,
  Trash,
  CheckCircle2,
  ExternalLink,
  CloudUpload,
  Loader2,
  ImageOff,
  Clock,
  Globe,
  Mail,
  Scale,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { PlatformLogo } from "@/components/platform-logo";
import evidencePlaceholder from "@/images/evidence-placeholder.png";
import { getInfringementById, updateInfringementStatus, type InfringementFeedItem } from "@/lib/api";
import { getPlatformReporting } from "@/lib/platform-reporting";
import { ensureAbsoluteUrl } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/cases/$caseId/takedown")({
  head: () => ({ meta: [{ title: "Takedown — HAKKIU" }] }),
  component: TakedownPage,
});

/** Best-effort "who runs the infringing page" from its URL (no seller data is captured). */
function operatorOf(sourceUrl: string): string {
  try {
    return new URL(ensureAbsoluteUrl(sourceUrl)).hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl;
  }
}

function buildLetter(template: string, i: InfringementFeedItem): string {
  const today = new Date().toLocaleDateString();
  const brand = i.brand_name ?? "the Rights Holder";
  const platform = i.platform.replace(/_/g, " ");
  if (template === "dmca") {
    return `DMCA TAKEDOWN NOTICE
Date: ${today}

To: Designated Copyright Agent, ${platform}
Re: Unauthorized use of ${brand} trademarks — Listing ${i.source_url}

To whom it may concern,

I, on behalf of ${brand} (the "Rights Holder"), submit this notification under 17 U.S.C. § 512(c) of the Digital Millennium Copyright Act.

1. Identification of copyrighted work: Registered trademark and product imagery of ${brand}, USPTO/EUIPO registration on file.

2. Identification of infringing material:
   URL:      ${i.source_url}
   Platform: ${platform}

3. Good-faith statement: I have a good-faith belief that the use of the material described above is not authorized by the rights holder, its agent, or the law.

4. Accuracy statement: The information in this notification is accurate, and under penalty of perjury, I am authorized to act on behalf of the owner of the rights allegedly infringed.

5. Requested action: Please remove or disable access to the listing identified above within the timeframes mandated by 17 U.S.C. § 512.

Sincerely,
Authorized Agent
${brand} — Trust & Brand Protection
`;
  }
  return `CEASE AND DESIST
Date: ${today}

To: ${operatorOf(i.source_url)}
Re: Unauthorized commercial use of the ${brand} trademark

You are hereby notified that your offering at ${i.source_url} makes unauthorized use of the registered ${brand} mark. This constitutes trademark infringement under 15 U.S.C. § 1114 and unfair competition under § 1125(a).

You are demanded to immediately:
  1. Cease all use of the ${brand} mark and any confusingly similar variants;
  2. Remove all infringing listings, including but not limited to ${i.source_url};
  3. Provide written confirmation of compliance within 10 business days.

Failure to comply will result in formal legal proceedings without further notice.

Sincerely,
Counsel for ${brand}
`;
}

function TakedownPage() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isReadOnly = profile?.org_role === "member";

  // Same query key as the case detail page — navigating from there is instant.
  const { data: i, isLoading, error, refetch } = useQuery({
    queryKey: ["infringement", caseId],
    queryFn: () => getInfringementById(caseId),
  });

  const [template, setTemplate] = useState("dmca");
  const [text, setText] = useState("");
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const [successRef, setSuccessRef] = useState("");
  const [isSavingToStorage, setIsSavingToStorage] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // (Re)draft the letter when the case loads or the template changes.
  useEffect(() => {
    if (i) setText(buildLetter(template, i));
  }, [i, template]);

  /** Persist the workflow transition so list/detail reflect it everywhere. */
  async function markTakedownSent() {
    const updated = await updateInfringementStatus(caseId, "takedown_sent");
    queryClient.setQueryData(["infringement", caseId], updated);
    queryClient.invalidateQueries({ queryKey: ["dashboard_cases"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_infringements"] });
    queryClient.invalidateQueries({ queryKey: ["infringements"] });
  }

  const [isMarkingSubmitted, setIsMarkingSubmitted] = useState(false);

  /** User submitted the notice through the platform's own channel. */
  async function markAsSubmitted() {
    setIsMarkingSubmitted(true);
    try {
      await markTakedownSent();
      toast.success("Marked as submitted", { description: "Case status updated to 'Takedown sent'." });
    } catch {
      toast.error("Couldn't update the case status. Please try again.");
    } finally {
      setIsMarkingSubmitted(false);
    }
  }

  function buildPdf(): jsPDF {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(text, 500);
    doc.text(lines, 56, 72);
    return doc;
  }

  async function downloadPdf() {
    try {
      buildPdf().save(`takedown-${caseId.slice(0, 8)}.pdf`);
      await markTakedownSent();
      toast.success("PDF downloaded", { description: "Case status updated to 'Takedown sent'." });
      navigate({ to: "/cases/$caseId", params: { caseId } });
    } catch {
      toast.error("Couldn't update the case status. Please try again.");
    }
  }

  async function saveToSupabaseStorage() {
    if (!i) return;
    setIsSavingToStorage(true);
    try {
      const pdfBlob = buildPdf().output("blob");
      const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
      const fileName = `${i.id}/${template}-${timestamp}.pdf`;

      const { supabase } = await import("@/lib/supabase");
      if (!supabase) {
        throw new Error("Supabase client is not initialized.");
      }

      const { error: uploadError } = await supabase.storage
        .from("legal-documents")
        .upload(fileName, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("legal-documents")
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from("documents")
        .insert({
          infringement_id: i.id,
          document_type: template === "dmca" ? "dmca" : "cease-desist",
          file_url: publicUrl,
          file_format: "pdf",
          status: "draft",
        });
      if (dbError) throw dbError;

      toast.success("Saved successfully", { description: "Document stored in legal-documents bucket." });
    } catch (err: any) {
      console.error("Error saving document to storage:", err);
      toast.error("Couldn't save the document. Please try again.");
    } finally {
      setIsSavingToStorage(false);
    }
  }

  async function sendWebhook() {
    if (!webhookUrl) {
      toast.error("Enter a webhook URL");
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          template,
          notice_text: text,
          infringement: i,
        }),
      });
      if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
      await markTakedownSent();
      setWebhookOpen(false);
      setSuccessRef(`TM-${Date.now().toString(36).toUpperCase()}`);
      setSuccessOpen(true);
    } catch (err: any) {
      console.error("Webhook dispatch failed:", err);
      toast.error("Couldn't deliver the webhook. Check the URL and try again.");
    } finally {
      setIsSending(false);
    }
  }

  if (error) {
    return (
      <div className="py-10">
        <ErrorState
          variant="block"
          error={error}
          title="Couldn't load this case"
          onRetry={() => refetch()}
        />
        <div className="mt-2 text-center">
          <Button asChild variant="link">
            <Link to="/cases">Back to cases</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !i) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 xl:col-span-8">
            <Skeleton className="h-[560px] w-full" />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const reporting = getPlatformReporting(i.platform);
  const alreadySent = i.status === "takedown_sent";

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
              Case #{caseId.slice(0, 8).toUpperCase()}
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
          <div className="flex flex-wrap items-center justify-end gap-4 px-6 py-3 border-b bg-muted/20">
            <Tabs value={template} onValueChange={setTemplate}>
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
                  {i.screenshot_url ? (
                    <div className="aspect-video bg-muted border rounded overflow-hidden">
                      <img
                        alt="Product listing screenshot"
                        className="w-full h-full object-cover"
                        src={i.screenshot_url}
                      />
                    </div>
                  ) : (
                    <div className="flex select-none flex-col items-center justify-center gap-3 py-4 text-center">
                      <img
                        src={evidencePlaceholder}
                        alt="No screenshot available"
                        draggable={false}
                        className="pointer-events-none w-full max-w-[220px] opacity-95"
                      />
                      <div className="flex items-center justify-center gap-2 text-xs font-medium text-foreground/70">
                        <ImageOff className="h-3.5 w-3.5" />
                        No screenshot captured
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-muted-foreground font-medium">Detected</div>
                    <div className="font-mono text-right text-foreground flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {new Date(i.flagged_at).toISOString().replace("T", " ").slice(0, 16)}
                    </div>
                    <div className="text-muted-foreground font-medium">Platform</div>
                    <div className="text-right text-foreground flex items-center justify-end gap-1.5 capitalize">
                      <PlatformLogo platform={i.platform} className="h-4 w-4 rounded" imgClassName="p-0.5" />
                      {i.platform.replace(/_/g, " ")}
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
                  <div className="flex justify-between items-center border-b pb-2 text-xs gap-2">
                    <span className="text-muted-foreground shrink-0">Source URL</span>
                    <a
                      href={ensureAbsoluteUrl(i.source_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-accent hover:underline truncate flex items-center gap-1"
                      title={i.source_url}
                    >
                      {operatorOf(i.source_url)}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2 text-xs">
                    <span className="text-muted-foreground">Match type</span>
                    <span className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">
                      {i.match_type}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Confidence Score</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="bg-destructive h-full"
                          style={{ width: `${Math.round(i.match_score * 100)}%` }}
                        ></div>
                      </div>
                      <span className="font-mono font-semibold">
                        {Math.round(i.match_score * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit to the platform */}
          {reporting && (
            <Card>
              <div className="p-6 border-b">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  {reporting.method === "email" ? (
                    <Mail className="h-4 w-4 text-accent" />
                  ) : reporting.method === "udrp" ? (
                    <Scale className="h-4 w-4 text-accent" />
                  ) : (
                    <Globe className="h-4 w-4 text-accent" />
                  )}
                  Submit to the platform
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {reporting.method === "email"
                    ? "Send the notice to the platform's abuse contact."
                    : reporting.method === "udrp"
                      ? "Domain disputes follow the formal UDRP procedure."
                      : "File the notice through the platform's official reporting page."}
                </p>
              </div>
              <CardContent className="p-6 space-y-3">
                {reporting.url && (
                  <Button asChild className="w-full">
                    <a href={reporting.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Go to reporting page
                    </a>
                  </Button>
                )}
                {reporting.email && (
                  <Button asChild variant={reporting.url ? "outline" : "default"} className="w-full">
                    <a href={`mailto:${reporting.email}?subject=${encodeURIComponent(`IP infringement notice — ${i.brand_name ?? "trademark"}`)}`}>
                      <Mail className="h-4 w-4 mr-2" />
                      {reporting.email}
                    </a>
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  {reporting.method === "web_form"
                    ? "Copy the notice text and paste it into the platform's form, then mark the case as submitted."
                    : reporting.method === "email"
                      ? "Attach or paste the notice text in your email, then mark the case as submitted."
                      : "Review the UDRP requirements with counsel before filing, then mark the case as submitted."}
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={isMarkingSubmitted || alreadySent || isReadOnly}
                  onClick={markAsSubmitted}
                >
                  {isMarkingSubmitted ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  {alreadySent ? "Marked as Submitted" : "Mark as Submitted"}
                </Button>
              </CardContent>
            </Card>
          )}
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
        <div className="flex items-center gap-3">
          {isReadOnly && (
            <span className="text-xs text-amber-500 font-medium mr-2">
              Read-only member: Contact owner to execute takedowns
            </span>
          )}
          <Button
            variant="outline"
            onClick={downloadPdf}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Button
            variant="outline"
            disabled={isSavingToStorage || isReadOnly}
            onClick={saveToSupabaseStorage}
            className="flex items-center gap-2"
          >
            {isSavingToStorage ? (
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            ) : (
              <CloudUpload className="h-4 w-4 text-accent" />
            )}
            Save
          </Button>
          <Button onClick={() => setWebhookOpen(true)} disabled={isReadOnly} className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Send via Webhook
          </Button>
        </div>
      </div>

      {/* Takedown Success Modal */}
      <Dialog open={successOpen} onOpenChange={(open) => {
        setSuccessOpen(open);
        if (!open) navigate({ to: "/cases/$caseId", params: { caseId } });
      }}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center pt-4 pb-2">
            <div className="relative mb-5">
              <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight mb-1">Takedown Sent</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Your notice has been dispatched to your handling endpoint and the case was marked as
              "Takedown sent".
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 divide-y divide-border text-sm my-2">
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-muted-foreground">Platform</span>
              <div className="flex items-center gap-1.5 font-medium capitalize">
                <PlatformLogo platform={i.platform} className="h-4 w-4 rounded" imgClassName="p-0.5" />
                <span>{i.platform.replace(/_/g, " ")}</span>
              </div>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-muted-foreground">Case</span>
              <span className="font-mono font-medium">#{caseId.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-muted-foreground">Brand</span>
              <span className="font-medium">{i.brand_name ?? "—"}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{successRef}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-muted-foreground">Submitted</span>
              <span className="font-mono text-xs">{new Date().toISOString().replace("T", " ").slice(0, 16)}Z</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center pb-1">
            Keep your reference number for follow-up with the platform's enforcement team.
          </p>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              className="w-full"
              onClick={() => {
                setSuccessOpen(false);
                navigate({ to: "/cases/$caseId", params: { caseId } });
              }}
            >
              Back to Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button onClick={sendWebhook} disabled={isSending}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
