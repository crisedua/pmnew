-- ============================================================
-- SCRIPT CONSOLIDADO DE FUNCIONALIDADES
-- Ejecuta TODO este archivo una vez en Supabase -> SQL Editor.
-- Es idempotente (se puede correr varias veces sin problema).
--
-- Incluye, en orden de dependencias:
--   0. Funciones auxiliares de RLS (membresía/propiedad de área)
--   1. Rol de administrador de plataforma + enforcement
--   2. Capa de KPIs calculados (vistas)
--   3. Personas asignadas a proyectos
--   4. Borrado de comisiones por admins
--
-- Asume que ya existen las tablas base: profiles, areas, area_members,
-- projects, tasks, project_invitations.
-- Requiere Postgres 15+ (por security_invoker en las vistas KPI).
-- ============================================================


-- ============================================================
-- 0. FUNCIONES AUXILIARES DE RLS (sin recursión)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_area_member(_area_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.area_members
    WHERE area_id = _area_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_area_creator(_area_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.areas
    WHERE id = _area_id AND created_by = auth.uid()
  );
$$;


-- ============================================================
-- 1. ROL DE ADMINISTRADOR DE PLATAFORMA + ENFORCEMENT
--    Admin por defecto: ed@eduardoescalante.com, eduardo@soloeduia.com
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_admin)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    lower(new.email) IN ('ed@eduardoescalante.com', 'eduardo@soloeduia.com')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Solo los administradores pueden realizar esta acción'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_admin_only ON public.projects;
CREATE TRIGGER trg_projects_admin_only
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.require_admin();

DROP TRIGGER IF EXISTS trg_tasks_admin_only ON public.tasks;
CREATE TRIGGER trg_tasks_admin_only
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.require_admin();

DROP TRIGGER IF EXISTS trg_invitations_admin_only ON public.project_invitations;
CREATE TRIGGER trg_invitations_admin_only
  BEFORE INSERT ON public.project_invitations
  FOR EACH ROW EXECUTE FUNCTION public.require_admin();

-- Permite cambios cuando auth.uid() IS NULL (SQL Editor / contexto servidor);
-- solo bloquea a usuarios autenticados que no son admin.
CREATE OR REPLACE FUNCTION public.protect_admin_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     AND auth.uid() IS NOT NULL
     AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Solo los administradores pueden cambiar el rol de administrador'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_admin_flag ON public.profiles;
CREATE TRIGGER trg_protect_admin_flag
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_admin_flag();

-- Seed de admins por defecto: va DESPUÉS del trigger ya corregido, para que
-- una re-ejecución no sea bloqueada (auth.uid() es NULL en el SQL Editor).
UPDATE public.profiles
  SET is_admin = true
  WHERE lower(email) IN ('ed@eduardoescalante.com', 'eduardo@soloeduia.com');

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING ( id = auth.uid() OR public.is_platform_admin() );

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING ( id = auth.uid() OR public.is_platform_admin() )
  WITH CHECK ( id = auth.uid() OR public.is_platform_admin() );


-- ============================================================
-- 2. CAPA DE KPIs CALCULADOS (vistas)
--    Comisión (areas) -> Proyecto (projects) -> Actividad (tasks)
-- ============================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS peso SMALLINT NOT NULL DEFAULT 2;
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_peso_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_peso_check CHECK (peso IN (1, 2, 3));
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS avance_esperado NUMERIC;

CREATE OR REPLACE FUNCTION public.kpi_risk_days()
RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 7 $$;

DROP VIEW IF EXISTS public.kpi_proyecto CASCADE;
CREATE VIEW public.kpi_proyecto
WITH (security_invoker = true) AS
WITH agg AS (
    SELECT
        p.id              AS proyecto_id,
        p.area_id         AS comision_id,
        p.name            AS proyecto_nombre,
        p.peso            AS peso,
        p.due_date        AS fecha_limite,
        p.avance_esperado AS avance_esperado,
        COUNT(t.id)                                               AS actividades_total,
        COUNT(t.id) FILTER (WHERE t.status = 'Complete')          AS actividades_completadas,
        COUNT(t.id) FILTER (
            WHERE t.status <> 'Complete'
              AND t.due_date IS NOT NULL
              AND t.due_date < CURRENT_DATE)                      AS actividades_vencidas,
        COUNT(t.id) FILTER (
            WHERE t.assignee_email IS NULL
               OR btrim(t.assignee_email) = '')                   AS actividades_sin_responsable,
        COUNT(t.id) FILTER (WHERE t.health = 'red')               AS actividades_bloqueadas
    FROM public.projects p
    LEFT JOIN public.tasks t ON t.project_id = p.id
    GROUP BY p.id, p.area_id, p.name, p.peso, p.due_date, p.avance_esperado
),
calc AS (
    SELECT
        agg.*,
        CASE WHEN actividades_total = 0 THEN 0
             ELSE ROUND(actividades_completadas::numeric / actividades_total * 100)
        END AS avance_pct
    FROM agg
)
SELECT
    calc.*,
    CASE
        WHEN fecha_limite IS NOT NULL
             AND fecha_limite < CURRENT_DATE
             AND avance_pct < 100
            THEN 'atrasado'
        WHEN (avance_esperado IS NOT NULL AND avance_pct < avance_esperado)
             OR (fecha_limite IS NOT NULL
                 AND (fecha_limite - CURRENT_DATE) < public.kpi_risk_days()
                 AND avance_pct < 100)
            THEN 'en_riesgo'
        ELSE 'en_plan'
    END AS estado_salud
FROM calc;

DROP VIEW IF EXISTS public.kpi_comision CASCADE;
CREATE VIEW public.kpi_comision
WITH (security_invoker = true) AS
SELECT
    a.id   AS comision_id,
    a.name AS comision_nombre,
    COUNT(kp.proyecto_id)                                       AS proyectos_total,
    COUNT(*) FILTER (WHERE kp.avance_pct = 100)                 AS proyectos_completados,
    COUNT(*) FILTER (WHERE kp.estado_salud = 'en_riesgo')       AS proyectos_en_riesgo,
    COUNT(*) FILTER (WHERE kp.estado_salud = 'atrasado')        AS proyectos_atrasados,
    COALESCE(SUM(kp.actividades_total), 0)                      AS actividades_total,
    COALESCE(SUM(kp.actividades_completadas), 0)                AS actividades_completadas,
    COALESCE(SUM(kp.actividades_vencidas), 0)                   AS actividades_vencidas,
    CASE WHEN COALESCE(SUM(kp.peso), 0) = 0 THEN 0
         ELSE ROUND(SUM(kp.avance_pct * kp.peso)::numeric / SUM(kp.peso))
    END AS avance_global_pct
FROM public.areas a
LEFT JOIN public.kpi_proyecto kp ON kp.comision_id = a.id
GROUP BY a.id, a.name;

DROP VIEW IF EXISTS public.kpi_carga_responsable CASCADE;
CREATE VIEW public.kpi_carga_responsable
WITH (security_invoker = true) AS
SELECT
    p.area_id          AS comision_id,
    t.assignee_email   AS responsable_email,
    COUNT(*)           AS actividades_abiertas,
    COUNT(*) FILTER (
        WHERE t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE
    )                  AS actividades_vencidas
FROM public.tasks t
JOIN public.projects p ON p.id = t.project_id
WHERE t.status <> 'Complete'
  AND t.assignee_email IS NOT NULL
  AND btrim(t.assignee_email) <> ''
GROUP BY p.area_id, t.assignee_email;

GRANT SELECT ON public.kpi_proyecto          TO authenticated;
GRANT SELECT ON public.kpi_comision          TO authenticated;
GRANT SELECT ON public.kpi_carga_responsable TO authenticated;


-- ============================================================
-- 3. PERSONAS ASIGNADAS A PROYECTOS
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


-- ============================================================
-- 4. BORRADO DE COMISIONES POR ADMINS (además del creador)
-- ============================================================
DROP POLICY IF EXISTS "Creators can delete their areas" ON public.areas;
DROP POLICY IF EXISTS "Creators or admins can delete areas" ON public.areas;
CREATE POLICY "Creators or admins can delete areas"
ON public.areas FOR DELETE TO authenticated
USING ( created_by = auth.uid() OR public.is_platform_admin() );


-- ============================================================
-- 6. VISIBILIDAD TOTAL PARA ADMINS DE PLATAFORMA
--    Políticas aditivas: los admins ven todas las comisiones,
--    proyectos y tareas, aunque no sean miembros.
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all areas" ON public.areas;
CREATE POLICY "Admins can view all areas"
ON public.areas FOR SELECT TO authenticated
USING ( public.is_platform_admin() );

DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;
CREATE POLICY "Admins can view all projects"
ON public.projects FOR SELECT TO authenticated
USING ( public.is_platform_admin() );

DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;
CREATE POLICY "Admins can view all tasks"
ON public.tasks FOR SELECT TO authenticated
USING ( public.is_platform_admin() );

DROP POLICY IF EXISTS "Admins can view all area members" ON public.area_members;
CREATE POLICY "Admins can view all area members"
ON public.area_members FOR SELECT TO authenticated
USING ( public.is_platform_admin() );
