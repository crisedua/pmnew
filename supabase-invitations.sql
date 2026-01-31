-- Create project_invitations table
CREATE TABLE IF NOT EXISTS project_invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'member', -- member, admin, viewer
    status TEXT DEFAULT 'pending', -- pending, accepted, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view invitations for their projects" ON project_invitations
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.project_id = project_invitations.project_id
        AND team_members.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_invitations.project_id
        AND projects.created_by = auth.uid()
    )
);

CREATE POLICY "Users can insert invitations for their projects" ON project_invitations
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_invitations.project_id
        AND projects.created_by = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.project_id = project_invitations.project_id
        AND team_members.user_id = auth.uid()
        AND team_members.role = 'admin'
    )
);

CREATE POLICY "Users can delete invitations for their projects" ON project_invitations
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_invitations.project_id
        AND projects.created_by = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.project_id = project_invitations.project_id
        AND team_members.user_id = auth.uid()
        AND team_members.role = 'admin'
    )
);
