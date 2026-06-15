-- ============================================================
-- VISIBILIDAD TOTAL PARA ADMINS DE PLATAFORMA
--
-- Los administradores de plataforma deben ver TODAS las comisiones,
-- proyectos y tareas, aunque no sean miembros de esas comisiones.
--
-- Estas son políticas ADITIVAS (permisivas): se suman a las
-- existentes por membresía con un OR, sin reemplazarlas. No afectan
-- a los usuarios no-admin.
--
-- Requiere public.is_platform_admin() (supabase-admin-roles.sql).
-- Ejecuta en Supabase -> SQL Editor. Idempotente.
-- ============================================================

-- Comisiones (areas)
DROP POLICY IF EXISTS "Admins can view all areas" ON public.areas;
CREATE POLICY "Admins can view all areas"
ON public.areas FOR SELECT TO authenticated
USING ( public.is_platform_admin() );

-- Proyectos
DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;
CREATE POLICY "Admins can view all projects"
ON public.projects FOR SELECT TO authenticated
USING ( public.is_platform_admin() );

-- Tareas
DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;
CREATE POLICY "Admins can view all tasks"
ON public.tasks FOR SELECT TO authenticated
USING ( public.is_platform_admin() );

-- Membresías (para que un admin pueda inspeccionar los equipos)
DROP POLICY IF EXISTS "Admins can view all area members" ON public.area_members;
CREATE POLICY "Admins can view all area members"
ON public.area_members FOR SELECT TO authenticated
USING ( public.is_platform_admin() );
