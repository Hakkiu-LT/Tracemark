-- Per-staff permission overrides (the granular, individually-toggleable layer).
--
-- Effective permissions = role preset (permissions.py) with each row applied as an
-- override: granted=true adds, granted=false explicitly removes. is_super_admin grants
-- everything.

CREATE TABLE IF NOT EXISTS public.staff_permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id    UUID NOT NULL REFERENCES public.staff_accounts(id) ON DELETE CASCADE,
    permission  TEXT NOT NULL,   -- a value from the permission catalog, e.g. 'customers.edit'
    granted     BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT staff_permissions_unique UNIQUE (staff_id, permission)
);

CREATE INDEX IF NOT EXISTS staff_permissions_staff_idx
    ON public.staff_permissions (staff_id);

-- RLS: enabled, no permissive policy — service-role only.
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;
