-- TASK-W2-B2: Takedown reports table — one row per infringing URL / platform
CREATE TABLE IF NOT EXISTS public.takedown_reports (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id           UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    platform          TEXT NOT NULL,
    platform_category TEXT NOT NULL,
    infringing_url    TEXT NOT NULL,
    submission_url    TEXT,
    submission_method TEXT NOT NULL,
    submission_email  TEXT,
    notice_text       TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'pending',
    submitted_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_takedown_case     ON public.takedown_reports(case_id);
CREATE INDEX IF NOT EXISTS idx_takedown_status   ON public.takedown_reports(status);
CREATE INDEX IF NOT EXISTS idx_takedown_platform ON public.takedown_reports(platform);

-- RLS
ALTER TABLE public.takedown_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_authenticated" ON public.takedown_reports
    FOR ALL USING (auth.role() = 'authenticated');
