-- Immutable audit log of every mutating admin action (plan changes, cancellations,
-- brand edits/deletes, staff changes, impersonation). Append-only.
--
-- staff_email is denormalized so the log survives deletion of the staff account.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id      UUID REFERENCES public.staff_accounts(id) ON DELETE SET NULL,
    staff_email   TEXT,
    action        TEXT NOT NULL,   -- namespaced, e.g. 'billing.plan_change'
    target_type   TEXT,            -- 'customer' | 'brand' | 'subscription' | 'staff' | ...
    target_id     TEXT,
    target_org_id TEXT,
    metadata      JSONB,           -- for edits: {"before": {...}, "after": {...}}
    ip            TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_staff_idx   ON public.admin_audit_log (staff_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx  ON public.admin_audit_log (action);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx  ON public.admin_audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);

-- RLS: enabled, no permissive policy, and no UPDATE/DELETE policy anywhere — the log is
-- append-only and only the service-role key writes to it.
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
