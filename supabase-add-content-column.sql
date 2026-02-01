-- Add content column to documents table for rich text editor
-- Run this in your Supabase SQL Editor

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS content TEXT;

-- Add index for better performance when searching document content
CREATE INDEX IF NOT EXISTS documents_content_idx ON documents USING gin(to_tsvector('spanish', content));
