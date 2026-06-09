-- ============================================================
-- SETUP COMPLETO - Portal de Proyectos (Comisiones / OKR)
-- Pega y ejecuta TODO este archivo en Supabase -> SQL Editor.
-- Es idempotente: se puede correr varias veces sin romper nada.
--
-- Orden: extensiones -> esquema base -> columnas usadas por la app
--        -> team/comentarios/invitaciones -> storage -> capa OKR
-- ============================================================

-- 0. Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ESQUEMA BASE (profiles, areas, area_members, projects, tasks, documents)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS areas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  share_token UUID DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS area_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner', 'editor', 'viewer'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(area_id, user_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'En Progreso',
  due_date DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'To Do',
  priority VARCHAR(20) DEFAULT 'Media',
  assignee_id UUID REFERENCES profiles(id),
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  file_type VARCHAR(100),
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auto-perfil al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill: crea perfiles para usuarios que ya existían antes del trigger
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, raw_user_meta_data->>'full_name'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Red de seguridad: garantiza el perfil del creador antes de insertar un área
CREATE OR REPLACE FUNCTION public.ensure_profile_for_area()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  SELECT u.id, u.email, u.raw_user_meta_data->>'full_name'
  FROM auth.users u
  WHERE u.id = NEW.created_by
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_profile_before_area ON areas;
CREATE TRIGGER ensure_profile_before_area
  BEFORE INSERT ON areas
  FOR EACH ROW EXECUTE PROCEDURE public.ensure_profile_for_area();

-- Al crear un área, el creador queda como 'owner'
CREATE OR REPLACE FUNCTION public.add_creator_to_area()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.area_members (area_id, user_id, role)
  VALUES (new.id, new.created_by, 'owner')
  ON CONFLICT (area_id, user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_area_created
  AFTER INSERT ON areas
  FOR EACH ROW EXECUTE PROCEDURE public.add_creator_to_area();

-- ============================================================
-- 2. COLUMNAS QUE LA APP USA (no estaban en el esquema original)
-- ============================================================
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS assignee_name  VARCHAR(255);
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS assignee_email VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS responsible_email VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS institution VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content TEXT;

-- ============================================================
-- 2b. FUNCIONES AUXILIARES (SECURITY DEFINER) para evitar
--     recursión en RLS entre areas <-> area_members
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_area_member(_area_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.area_members WHERE area_id = _area_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_area_creator(_area_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.areas WHERE id = _area_id AND created_by = auth.uid());
$$;

-- ============================================================
-- 3. RLS BÁSICA del esquema base
--    (permisiva: cualquier miembro del área puede operar)
-- ============================================================
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents    ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "Profiles are viewable by authenticated" ON profiles;
CREATE POLICY "Profiles are viewable by authenticated"
ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- areas: ver las que soy miembro; crear como mías
DROP POLICY IF EXISTS "Members can view their areas" ON areas;
CREATE POLICY "Members can view their areas"
ON areas FOR SELECT TO authenticated
USING ( created_by = auth.uid() OR public.is_area_member(id) );

DROP POLICY IF EXISTS "Users can create areas" ON areas;
CREATE POLICY "Users can create areas"
ON areas FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Creators can update their areas" ON areas;
CREATE POLICY "Creators can update their areas"
ON areas FOR UPDATE TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Creators can delete their areas" ON areas;
CREATE POLICY "Creators can delete their areas"
ON areas FOR DELETE TO authenticated USING (created_by = auth.uid());

-- area_members: ver mi membresía; el trigger (SECURITY DEFINER) inserta al creador
DROP POLICY IF EXISTS "Users can view area memberships" ON area_members;
CREATE POLICY "Users can view area memberships"
ON area_members FOR SELECT TO authenticated
USING ( user_id = auth.uid() OR public.is_area_creator(area_id) );

DROP POLICY IF EXISTS "Area creators can manage members" ON area_members;
CREATE POLICY "Area creators can manage members"
ON area_members FOR ALL TO authenticated
USING ( public.is_area_creator(area_id) )
WITH CHECK ( public.is_area_creator(area_id) );

DROP POLICY IF EXISTS "Users can join via membership row" ON area_members;
CREATE POLICY "Users can join via membership row"
ON area_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- projects: cualquier miembro del área
DROP POLICY IF EXISTS "Area members can view projects" ON projects;
CREATE POLICY "Area members can view projects"
ON projects FOR SELECT TO authenticated
USING ( public.is_area_member(area_id) );

DROP POLICY IF EXISTS "Area members can manage projects" ON projects;
CREATE POLICY "Area members can manage projects"
ON projects FOR ALL TO authenticated
USING ( public.is_area_member(area_id) )
WITH CHECK ( public.is_area_member(area_id) );

-- tasks: cualquier miembro del área del proyecto
DROP POLICY IF EXISTS "Area members can view tasks" ON tasks;
CREATE POLICY "Area members can view tasks"
ON tasks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
  WHERE p.id = tasks.project_id AND am.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Area members can manage tasks" ON tasks;
CREATE POLICY "Area members can manage tasks"
ON tasks FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
  WHERE p.id = tasks.project_id AND am.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
  WHERE p.id = tasks.project_id AND am.user_id = auth.uid()
));

-- documents: cualquier miembro del área del proyecto
DROP POLICY IF EXISTS "Area members can view documents" ON documents;
CREATE POLICY "Area members can view documents"
ON documents FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
  WHERE p.id = documents.project_id AND am.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Area members can manage documents" ON documents;
CREATE POLICY "Area members can manage documents"
ON documents FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
  WHERE p.id = documents.project_id AND am.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
  WHERE p.id = documents.project_id AND am.user_id = auth.uid()
));

-- ============================================================
-- 4. TEAM MEMBERS + DOCUMENT COMMENTS + INVITATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS team_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view team members of projects in their areas" ON team_members;
CREATE POLICY "Users can view team members of projects in their areas"
ON team_members FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
  WHERE p.id = team_members.project_id AND am.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Area members can add team members to projects" ON team_members;
CREATE POLICY "Area members can add team members to projects"
ON team_members FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
  WHERE p.id = team_members.project_id AND am.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Area members can update team members" ON team_members;
CREATE POLICY "Area members can update team members"
ON team_members FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
  WHERE p.id = team_members.project_id AND am.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Area members can delete team members" ON team_members;
CREATE POLICY "Area members can delete team members"
ON team_members FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
  WHERE p.id = team_members.project_id AND am.user_id = auth.uid()
));

CREATE TABLE IF NOT EXISTS document_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view comments on documents they have access to" ON document_comments;
CREATE POLICY "Users can view comments on documents they have access to"
ON document_comments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM documents d JOIN projects p ON d.project_id = p.id
  JOIN area_members am ON p.area_id = am.area_id
  WHERE d.id = document_comments.document_id AND am.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can create comments on documents they have access to" ON document_comments;
CREATE POLICY "Users can create comments on documents they have access to"
ON document_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM documents d JOIN projects p ON d.project_id = p.id
    JOIN area_members am ON p.area_id = am.area_id
    WHERE d.id = document_comments.document_id AND am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their own comments" ON document_comments;
CREATE POLICY "Users can update their own comments"
ON document_comments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own comments" ON document_comments;
CREATE POLICY "Users can delete their own comments"
ON document_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS project_invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id)
);
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invitations for their projects" ON project_invitations;
CREATE POLICY "Users can view invitations for their projects"
ON project_invitations FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
  WHERE p.id = project_invitations.project_id AND am.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can insert invitations for their projects" ON project_invitations;
CREATE POLICY "Users can insert invitations for their projects"
ON project_invitations FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
  WHERE p.id = project_invitations.project_id AND am.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can delete invitations for their projects" ON project_invitations;
CREATE POLICY "Users can delete invitations for their projects"
ON project_invitations FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
  WHERE p.id = project_invitations.project_id AND am.user_id = auth.uid()
));

-- ============================================================
-- 5. STORAGE (bucket para documentos)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Upload project-documents" ON storage.objects;
CREATE POLICY "Upload project-documents" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-documents');

DROP POLICY IF EXISTS "Update project-documents" ON storage.objects;
CREATE POLICY "Update project-documents" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'project-documents');

DROP POLICY IF EXISTS "View project-documents" ON storage.objects;
CREATE POLICY "View project-documents" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'project-documents');

DROP POLICY IF EXISTS "Delete project-documents" ON storage.objects;
CREATE POLICY "Delete project-documents" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'project-documents');

-- ============================================================
-- 6. CAPA OKR (KPIs, semáforo, comentarios y trazabilidad de tareas)
--    Idéntico a supabase-okr.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS area_kpis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    area_id UUID REFERENCES areas(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(20) DEFAULT 'número',
    baseline_value NUMERIC DEFAULT 0,
    current_value NUMERIC DEFAULT 0,
    target_value NUMERIC DEFAULT 0,
    due_date DATE,
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS area_kpis_area_id_idx ON area_kpis(area_id);
ALTER TABLE area_kpis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Area members can view KPIs" ON area_kpis;
CREATE POLICY "Area members can view KPIs"
ON area_kpis FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM area_members am WHERE am.area_id = area_kpis.area_id AND am.user_id = auth.uid()));

DROP POLICY IF EXISTS "Area owners/editors can insert KPIs" ON area_kpis;
CREATE POLICY "Area owners/editors can insert KPIs"
ON area_kpis FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM area_members am WHERE am.area_id = area_kpis.area_id AND am.user_id = auth.uid() AND am.role IN ('owner','editor')));

DROP POLICY IF EXISTS "Area owners/editors can update KPIs" ON area_kpis;
CREATE POLICY "Area owners/editors can update KPIs"
ON area_kpis FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM area_members am WHERE am.area_id = area_kpis.area_id AND am.user_id = auth.uid() AND am.role IN ('owner','editor')));

DROP POLICY IF EXISTS "Area owners/editors can delete KPIs" ON area_kpis;
CREATE POLICY "Area owners/editors can delete KPIs"
ON area_kpis FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM area_members am WHERE am.area_id = area_kpis.area_id AND am.user_id = auth.uid() AND am.role IN ('owner','editor')));

-- Datos de contacto del owner de la iniciativa
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(50);

-- Semáforo + avance en tareas
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS health VARCHAR(10);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS health_note TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
UPDATE tasks SET last_progress_at = COALESCE(updated_at, created_at, NOW()) WHERE last_progress_at IS NULL;

-- Comentarios de tarea
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS task_comments_task_id_idx ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS task_comments_created_at_idx ON task_comments(created_at DESC);
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Area members can view task comments" ON task_comments;
CREATE POLICY "Area members can view task comments"
ON task_comments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM tasks t JOIN projects p ON t.project_id = p.id
  JOIN area_members am ON p.area_id = am.area_id
  WHERE t.id = task_comments.task_id AND am.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Area members can create task comments" ON task_comments;
CREATE POLICY "Area members can create task comments"
ON task_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM tasks t JOIN projects p ON t.project_id = p.id
    JOIN area_members am ON p.area_id = am.area_id
    WHERE t.id = task_comments.task_id AND am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their own task comments" ON task_comments;
CREATE POLICY "Users can update their own task comments"
ON task_comments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own task comments" ON task_comments;
CREATE POLICY "Users can delete their own task comments"
ON task_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Trazabilidad automática
CREATE TABLE IF NOT EXISTS task_activity (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    type VARCHAR(30) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS task_activity_task_id_idx ON task_activity(task_id);
CREATE INDEX IF NOT EXISTS task_activity_project_id_idx ON task_activity(project_id);
CREATE INDEX IF NOT EXISTS task_activity_created_at_idx ON task_activity(created_at DESC);
ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Area members can view task activity" ON task_activity;
CREATE POLICY "Area members can view task activity"
ON task_activity FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM tasks t JOIN projects p ON t.project_id = p.id
  JOIN area_members am ON p.area_id = am.area_id
  WHERE t.id = task_activity.task_id AND am.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Area members can insert task activity" ON task_activity;
CREATE POLICY "Area members can insert task activity"
ON task_activity FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM tasks t JOIN projects p ON t.project_id = p.id
  JOIN area_members am ON p.area_id = am.area_id
  WHERE t.id = task_activity.task_id AND am.user_id = auth.uid()
));

-- Triggers de avance / trazabilidad
CREATE OR REPLACE FUNCTION public.handle_task_progress()
RETURNS trigger AS $$
BEGIN
    IF (NEW.status IS DISTINCT FROM OLD.status) THEN
        NEW.last_progress_at := NOW();
        INSERT INTO public.task_activity (task_id, project_id, user_id, type, old_value, new_value)
        VALUES (NEW.id, NEW.project_id, auth.uid(), 'status_change', OLD.status, NEW.status);
    END IF;
    IF (NEW.health IS DISTINCT FROM OLD.health) THEN
        INSERT INTO public.task_activity (task_id, project_id, user_id, type, old_value, new_value)
        VALUES (NEW.id, NEW.project_id, auth.uid(), 'health_change', OLD.health, NEW.health);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_task_progress ON tasks;
CREATE TRIGGER on_task_progress
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE PROCEDURE public.handle_task_progress();

CREATE OR REPLACE FUNCTION public.handle_task_created()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.task_activity (task_id, project_id, user_id, type, new_value)
    VALUES (NEW.id, NEW.project_id, auth.uid(), 'created', NEW.status);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_task_created ON tasks;
CREATE TRIGGER on_task_created
    AFTER INSERT ON tasks
    FOR EACH ROW EXECUTE PROCEDURE public.handle_task_created();

-- ============================================================
-- FIN. Si no usas el Asistente IA, omite supabase-vectors.sql.
-- ============================================================
