import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { adminFetch } from "@/lib/api";
import { ensureAbsoluteUrl } from "@/lib/utils";
import { Can } from "@/components/Can";
import { useConfirm } from "@/components/ConfirmDialog";
import { PlatformLogo } from "@/components/platform-logo";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Skeleton,
} from "@/components/ui";

interface EvidenceItem {
  id: string;
  screenshot_url: string | null;
  platform: string;
  source_url: string;
  tier0_score: number | null;
  tier1_score: number | null;
  tier2_score: number | null;
  overall_score: number | null;
  verdict: string | null;
  confidence: string | null;
  status: string | null;
}
interface Infringement {
  id: string;
  platform: string;
  source_url: string;
  screenshot_url: string | null;
  risk_level: string | null;
  match_score: number | null;
  match_type: string | null;
  status: string | null;
  evidence_items: EvidenceItem[];
}
interface Decision {
  risk_level: string | null;
  recommended_action: string | null;
  confidence_score: number | null;
  evidence_quality: string | null;
  case_summary: string | null;
  key_findings: string[] | null;
}
interface Takedown {
  id: string;
  platform: string;
  infringing_url: string;
  submission_method: string;
  submission_email: string | null;
  notice_text: string;
  status: string;
}
interface Doc {
  id: string;
  document_type: string;
  file_url: string;
  status: string;
}
interface CaseData {
  case: { id: string; brand_name: string; organization_id: string | null; status: string };
  decision: Decision | null;
  infringements: Infringement[];
  takedowns: Takedown[];
  documents: Doc[];
}

const CASE_STATUSES = ["pending", "analyzing", "reviewed", "active", "escalated", "complete", "resolved", "declined", "safe", "dismissed", "error"];
const RISK = ["HIGH", "MEDIUM", "LOW"];
const ACTIONS = ["TAKEDOWN", "MONITOR", "DISMISS"];
const VERDICTS = ["obvious_copycat", "likely_copycat", "ambiguous", "obvious_non_match"];
const CONFIDENCES = ["high", "medium", "low"];
const INFR_STATUS = ["flagged", "reviewed", "dismissed"];
const MATCH_TYPES = ["keyword", "image", "both"];
const TD_STATUS = ["pending", "sent", "acknowledged"];

export function CaseDetail() {
  const { caseId } = useParams({ strict: false }) as { caseId: string };
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["case", caseId] });

  const { data, isLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => adminFetch<CaseData>(`/cases/${caseId}`),
  });

  const patch = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) =>
      adminFetch(path, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const post = useMutation({
    mutationFn: (path: string) => adminFetch(path, { method: "POST" }),
    onSuccess: () => {
      toast.success("Sent");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-6 md:p-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const c = data.case;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 md:p-8">
      <Link to="/cases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to cases
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{c.brand_name}</h1>
        <Can permission="customers.edit" fallback={<Badge variant="outline">{c.status}</Badge>}>
          <Select
            value={c.status}
            onChange={(e) => patch.mutate({ path: `/cases/${caseId}`, body: { status: e.target.value } })}
            className="w-40"
          >
            {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Can>
        {c.organization_id && (
          <Link to="/organizations/$orgId" params={{ orgId: c.organization_id }} className="text-sm text-accent hover:underline">
            View company
          </Link>
        )}
        <Can permission="customers.edit">
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-destructive"
            onClick={() =>
              confirm.open({
                title: "Delete this case?",
                description: "This permanently deletes the case and all its infringements, evidence, takedowns and documents.",
                confirmLabel: "Delete case",
                destructive: true,
                onConfirm: async () => {
                  await adminFetch(`/cases/${caseId}`, { method: "DELETE" });
                  toast.success("Case deleted");
                  navigate({ to: "/cases" });
                },
              })
            }
          >
            <Trash2 className="h-4 w-4" /> Delete case
          </Button>
        </Can>
      </div>

      {/* AI Decision (editable) */}
      {data.decision && <DecisionCard caseId={caseId} decision={data.decision} onSave={(body) => patch.mutate({ path: `/cases/${caseId}/decision`, body })} />}

      {/* Infringements */}
      <Card>
        <CardHeader><CardTitle>Infringements ({data.infringements.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {data.infringements.map((inf) => (
            <div key={inf.id} className="rounded-md border border-border p-4">
              <div className="flex gap-4">
                {inf.screenshot_url && ensureAbsoluteUrl(inf.screenshot_url) && (
                  <a href={ensureAbsoluteUrl(inf.screenshot_url)} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <img src={ensureAbsoluteUrl(inf.screenshot_url)} alt="" className="h-24 w-32 rounded border border-border object-cover" />
                  </a>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <PlatformLogo platform={inf.platform} className="h-5 w-5" imgClassName="p-0.5" />
                    <Badge variant="outline">{inf.platform}</Badge>
                    <a href={ensureAbsoluteUrl(inf.source_url) || "#"} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-accent hover:underline">
                      {inf.source_url}
                    </a>
                  </div>
                  <Can permission="customers.edit" fallback={<div className="text-xs text-muted-foreground">risk {inf.risk_level} · {inf.match_type} · {inf.match_score}</div>}>
                    <div className="flex flex-wrap items-center gap-2">
                      <LabeledSelect label="Status" value={inf.status || ""} options={INFR_STATUS}
                        onChange={(v) => patch.mutate({ path: `/infringements/${inf.id}`, body: { status: v } })} />
                      <LabeledSelect label="Risk" value={inf.risk_level || ""} options={RISK}
                        onChange={(v) => patch.mutate({ path: `/infringements/${inf.id}`, body: { risk_level: v } })} />
                      <LabeledSelect label="Match" value={inf.match_type || ""} options={MATCH_TYPES}
                        onChange={(v) => patch.mutate({ path: `/infringements/${inf.id}`, body: { match_type: v } })} />
                      <NumberField label="Score" value={inf.match_score}
                        onSave={(v) => patch.mutate({ path: `/infringements/${inf.id}`, body: { match_score: v } })} />
                    </div>
                  </Can>
                  {inf.evidence_items.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-border pt-2">
                      {inf.evidence_items.map((ev) => (
                        <div key={ev.id} className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-muted-foreground">
                            tiers {ev.tier0_score ?? "—"}/{ev.tier1_score ?? "—"}/{ev.tier2_score ?? "—"} · overall {ev.overall_score ?? "—"}
                          </span>
                          <Can permission="customers.edit">
                            <LabeledSelect label="Verdict" value={ev.verdict || ""} options={VERDICTS}
                              onChange={(v) => patch.mutate({ path: `/evidence/${ev.id}`, body: { verdict: v } })} />
                            <LabeledSelect label="Conf" value={ev.confidence || ""} options={CONFIDENCES}
                              onChange={(v) => patch.mutate({ path: `/evidence/${ev.id}`, body: { confidence: v } })} />
                          </Can>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Takedowns */}
      <Card>
        <CardHeader><CardTitle>Takedown notices ({data.takedowns.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {data.takedowns.map((td) => (
            <TakedownCard
              key={td.id}
              td={td}
              onSave={(body) => patch.mutate({ path: `/takedowns/${td.id}`, body })}
              onSend={() => post.mutate(`/takedowns/${td.id}/send-email`)}
            />
          ))}
          {data.takedowns.length === 0 && <p className="text-sm text-muted-foreground">No takedown notices.</p>}
        </CardContent>
      </Card>

      {/* Documents */}
      {data.documents.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Documents ({data.documents.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 text-sm">
                <Badge variant="outline">{doc.document_type}</Badge>
                <Badge variant={doc.status === "sent" ? "success" : "secondary"}>{doc.status}</Badge>
                <a href={ensureAbsoluteUrl(doc.file_url) || "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  <ExternalLink className="h-3 w-3" /> Open
                </a>
                <Can permission="customers.edit">
                  <Button size="sm" variant="ghost" onClick={() => post.mutate(`/documents/${doc.id}/send-email`)}>
                    <Send className="h-3 w-3" /> Send
                  </Button>
                </Can>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {confirm.element}
    </div>
  );
}

function DecisionCard({ decision, onSave }: { caseId: string; decision: Decision; onSave: (body: unknown) => void }) {
  const [risk, setRisk] = useState(decision.risk_level || "");
  const [action, setAction] = useState(decision.recommended_action || "");
  const [conf, setConf] = useState(decision.confidence_score != null ? String(decision.confidence_score) : "");
  const [quality, setQuality] = useState(decision.evidence_quality || "");
  const [summary, setSummary] = useState(decision.case_summary || "");
  const [findings, setFindings] = useState((decision.key_findings || []).join("\n"));

  return (
    <Card>
      <CardHeader><CardTitle>AI Decision</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Can
          permission="customers.edit"
          fallback={
            <div className="space-y-1 text-sm">
              <p>Risk: {decision.risk_level} · Action: {decision.recommended_action} · Confidence: {decision.confidence_score}</p>
              <p className="text-muted-foreground">{decision.case_summary}</p>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <div><Label>Risk</Label><Select value={risk} onChange={(e) => setRisk(e.target.value)}>{RISK.map((r) => <option key={r}>{r}</option>)}</Select></div>
            <div><Label>Action</Label><Select value={action} onChange={(e) => setAction(e.target.value)}>{ACTIONS.map((a) => <option key={a}>{a}</option>)}</Select></div>
            <div><Label>Confidence</Label><Input type="number" step="0.01" min="0" max="1" value={conf} onChange={(e) => setConf(e.target.value)} /></div>
            <div><Label>Quality</Label><Input value={quality} onChange={(e) => setQuality(e.target.value)} /></div>
          </div>
          <div><Label>Summary</Label><textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-20 w-full rounded-md border border-input bg-transparent p-2 text-sm" /></div>
          <div><Label>Key findings (one per line)</Label><textarea value={findings} onChange={(e) => setFindings(e.target.value)} className="min-h-20 w-full rounded-md border border-input bg-transparent p-2 text-sm" /></div>
          <Button size="sm" onClick={() => onSave({
            risk_level: risk, recommended_action: action,
            confidence_score: conf ? Number(conf) : undefined,
            evidence_quality: quality || undefined, case_summary: summary,
            key_findings: findings.split("\n").map((s) => s.trim()).filter(Boolean),
          })}>Save decision</Button>
        </Can>
      </CardContent>
    </Card>
  );
}

function TakedownCard({ td, onSave, onSend }: { td: Takedown; onSave: (body: unknown) => void; onSend: () => void }) {
  const [text, setText] = useState(td.notice_text);
  return (
    <div className="rounded-md border border-border p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <PlatformLogo platform={td.platform} className="h-5 w-5" imgClassName="p-0.5" />
        <Badge variant="outline">{td.platform}</Badge>
        <span className="text-xs text-muted-foreground">{td.submission_method}{td.submission_email ? ` · ${td.submission_email}` : ""}</span>
        <Can permission="customers.edit" fallback={<Badge>{td.status}</Badge>}>
          <LabeledSelect label="Status" value={td.status} options={TD_STATUS} onChange={(v) => onSave({ status: v })} />
          <Button size="sm" variant="outline" className="ml-auto" onClick={onSend} disabled={!td.submission_email}>
            <Send className="h-3 w-3" /> Send email
          </Button>
        </Can>
      </div>
      <Can permission="customers.edit">
        <textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-24 w-full rounded-md border border-input bg-transparent p-2 text-xs font-mono" />
        <Button size="sm" onClick={() => onSave({ notice_text: text })}>Save notice</Button>
      </Can>
    </div>
  );
}

function LabeledSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-auto text-xs">
        {!options.includes(value) && <option value={value}>{value || "—"}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </Select>
    </label>
  );
}

function NumberField({ label, value, onSave }: { label: string; value: number | null; onSave: (v: number) => void }) {
  const [v, setV] = useState(value != null ? String(value) : "");
  useEffect(() => { setV(value != null ? String(value) : ""); }, [value]);
  return (
    <label className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="number" step="0.01" value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== "" && Number(v) !== value) onSave(Number(v)); }}
        className="h-7 w-20 text-xs"
      />
    </label>
  );
}
