CREATE TABLE IF NOT EXISTS documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    infringement_id UUID NOT NULL REFERENCES infringements(id) ON DELETE CASCADE,
    document_type   TEXT NOT NULL CHECK (document_type IN ('dmca', 'cease-desist')),
    file_url        TEXT NOT NULL,
    file_format     TEXT NOT NULL CHECK (file_format IN ('pdf', 'docx')),
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'acknowledged')),
    generated_at    TIMESTAMPTZ DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_infringement ON documents(infringement_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage documents"
    ON documents FOR ALL
    USING (auth.role() = 'authenticated');
