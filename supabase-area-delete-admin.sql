-- ============================================================
-- Permitir que los ADMINISTRADORES de plataforma eliminen
-- cualquier comisión (area), no solo las que crearon.
--
-- Requiere haber corrido antes supabase-admin-roles.sql
-- (necesita la función public.is_platform_admin()).
--
-- Ejecuta este archivo en Supabase -> SQL Editor. Idempotente.
-- ============================================================

DROP POLICY IF EXISTS "Creators can delete their areas" ON public.areas;
DROP POLICY IF EXISTS "Creators or admins can delete areas" ON public.areas;

CREATE POLICY "Creators or admins can delete areas"
ON public.areas FOR DELETE TO authenticated
USING ( created_by = auth.uid() OR public.is_platform_admin() );
