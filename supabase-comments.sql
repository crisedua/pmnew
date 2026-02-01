-- Document Comments System
-- Run this in your Supabase SQL Editor

-- 1. Create comments table
CREATE TABLE IF NOT EXISTS document_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS document_comments_document_id_idx 
ON document_comments(document_id);

CREATE INDEX IF NOT EXISTS document_comments_created_at_idx 
ON document_comments(created_at DESC);

-- 3. Enable RLS
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Users can view comments on documents they have access to" 
ON document_comments FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM documents d
        JOIN projects p ON d.project_id = p.id
        JOIN area_members am ON p.area_id = am.area_id
        WHERE d.id = document_comments.document_id
        AND am.user_id = auth.uid()
    )
);

CREATE POLICY "Users can create comments on documents they have access to" 
ON document_comments FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM documents d
        JOIN projects p ON d.project_id = p.id
        JOIN area_members am ON p.area_id = am.area_id
        WHERE d.id = document_comments.document_id
        AND am.user_id = auth.uid()
    )
    AND user_id = auth.uid()
);

CREATE POLICY "Users can update their own comments" 
ON document_comments FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" 
ON document_comments FOR DELETE TO authenticated
USING (user_id = auth.uid());
