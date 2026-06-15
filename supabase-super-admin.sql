-- ============================================================
-- SUPER ADMIN — solo el super admin gestiona usuarios (roles)
--
-- - admin: crea/gestiona comisiones, proyectos, tareas y ve todo.
-- - super_admin: además otorga/quita el rol admin a otros usuarios.
--
-- Super admin por defecto: ed@eduardoescalante.com
--
-- Requiere supabase-admin-roles.sql (is_platform_admin, profiles.is_admin).
-- Ejecuta en Supabase -> SQL Editor. Idempotente.
-- ============================================================

-- 1. Columna is_super_admin
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Helper: ¿el usuario actual es super admin?
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- 3. Solo el super admin puede cambiar is_admin / is_super_admin.
--    (auth.uid() IS NULL => contexto servidor / SQL Editor, permitido.)
CREATE OR REPLACE FUNCTION public.protect_admin_flag()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (NEW.is_admin       IS DISTINCT FROM OLD.is_admin
      OR NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin)
     AND auth.uid() IS NOT NULL
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo el super administrador puede cambiar roles de administrador'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_admin_flag ON public.profiles;
CREATE TRIGGER trg_protect_admin_flag
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_admin_flag();

-- 4. Política UPDATE de profiles: el super admin actualiza cualquier perfil;
--    cada usuario solo el suyo. (Un admin normal ya no puede editar otros.)
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can update profiles" ON public.profiles;
CREATE POLICY "Super admin can update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING ( id = auth.uid() OR public.is_super_admin() )
  WITH CHECK ( id = auth.uid() OR public.is_super_admin() );

-- 5. Seed: ed@eduardoescalante.com es super admin (y admin).
UPDATE public.profiles
  SET is_super_admin = true, is_admin = true
  WHERE lower(email) = 'ed@eduardoescalante.com';
