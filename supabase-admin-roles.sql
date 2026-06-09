-- ============================================================
-- ADMIN ROLES (rol de administrador a nivel de plataforma)
--
-- Objetivo: SOLO los administradores pueden crear proyectos,
-- tareas e invitar equipo. Los administradores se gestionan
-- desde la sección /admin de la app. Admin por defecto:
-- ed@eduardoescalante.com
--
-- Ejecuta TODO este archivo una vez en Supabase -> SQL Editor.
-- Es idempotente: se puede correr varias veces sin problema.
-- ============================================================

-- 1. Columna is_admin en profiles ----------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Admin por defecto (si el perfil ya existe)
UPDATE public.profiles
  SET is_admin = true
  WHERE lower(email) = 'ed@eduardoescalante.com';

-- 2. Asegurar admin por defecto también al registrarse -------
-- (por si el perfil de ed@eduardoescalante.com se crea después)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_admin)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    lower(new.email) = 'ed@eduardoescalante.com'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Helper: ¿el usuario actual es admin de plataforma? ------
-- SECURITY DEFINER => ignora RLS dentro del cuerpo (sin recursión).
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- 4. Enforcement: solo admins pueden INSERTAR -----------------
-- Trigger genérico que bloquea el INSERT si el usuario no es admin.
CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Solo los administradores pueden realizar esta acción'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;
  RETURN NEW;
END;
$$;

-- Proyectos: solo admins crean
DROP TRIGGER IF EXISTS trg_projects_admin_only ON public.projects;
CREATE TRIGGER trg_projects_admin_only
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.require_admin();

-- Tareas: solo admins crean
DROP TRIGGER IF EXISTS trg_tasks_admin_only ON public.tasks;
CREATE TRIGGER trg_tasks_admin_only
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.require_admin();

-- Invitaciones de equipo: solo admins invitan
DROP TRIGGER IF EXISTS trg_invitations_admin_only ON public.project_invitations;
CREATE TRIGGER trg_invitations_admin_only
  BEFORE INSERT ON public.project_invitations
  FOR EACH ROW EXECUTE FUNCTION public.require_admin();

-- 5. Proteger el flag is_admin --------------------------------
-- Aunque la UI solo lo expone a admins, garantizamos en BD que
-- un no-admin no pueda auto-otorgarse el rol.
CREATE OR REPLACE FUNCTION public.protect_admin_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
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

-- 6. Políticas para la sección /admin -------------------------
-- Permiten a un admin ver todos los perfiles y actualizar el rol.
-- (Solo surten efecto si profiles tiene RLS habilitado; si no,
-- son inertes y la app sigue funcionando igual.)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING ( id = auth.uid() OR public.is_platform_admin() );

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING ( id = auth.uid() OR public.is_platform_admin() )
  WITH CHECK ( id = auth.uid() OR public.is_platform_admin() );
