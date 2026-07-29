-- Per-copycat status workflow (Jira-like case control).
--
-- The original constraint only allowed ('flagged', 'reviewed', 'dismissed').
-- Migration 20260706000001 dropped it, but a later schema sync re-created the
-- original CHECK, so the API silently remapped every "advanced" status
-- (analyzing/complete/escalated/...) back to 'reviewed'/'dismissed' and the
-- cases list never reflected the user's choice.
--
-- 1) Drop the stale constraint for good.
-- 2) Re-add a CHECK covering the full per-copycat workflow used by the
--    customer app, the monitoring pipeline and the admin portal.

ALTER TABLE public.infringements DROP CONSTRAINT IF EXISTS infringements_status_check;

ALTER TABLE public.infringements
    ADD CONSTRAINT infringements_status_check
    CHECK (status IN (
        'pending',        -- initial triage state (alias of flagged)
        'flagged',        -- default written by the detection pipeline
        'analyzing',      -- user started reviewing the copycat
        'active',         -- legacy alias of analyzing
        'reviewed',       -- legacy value kept for pre-workflow rows
        'escalated',      -- escalated to counsel
        'takedown_sent',  -- takedown notice sent to the platform
        'complete',       -- user finished the case
        'completed',      -- alias of complete
        'resolved',       -- alias of complete
        'declined',       -- user rejected the case (with reason)
        'safe',           -- user marked the copycat as safe
        'dismissed',      -- legacy alias of safe
        'error'           -- evidence capture failed
    ));
