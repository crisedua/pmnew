-- ============================================================
-- FIX: "infinite recursion detected in policy for relation areas"
-- Causa: la política de `areas` consulta `area_members` y la de
-- `area_members` consulta `areas` -> recursión.
-- Solución: funciones SECURITY DEFINER (saltan RLS) para las
-- comprobaciones de membresía/propiedad, y se reescriben las
-- políticas que se cruzaban.
--
-- Ejecuta TODO este archivo una vez en Supabase -> SQL Editor.
-- ============================================================

-- Funciones auxiliares: corren como owner (postgres) => NO aplican RLS
-- dentro de su cuerpo, por lo que rompen el ciclo de recursión.
CREATE OR REPLACE FUNCTION public.is_area_member(_area_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.area_members
    WHERE area_id = _area_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_area_creator(_area_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.areas
    WHERE id = _area_id AND created_by = auth.uid()
  );
$$;

-- areas: ver las mías o donde soy miembro (sin tocar RLS de area_members)
DROP POLICY IF EXISTS "Members can view their areas" ON areas;
CREATE POLICY "Members can view their areas"
ON areas FOR SELECT TO authenticated
USING ( created_by = auth.uid() OR public.is_area_member(id) );

-- area_members: ver mi propia membresía o si soy creador del área
DROP POLICY IF EXISTS "Users can view area memberships" ON area_members;
CREATE POLICY "Users can view area memberships"
ON area_members FOR SELECT TO authenticated
USING ( user_id = auth.uid() OR public.is_area_creator(area_id) );

-- area_members: el creador del área gestiona miembros
DROP POLICY IF EXISTS "Area creators can manage members" ON area_members;
CREATE POLICY "Area creators can manage members"
ON area_members FOR ALL TO authenticated
USING ( public.is_area_creator(area_id) )
WITH CHECK ( public.is_area_creator(area_id) );

-- (opcional, consistencia) projects/tasks/documents vía helper sin recursión
DROP POLICY IF EXISTS "Area members can view projects" ON projects;
CREATE POLICY "Area members can view projects"
ON projects FOR SELECT TO authenticated
USING ( public.is_area_member(area_id) );

DROP POLICY IF EXISTS "Area members can manage projects" ON projects;
CREATE POLICY "Area members can manage projects"
ON projects FOR ALL TO authenticated
USING ( public.is_area_member(area_id) )
WITH CHECK ( public.is_area_member(area_id) );
