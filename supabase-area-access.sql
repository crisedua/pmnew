-- ============================================================
-- ACCESO POR COMISIÓN ASIGNADO POR EL SUPER ADMIN
--
-- Modelo:
--  - El acceso de un usuario a una comisión = membresía en area_members.
--  - El SUPER ADMIN ve todas las comisiones y asigna qué usuario
--    pertenece a qué comisión (desde /admin).
--  - Los admins normales y usuarios solo ven las comisiones a las que
--    fueron asignados.
--
-- Requiere: public.is_super_admin() (supabase-super-admin.sql).
-- Ejecuta en Supabase -> SQL Editor. Idempotente.
-- ============================================================

-- 1. La visibilidad total pasa a ser SOLO del super admin -----
-- (Antes era de cualquier admin; ahora un admin normal ya NO ve
--  todas las comisiones, solo las asignadas.)
DROP POLICY IF EXISTS "Admins can view all areas" ON public.areas;
CREATE POLICY "Admins can view all areas"
ON public.areas FOR SELECT TO authenticated
USING ( public.is_super_admin() );

DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;
CREATE POLICY "Admins can view all projects"
ON public.projects FOR SELECT TO authenticated
USING ( public.is_super_admin() );

DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;
CREATE POLICY "Admins can view all tasks"
ON public.tasks FOR SELECT TO authenticated
USING ( public.is_super_admin() );

DROP POLICY IF EXISTS "Admins can view all area members" ON public.area_members;
CREATE POLICY "Admins can view all area members"
ON public.area_members FOR SELECT TO authenticated
USING ( public.is_super_admin() );

-- 2. El super admin gestiona las membresías (asigna accesos) ---
DROP POLICY IF EXISTS "Super admin manage area members" ON public.area_members;
CREATE POLICY "Super admin manage area members"
ON public.area_members FOR ALL TO authenticated
USING ( public.is_super_admin() )
WITH CHECK ( public.is_super_admin() );
