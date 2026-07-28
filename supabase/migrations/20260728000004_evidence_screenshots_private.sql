-- C5: make the evidence-screenshots bucket PRIVATE.
--
-- Evidence screenshots contain another tenant's infringement data. The bucket
-- was PUBLIC, so any leaked/guessed URL exposed a customer's evidence. This
-- flips it to private; the app now serves images via SHORT-LIVED SIGNED URLs.
--
-- No authenticated storage.objects SELECT policy is needed: the main API and the
-- admin API mint signed URLs with the SERVICE-ROLE key, which BYPASSES storage
-- RLS. Customers never read the bucket directly — the customer scan-result view
-- posts its bare paths to POST /infringements/screenshots/sign and the API
-- (service-role) returns signed URLs. So no per-user owner policy is required
-- (unlike legal-documents, which is uploaded/read with the anon key).
--
-- Backward compatibility: producers now store the BARE PATH; the signer also
-- accepts LEGACY full public URLs already in the DB, so NO data backfill is
-- required — both shapes resolve to the same object path before signing.
--
-- ⚠️ DEPLOYMENT ORDER — this is the ONLY destructive step. Apply it ONLY AFTER
-- the signing code (sign_screenshot_url + read-signing in the APIs + the
-- frontend batch-sign call) is deployed and image rendering is verified. If
-- applied before the code, existing public-URL <img> tags will 400/404 until
-- the readers start signing. Rollback: re-run with public = true.
--
-- Idempotent: safe to re-run.

INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence-screenshots', 'evidence-screenshots', false)
ON CONFLICT (id) DO UPDATE SET public = false;
