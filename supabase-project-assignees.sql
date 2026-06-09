-- ============================================================
-- PROJECT ASSIGNEES — varias personas asignadas a un proyecto
--
-- Complementa el "owner" único del proyecto (owner_name/email):
-- aquí se listan todas las personas responsables/asignadas.
--
-- Requiere las funciones de RLS ya existentes:
--   public.is_area_member(uuid), public.is_area_creator(uuid)
--   (de supabase-fix-rls-recursion.sql / supabase-setup-all.sql)
--   public.is_platform_admin() (de supabase-admin-roles.sql)
--
-- Ejecuta este archivo en Supabase -> SQL Editor. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_assignees (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name        TEXT,
    email       TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_assignees_project_id_idx
    ON public.project_assignees(project_id);

ALTER TABLE public.project_assignees ENABLE ROW LEVEL SECURITY;

-- Ver: cualquier miembro de la comisión (área) del proyecto.
DROP POLICY IF EXISTS "Area members can view project assignees" ON public.project_assignees;
CREATE POLICY "Area members can view project assignees"
ON public.project_assignees FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_assignees.project_id
          AND public.is_area_member(p.area_id)
    )
);

-- Gestionar (alta/baja): admin de plataforma o dueño de la comisión.
DROP POLICY IF EXISTS "Admins or area creators manage project assignees" ON public.project_assignees;
CREATE POLICY "Admins or area creators manage project assignees"
ON public.project_assignees FOR ALL TO authenticated
USING (
    public.is_platform_admin()
    OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_assignees.project_id
          AND public.is_area_creator(p.area_id)
    )
)
WITH CHECK (
    public.is_platform_admin()
    OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_assignees.project_id
          AND public.is_area_creator(p.area_id)
    )
);
