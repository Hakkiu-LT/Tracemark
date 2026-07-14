import React, { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { fetchCaseFromSupabase, supabase } from "@/lib/supabase";
import { updateTakedownReport, sendTakedownEmail, chargeManagedTakedown } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ensureAbsoluteUrl } from "@/lib/utils";
import { EvidenceScreenshotSection } from "@/components/cases/evidence-screenshot-section";
import type { TakedownReport } from "@/lib/api.types";
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  Mail,
  Globe,
  Zap,
  Scale,
  ExternalLink,
  Send,
  FileText,
  CheckCircle2,
  Save,
  CloudUpload,
  Download,
  Gavel,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

export const Route = createFileRoute("/monitoring/$caseId/takedown")({
  head: () => ({ meta: [{ title: "Takedown Notices — Tracemark" }] }),
  component: TakedownNoticesPage,
});

const METHOD_CONFIG: Record<
  TakedownReport["submission_method"],
  { label: string; icon: React.ElementType; className: string }
> = {
  email: {
    label: "Email",
    icon: Mail,
    className: "text-blue-600 bg-blue-500/10 border-blue-500/20",
  },
  web_form: {
    label: "Web Form",
    icon: Globe,
    className: "text-violet-600 bg-violet-500/10 border-violet-500/20",
  },
  api: {
    label: "API",
    icon: Zap,
    className: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
  },
  udrp: {
    label: "UDRP",
    icon: Scale,
    className: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  },
};

function MethodBadge({ method }: { method: TakedownReport["submission_method"] }) {
  const cfg = METHOD_CONFIG[method];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${cfg.className}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// Optional paid add-on (Pro & Agency): let our team submit + follow up on this
// takedown for a one-off $500 fee, billed to the card on file. Idempotent per report.
function ManagedTakedownAction({ report }: { report: TakedownReport }) {
  const { profile } = useAuth();
  const [charging, setCharging] = useState(false);
  const [requested, setRequested] = useState(false);

  // Managed takedown is available only on Pro and Agency tiers.
  if (profile?.plan !== "pro" && profile?.plan !== "agency") return null;

  const handleRequest = async () => {
    setCharging(true);
    try {
      await chargeManagedTakedown(report.id!);
      setRequested(true);
      toast.success("Managed takedown requested", {
        description:
          "Our team will submit and follow up. A $500 fee was added to your next invoice.",
      });
    } catch (e) {
      toast.error("Could not request managed takedown", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setCharging(false);
    }
  };

  return (
    <Button
      onClick={handleRequest}
      disabled={charging || requested}
      variant="outline"
      className="w-full border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-600"
    >
      {charging ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Gavel className="h-4 w-4 mr-2" />
      )}
      {requested ? "Managed takedown requested" : "Let us handle it — $500"}
    </Button>
  );
}

function NoticeActions({ report, onUpdate }: { report: TakedownReport; onUpdate: () => void }) {
  const [sending, setSending] = useState(false);

  if (report.submission_method === "api") {
    return (
      <Alert className="border-emerald-500/30 bg-emerald-500/5">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <AlertTitle className="text-emerald-700 dark:text-emerald-400">
          Automatically Reported
        </AlertTitle>
        <AlertDescription className="text-emerald-700/80 dark:text-emerald-400/80 text-xs">
          This infringement has already been submitted automatically via the platform's API
          integration. No further action is required — you can track the status in your platform
          dashboard.
        </AlertDescription>
      </Alert>
    );
  }

  if (report.submission_method === "udrp") {
    return (
      <Alert className="border-amber-500/30 bg-amber-500/5">
        <Scale className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-700 dark:text-amber-400">UDRP Procedure</AlertTitle>
        <AlertDescription className="text-amber-700/80 dark:text-amber-400/80 text-xs">
          UDRP (Uniform Domain-Name Dispute-Resolution Policy) is a formal legal procedure
          administered by ICANN-accredited providers such as WIPO or the NAF. Filing requires
          submitting a complaint with evidence of bad faith registration, trademark rights, and
          identity of the registrant. We recommend engaging a trademark attorney to proceed.
        </AlertDescription>
      </Alert>
    );
  }

  if (report.submission_method === "web_form") {
    const handleMarkSent = async () => {
      setSending(true);
      try {
        await updateTakedownReport(report.id!, { status: "sent" });
        toast.success("Marked as sent", { description: "Notice recorded in case history." });
        onUpdate();
      } catch (e) {
        toast.error("Failed to update status");
      } finally {
        setSending(false);
      }
    };

    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Submit this notice via the platform's official reporting page. Copy the notice text and
          paste it into the form.
        </p>
        <Button asChild disabled={!report.submission_url} className="w-full">
          <a href={report.submission_url ?? "#"} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Go to reporting page
          </a>
        </Button>
        <Button
          onClick={handleMarkSent}
          disabled={sending || report.status === "sent"}
          className="w-full"
          variant="outline"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          {report.status === "sent" ? "Marked as Sent" : "Mark as Sent"}
        </Button>
        <ManagedTakedownAction report={report} />
      </div>
    );
  }

  // email
  const handleSendEmail = async () => {
    setSending(true);
    try {
      await sendTakedownEmail(report.id!);
      toast.success("Email sent", { description: "Notice dispatched and recorded in history." });
      onUpdate();
    } catch (e: any) {
      toast.error("Failed to send email", { description: e.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {report.submission_email
          ? `Send to: ${report.submission_email}`
          : "No submission email on file."}
      </p>
      <Button
        onClick={handleSendEmail}
        disabled={sending || report.status === "sent"}
        className="w-full"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : report.status === "sent" ? (
          <CheckCircle2 className="h-4 w-4 mr-2" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        {report.status === "sent" ? "Sent" : "Send email directly"}
      </Button>
      <ManagedTakedownAction report={report} />
    </div>
  );
}

function TakedownNoticesPage() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const result = useStore((s) => s.scanResults[caseId]);
  const setScanResult = useStore((s) => s.setScanResult);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(!result);
  const [noticeText, setNoticeText] = useState("");
  const [saving, setSaving] = useState(false);
  const [isSavingToStorage, setIsSavingToStorage] = useState(false);

  const handleDownloadPdf = () => {
    if (!selected) return;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(noticeText, 500);
    doc.text(lines, 56, 72);
    doc.save(`takedown-${selected.id}.pdf`);
    toast.success("PDF downloaded successfully");
  };

  const handleSaveToSupabase = async () => {
    if (!selected) return;
    setIsSavingToStorage(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(noticeText, 500);
      doc.text(lines, 56, 72);
      const pdfBlob = doc.output("blob");

      if (!supabase) {
        throw new Error("Supabase client is not initialized.");
      }

      // documents.infringement_id is a NOT-NULL FK to infringements(id). A takedown
      // report is keyed by case_id, not infringement_id, so resolve the real
      // infringement for this case (match the infringing URL, then fall back to
      // platform). Never write the caseId into the infringement_id column.
      let infringementId: string | undefined;
      const { data: byUrl } = await supabase
        .from("infringements")
        .select("id")
        .eq("case_id", caseId)
        .eq("source_url", selected.infringing_url)
        .limit(1)
        .maybeSingle();
      infringementId = byUrl?.id;
      if (!infringementId) {
        const { data: byPlatform } = await supabase
          .from("infringements")
          .select("id")
          .eq("case_id", caseId)
          .ilike("platform", selected.platform)
          .limit(1)
          .maybeSingle();
        infringementId = byPlatform?.id;
      }
      if (!infringementId) {
        toast.error("Could not save document", {
          description: "No matching infringement was found for this takedown report.",
        });
        return;
      }

      const timestamp = new Date()
        .toISOString()
        .replace(/[-:T.]/g, "")
        .slice(0, 14);
      const fileName = `${infringementId}/${selected.submission_method}-${timestamp}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("legal-documents")
        .upload(fileName, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Private bucket: store the storage path, not a (non-resolving) public URL.
      // Open later via a short-lived signed URL (createSignedUrl(file_url, ttl)).
      const { error: dbError } = await supabase.from("documents").insert({
        infringement_id: infringementId,
        document_type: selected.submission_method === "email" ? "cease-desist" : "dmca",
        file_url: fileName,
        file_format: "pdf",
        status: "draft",
      });

      if (dbError) throw dbError;

      toast.success("Saved successfully", {
        description: "Document stored in legal-documents bucket.",
      });
    } catch (err: any) {
      console.error("Error saving document to storage:", err);
      toast.error("Failed to save document", { description: err.message || String(err) });
    } finally {
      setIsSavingToStorage(false);
    }
  };

  const loadCase = async () => {
    try {
      const data = await fetchCaseFromSupabase(caseId);
      if (data) setScanResult(caseId, data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (result) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchCaseFromSupabase(caseId)
      .then((data) => {
        if (cancelled || !data) return;
        setScanResult(caseId, data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, result, setScanResult]);

  const reports = result?.takedown_reports ?? [];
  const selected = reports[selectedIndex] ?? null;

  // Sync noticeText when selection changes or data updates
  useEffect(() => {
    if (selected) {
      setNoticeText(selected.notice_text);
    }
  }, [selected?.id, selected?.notice_text]);

  const handleSaveText = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateTakedownReport(selected.id!, { notice_text: noticeText });
      toast.success("Draft saved successfully");
      await loadCase();
    } catch (e) {
      toast.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Loading case…</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-muted-foreground text-sm">Scan result not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/monitoring" })}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Monitoring
        </Button>
      </div>
    );
  }

  const screenshotUrl = selected
    ? (result.evidence.marketplaces.find(
        (m) => m.platform.toLowerCase() === selected.platform.toLowerCase() && m.screenshot_url,
      )?.screenshot_url ??
      result.evidence.ads.find(
        (a) => a.platform.toLowerCase() === selected.platform.toLowerCase() && a.screenshot_url,
      )?.screenshot_url ??
      null)
    : null;

  const isEdited = selected && noticeText !== selected.notice_text;

  const ANIM = "animate-in fade-in-0 slide-in-from-bottom-3 duration-500";
  const anim = (delay: number): React.CSSProperties => ({
    animationDelay: `${delay}ms`,
    animationFillMode: "both",
  });

  return (
    <div className="space-y-6 pb-10">
      {/* Breadcrumb */}
      <div
        className={`flex items-center gap-2 text-sm text-muted-foreground ${ANIM}`}
        style={anim(0)}
      >
        <Link to="/monitoring" className="hover:text-accent transition-colors">
          Monitoring
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          to="/monitoring/$caseId"
          params={{ caseId }}
          className="hover:text-accent transition-colors font-mono"
        >
          Case #{caseId.slice(0, 8).toUpperCase()}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Takedown Notices</span>
      </div>

      {/* Header */}
      <div className={`flex flex-wrap items-start justify-between gap-4 ${ANIM}`} style={anim(80)}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Takedown Notices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {reports.length} notice{reports.length !== 1 ? "s" : ""} generated for this scan result.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/monitoring/$caseId" params={{ caseId }}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to case
          </Link>
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card className={ANIM} style={anim(160)}>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No takedown notices</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              No takedown reports were generated for this scan. Run a new scan or escalate manually.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* Col 1: Notice list */}
          <div className={`col-span-12 xl:col-span-3 ${ANIM}`} style={anim(160)}>
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/20">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Notices
                </span>
                <span className="text-xs font-mono text-muted-foreground/60">{reports.length}</span>
              </div>
              <div className="divide-y divide-border">
                {reports.map((r, i) => {
                  const cfg = METHOD_CONFIG[r.submission_method];
                  const Icon = cfg.icon;
                  const isSelected = i === selectedIndex;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedIndex(i)}
                      className={`w-full text-left px-5 py-4 space-y-2 transition-colors hover:bg-muted/30 ${ANIM} ${isSelected ? "bg-accent/5 border-l-2 border-l-accent" : "border-l-2 border-l-transparent"}`}
                      style={anim(200 + i * 50)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground truncate capitalize">
                          {r.platform.replace(/_/g, " ")}
                        </p>
                        <MethodBadge method={r.submission_method} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate font-mono">
                        {r.infringing_url}
                      </p>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-3 w-3 ${cfg.className.split(" ")[0]}`} />
                        <span className="text-[11px] text-muted-foreground capitalize">
                          {r.status}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>

          {selected ? (
            <>
              {/* Col 2: Notice document */}
              <div
                key={`doc-${selected.id}`}
                className={`col-span-12 xl:col-span-6 flex flex-col ${ANIM}`}
                style={anim(0)}
              >
                <Card className="overflow-hidden flex flex-col h-full">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b bg-muted/20">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-accent" />
                      <span className="text-sm font-semibold text-foreground capitalize">
                        {selected.platform.replace(/_/g, " ")}
                      </span>
                      <MethodBadge method={selected.submission_method} />
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={ensureAbsoluteUrl(selected.infringing_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline flex items-center gap-1 font-mono"
                      >
                        {selected.infringing_url}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      <Button
                        variant={isEdited ? "default" : "outline"}
                        size="sm"
                        disabled={!isEdited || saving || selected.status === "sent"}
                        onClick={handleSaveText}
                      >
                        {saving ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-2" />
                        ) : (
                          <Save className="h-3 w-3 mr-2" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                  <div className="p-6 bg-muted/10 flex justify-center flex-1">
                    <div className="bg-card w-full p-8 shadow-sm border border-border min-h-[420px] flex flex-col">
                      <textarea
                        className="w-full flex-1 resize-none bg-transparent border-0 focus-visible:ring-0 focus:outline-none p-0 font-mono text-sm leading-relaxed text-foreground min-h-[400px]"
                        value={noticeText}
                        onChange={(e) => setNoticeText(e.target.value)}
                        disabled={selected.status === "sent"}
                        placeholder="Draft takedown notice..."
                      />
                    </div>
                  </div>
                </Card>
              </div>

              {/* Col 3: Actions */}
              <div
                key={`actions-${selected.id}`}
                className={`col-span-12 xl:col-span-3 ${ANIM}`}
                style={anim(80)}
              >
                <Card className="@container">
                  <CardContent className="px-6 py-5">
                    <div className="grid grid-cols-1 @[600px]:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Actions
                        </p>
                        <NoticeActions report={selected} onUpdate={loadCase} />

                        <div className="border-t border-border/60 my-2 pt-4 flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full flex items-center justify-center gap-2"
                            onClick={handleDownloadPdf}
                          >
                            <Download className="h-4 w-4" />
                            Download PDF
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isSavingToStorage}
                            className="w-full flex items-center justify-center gap-2"
                            onClick={handleSaveToSupabase}
                          >
                            {isSavingToStorage ? (
                              <Loader2 className="h-4 w-4 animate-spin text-accent" />
                            ) : (
                              <CloudUpload className="h-4 w-4 text-accent" />
                            )}
                            Save
                          </Button>
                        </div>
                      </div>
                      {screenshotUrl && (
                        <div className="@[600px]:border-l @[600px]:border-border @[600px]:pl-6">
                          <EvidenceScreenshotSection screenshotUrl={screenshotUrl} />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className={`col-span-12 xl:col-span-9 ${ANIM}`} style={anim(240)}>
              <Card>
                <CardContent className="flex items-center justify-center py-24 text-muted-foreground text-sm">
                  Select a notice to view its contents.
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
