import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  organization_id: string | null;
  org_role?: string | null;
}

interface OrgRow {
  id: string;
  name: string | null;
}

/** Full customer editor: name, email, password, organization, role, workspace. */
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
  const [organizationId, setOrganizationId] = useState(customer.organization_id || "");
  const [orgRole, setOrgRole] = useState(customer.org_role || "member");

  const { data: orgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => adminFetch<OrgRow[]>("/organizations"),
  });

  const save = useMutation({
    mutationFn: async () => {
      const profileBody: Record<string, unknown> = {};
      if (fullName !== (customer.full_name || "")) profileBody.full_name = fullName;
      if (email !== customer.email) profileBody.email = email;
      if (password.trim()) profileBody.password = password.trim();
      if (persona !== (customer.persona || "brand_owner")) profileBody.persona = persona;
      if (organizationId && organizationId !== customer.organization_id) {
        profileBody.organization_id = organizationId;
        profileBody.org_role = orgRole;
      } else if (orgRole !== (customer.org_role || "member")) {
        profileBody.org_role = orgRole;
      }

      if (Object.keys(profileBody).length) {
        await adminFetch(`/customers/${customer.id}`, { method: "PATCH", body: JSON.stringify(profileBody) });
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
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
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
        <div className="space-y-1.5">
          <Label>Organization (Group)</Label>
          <Select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
            <option value="">Standalone (No Group)</option>
            {(orgs || []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name || o.id}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Group Role</Label>
          <Select value={orgRole} onChange={(e) => setOrgRole(e.target.value)}>
            <option value="owner">owner (full write)</option>
            <option value="member">member (read-only)</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Workspace</Label>
          <Select value={persona} onChange={(e) => setPersona(e.target.value)}>
            <option value="brand_owner">Brand Owner</option>
            <option value="law_firm">Law Firm</option>
          </Select>
        </div>
      </div>
    </Dialog>
  );
}
