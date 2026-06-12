-- ============================================================
-- ADMIN FULL ACCESS (RLS)
-- ------------------------------------------------------------
-- Los administradores de plataforma (profiles.is_admin = true)
-- pueden ver y gestionar TODO: comisiones, iniciativas, tareas,
-- documentos y equipos, sin importar quién los creó ni su rol en
-- el área. Para el resto de usuarios las reglas no cambian.
--
-- Requisitos: ya existen los helpers public.is_platform_admin(),
-- public.is_area_member() y public.is_area_creator()
-- (de supabase-admin-roles.sql y supabase-fix-rls-recursion.sql).
--
-- Idempotente: re-ejecutable sin problema. Córrelo en el SQL editor.
-- ============================================================

-- AREAS (comisiones) -----------------------------------------
DROP POLICY IF EXISTS "Members can view their areas" ON areas;
CREATE POLICY "Members can view their areas"
ON areas FOR SELECT TO authenticated
USING ( created_by = auth.uid() OR public.is_area_member(id) OR public.is_platform_admin() );

DROP POLICY IF EXISTS "Creators can update their areas" ON areas;
CREATE POLICY "Creators can update their areas"
ON areas FOR UPDATE TO authenticated
USING ( created_by = auth.uid() OR public.is_platform_admin() )
WITH CHECK ( created_by = auth.uid() OR public.is_platform_admin() );

DROP POLICY IF EXISTS "Creators can delete their areas" ON areas;
CREATE POLICY "Creators can delete their areas"
ON areas FOR DELETE TO authenticated
USING ( created_by = auth.uid() OR public.is_platform_admin() );

-- PROJECTS (iniciativas) -------------------------------------
DROP POLICY IF EXISTS "Area members can view projects" ON projects;
CREATE POLICY "Area members can view projects"
ON projects FOR SELECT TO authenticated
USING ( public.is_area_member(area_id) OR public.is_platform_admin() );

DROP POLICY IF EXISTS "Area members can manage projects" ON projects;
CREATE POLICY "Area members can manage projects"
ON projects FOR ALL TO authenticated
USING ( public.is_area_member(area_id) OR public.is_platform_admin() )
WITH CHECK ( public.is_area_member(area_id) OR public.is_platform_admin() );

-- TASKS (tareas) ---------------------------------------------
DROP POLICY IF EXISTS "Area members can manage tasks" ON tasks;
CREATE POLICY "Area members can manage tasks"
ON tasks FOR ALL TO authenticated
USING (
  public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
    WHERE p.id = tasks.project_id AND am.user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
    WHERE p.id = tasks.project_id AND am.user_id = auth.uid()
  )
);

-- DOCUMENTS (documentos) -------------------------------------
DROP POLICY IF EXISTS "Area members can manage documents" ON documents;
CREATE POLICY "Area members can manage documents"
ON documents FOR ALL TO authenticated
USING (
  public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
    WHERE p.id = documents.project_id AND am.user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
    WHERE p.id = documents.project_id AND am.user_id = auth.uid()
  )
);

-- TEAM MEMBERS (equipo) --------------------------------------
DROP POLICY IF EXISTS "Area members can add team members to projects" ON team_members;
CREATE POLICY "Area members can add team members to projects"
ON team_members FOR INSERT TO authenticated
WITH CHECK (
  public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
    WHERE p.id = team_members.project_id AND am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Area members can update team members" ON team_members;
CREATE POLICY "Area members can update team members"
ON team_members FOR UPDATE TO authenticated
USING (
  public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
    WHERE p.id = team_members.project_id AND am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Area members can delete team members" ON team_members;
CREATE POLICY "Area members can delete team members"
ON team_members FOR DELETE TO authenticated
USING (
  public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
    WHERE p.id = team_members.project_id AND am.user_id = auth.uid()
  )
);

-- PROJECT ASSIGNEES (equipo libre de la ficha) ----------------
DROP POLICY IF EXISTS "Area members can manage project assignees" ON public.project_assignees;
CREATE POLICY "Area members can manage project assignees"
ON public.project_assignees FOR ALL TO authenticated
USING (
  public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
    WHERE p.id = project_assignees.project_id AND am.user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM projects p JOIN area_members am ON p.area_id = am.area_id
    WHERE p.id = project_assignees.project_id AND am.user_id = auth.uid()
  )
);

-- INSERT directo de iniciativas/tareas por un admin -----------
-- Los triggers trg_projects_admin_only / trg_tasks_admin_only ya
-- permiten a los admins; no se tocan aquí.
