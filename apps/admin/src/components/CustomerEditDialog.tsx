import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { adminFetch } from "@/lib/api";
import { Button, Dialog, Input, Label, Select } from "@/components/ui";

export interface EditableCustomer {
  id: string;
  full_name: string | null;
  email: string;
  persona: string | null;
  plan: string;
  organization_id: string | null;
}

const PLANS = ["free", "starter", "growth", "pro", "agency", "enterprise"];

/** Full customer editor: name, email, password, workspace, plan. */
export function CustomerEditDialog({
  customer,
  onClose,
  onSaved,
}: {
  customer: EditableCustomer;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(customer.full_name || "");
  const [email, setEmail] = useState(customer.email || "");
  const [password, setPassword] = useState("");
  const [persona, setPersona] = useState(customer.persona || "brand_owner");
  const [plan, setPlan] = useState(customer.plan || "free");
  const [billingMode, setBillingMode] = useState<"comp" | "charge">("comp");
  const planChanged = plan !== customer.plan;

  const save = useMutation({
    mutationFn: async () => {
      // 1. Profile / auth fields.
      const profileBody: Record<string, unknown> = {};
      if (fullName !== (customer.full_name || "")) profileBody.full_name = fullName;
      if (email !== customer.email) profileBody.email = email;
      if (password.trim()) profileBody.password = password.trim();
      if (persona !== (customer.persona || "brand_owner")) profileBody.persona = persona;
      if (Object.keys(profileBody).length) {
        await adminFetch(`/customers/${customer.id}`, { method: "PATCH", body: JSON.stringify(profileBody) });
      }
      // 2. Plan (separate billing endpoint) — comp (free) or charge (Stripe prorated).
      if (plan !== customer.plan) {
        await adminFetch(`/customers/${customer.id}/plan`, {
          method: "PUT",
          body: JSON.stringify({ plan, mode: billingMode }),
        });
      }
    },
    onSuccess: () => {
      toast.success("Customer updated");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", customer.id] });
      qc.invalidateQueries({ queryKey: ["organizations"] });
      onSaved?.();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit customer"
      description="Changes write to the same account/tables the customer app uses."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label>Full name</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="—" />
      </div>
      <div className="space-y-1.5">
        <Label>Email <span className="text-xs text-muted-foreground">(changes their login)</span></Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>New password <span className="text-xs text-muted-foreground">(optional — leave blank to keep)</span></Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Workspace</Label>
          <Select value={persona} onChange={(e) => setPersona(e.target.value)}>
            <option value="brand_owner">Brand Owner</option>
            <option value="law_firm">Law Firm</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Plan</Label>
          <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </div>
      </div>
      {planChanged && (
        <div className="space-y-1.5 rounded-md border border-border p-3">
          <Label>How to apply the plan change?</Label>
          <Select value={billingMode} onChange={(e) => setBillingMode(e.target.value as "comp" | "charge")}>
            <option value="comp">Comp — just change it, no charge (free upgrade)</option>
            <option value="charge">Charge — bill the customer via Stripe (prorated)</option>
          </Select>
          <p className="text-xs text-muted-foreground">
            {billingMode === "charge"
              ? "Modifies their Stripe subscription and bills the difference now. Requires an active subscription + card on file."
              : "Grants the plan without any payment. Use for comps, enterprise deals, or testing."}
          </p>
        </div>
      )}
    </Dialog>
  );
}
