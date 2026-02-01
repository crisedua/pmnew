-- 1. Optimize memory for this session (Fixes the 54000 error)
SET maintenance_work_mem = '128MB';

-- 2. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 3. Create chunks table if it doesn't exist
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536),
    chunk_index INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Update Index (Now with enough memory)
DROP INDEX IF EXISTS document_chunks_embedding_idx;
CREATE INDEX document_chunks_embedding_idx 
ON document_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 5. Search Function
CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5,
    filter_area_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    document_name text,
    content text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dc.id,
        dc.document_id,
        d.name as document_name,
        dc.content,
        1 - (dc.embedding <=> query_embedding) as similarity
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    JOIN projects p ON d.project_id = p.id
    WHERE 
        (filter_area_id IS NULL OR p.area_id = filter_area_id)
        AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 6. Safe Policy Creation
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view document chunks" ON document_chunks;
DROP POLICY IF EXISTS "Users can insert document chunks" ON document_chunks;
DROP POLICY IF EXISTS "Users can delete document chunks" ON document_chunks;

CREATE POLICY "Users can view document chunks" ON document_chunks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert document chunks" ON document_chunks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can delete document chunks" ON document_chunks FOR DELETE TO authenticated USING (true);
