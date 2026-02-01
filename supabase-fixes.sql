-- Complete database fixes for Portal de Proyectos
-- Run this entire file in your Supabase SQL Editor

-- 1. Add content column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS content TEXT;

-- Add index for better performance when searching document content
CREATE INDEX IF NOT EXISTS documents_content_idx ON documents USING gin(to_tsvector('spanish', content));

-- 2. Create team_members table for project-level team management
CREATE TABLE IF NOT EXISTS team_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member', -- 'admin', 'member', 'viewer'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS team_members_project_id_idx ON team_members(project_id);
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON team_members(user_id);

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view team members of projects in their areas" ON team_members;
DROP POLICY IF EXISTS "Area members can add team members to projects" ON team_members;
DROP POLICY IF EXISTS "Team admins can update team members" ON team_members;
DROP POLICY IF EXISTS "Team admins can delete team members" ON team_members;

-- RLS Policies for team_members
CREATE POLICY "Users can view team members of projects in their areas" 
ON team_members FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM projects p
        JOIN area_members am ON p.area_id = am.area_id
        WHERE p.id = team_members.project_id
        AND am.user_id = auth.uid()
    )
);

CREATE POLICY "Area members can add team members to projects" 
ON team_members FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects p
        JOIN area_members am ON p.area_id = am.area_id
        WHERE p.id = team_members.project_id
        AND am.user_id = auth.uid()
    )
);

CREATE POLICY "Team admins can update team members" 
ON team_members FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.project_id = team_members.project_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
    )
);

CREATE POLICY "Team admins can delete team members" 
ON team_members FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.project_id = team_members.project_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
    )
);

-- 3. Create document_comments table
CREATE TABLE IF NOT EXISTS document_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS document_comments_document_id_idx ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS document_comments_created_at_idx ON document_comments(created_at DESC);

-- Enable RLS
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view comments on documents they have access to" ON document_comments;
DROP POLICY IF EXISTS "Users can create comments on documents they have access to" ON document_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON document_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON document_comments;

-- RLS Policies for document_comments
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
