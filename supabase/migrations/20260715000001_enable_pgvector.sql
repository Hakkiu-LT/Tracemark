-- Enable pgvector extension for semantic similarity search.
-- Used by evidence_items.embedding and brand_assets.embedding columns.
-- Supabase supports this extension natively on all Postgres instances.

CREATE EXTENSION IF NOT EXISTS vector;
