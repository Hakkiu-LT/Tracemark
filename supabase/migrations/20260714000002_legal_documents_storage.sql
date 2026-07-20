-- Legal-documents storage: make it PRIVATE with signed-URL-only access, set up
-- BEFORE the document-generation feature is switched on.
--
-- Context: the frontend generates DMCA/cease-desist PDFs client-side and uploads
-- them to the `legal-documents` bucket with the anon key. These are sensitive
-- legal documents, so the bucket must be private (not world-readable by URL) and
-- access must go through short-lived signed URLs.
--
-- The bucket previously did not exist in prod. Creating it here as PRIVATE and
-- adding owner-scoped RLS on storage.objects so that:
--   * a user can upload/read/replace/delete ONLY their own objects, and
--   * files are never publicly readable — the app must mint a signed URL
--     (supabase.storage.from('legal-documents').createSignedUrl(path, ttl)),
--     which succeeds for the owner thanks to the SELECT policy below.
--
-- Scoping is by storage.objects.owner (the uploader's uid), which Supabase sets
-- automatically on upload — robust and independent of the object path layout.
--
-- Idempotent: safe to re-run.

-- Private bucket (public = false → no public URLs work; signed URLs required).
INSERT INTO storage.buckets (id, name, public)
VALUES ('legal-documents', 'legal-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "legal_documents_owner_select" ON storage.objects;
CREATE POLICY "legal_documents_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'legal-documents' AND owner = auth.uid());

DROP POLICY IF EXISTS "legal_documents_owner_insert" ON storage.objects;
CREATE POLICY "legal_documents_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'legal-documents' AND owner = auth.uid());

-- Needed because the frontend uploads with upsert:true (an UPDATE on conflict).
DROP POLICY IF EXISTS "legal_documents_owner_update" ON storage.objects;
CREATE POLICY "legal_documents_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'legal-documents' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'legal-documents' AND owner = auth.uid());

DROP POLICY IF EXISTS "legal_documents_owner_delete" ON storage.objects;
CREATE POLICY "legal_documents_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'legal-documents' AND owner = auth.uid());
