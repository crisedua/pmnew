-- Create team_members table for project-level team management
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS team_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member', -- 'admin', 'member', 'viewer'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS team_members_project_id_idx ON team_members(project_id);
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON team_members(user_id);

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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
