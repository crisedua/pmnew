-- ============================================================
-- SUBCOMISIONES - nivel intermedio entre Comisión y Proyecto
-- Jerarquía: Comisión (areas) -> Subcomisión -> Proyecto (projects)
--
-- Ejecuta DESPUÉS de supabase-all-features.sql (usa is_area_member,
-- is_area_creator, is_platform_admin). Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabla de subcomisiones (cuelga de una comisión / area)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subcomisiones (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    area_id     UUID REFERENCES public.areas(id) ON DELETE CASCADE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order  INTEGER DEFAULT 0,
    created_by  UUID REFERENCES public.profiles(id),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subcomisiones_area_id_idx ON public.subcomisiones(area_id);

-- ------------------------------------------------------------
-- 2. projects.subcomision_id (a qué subcomisión pertenece)
-- ------------------------------------------------------------
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS subcomision_id UUID REFERENCES public.subcomisiones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_subcomision_id_idx ON public.projects(subcomision_id);

-- ------------------------------------------------------------
-- 3. MIGRACIÓN: una subcomisión 'General' por comisión y mover
--    ahí los proyectos que aún no tienen subcomisión.
-- ------------------------------------------------------------
INSERT INTO public.subcomisiones (area_id, name, description, created_by)
SELECT a.id, 'General', 'Subcomisión por defecto', a.created_by
FROM public.areas a
WHERE NOT EXISTS (
    SELECT 1 FROM public.subcomisiones s
    WHERE s.area_id = a.id AND s.name = 'General'
);

UPDATE public.projects p
SET subcomision_id = s.id
FROM public.subcomisiones s
WHERE s.area_id = p.area_id
  AND s.name = 'General'
  AND p.subcomision_id IS NULL;

-- ------------------------------------------------------------
-- 4. Coherencia: area_id del proyecto se deriva de su subcomisión.
--    Así projects.area_id (que usan las vistas KPI) siempre cuadra.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_project_area_from_subcomision()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.subcomision_id IS NOT NULL THEN
        SELECT area_id INTO NEW.area_id
        FROM public.subcomisiones
        WHERE id = NEW.subcomision_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_project_area ON public.projects;
CREATE TRIGGER trg_set_project_area
    BEFORE INSERT OR UPDATE OF subcomision_id ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.set_project_area_from_subcomision();

-- ------------------------------------------------------------
-- 4b. Toda comisión nueva nace con una subcomisión 'General'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_default_subcomision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.subcomisiones (area_id, name, description, created_by)
    VALUES (NEW.id, 'General', 'Subcomisión por defecto', NEW.created_by);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_area_created_subcomision ON public.areas;
CREATE TRIGGER on_area_created_subcomision
    AFTER INSERT ON public.areas
    FOR EACH ROW EXECUTE FUNCTION public.add_default_subcomision();

-- ------------------------------------------------------------
-- 5. RLS: ver si eres miembro de la comisión; gestionar si eres
--    admin de plataforma o creador de la comisión.
-- ------------------------------------------------------------
ALTER TABLE public.subcomisiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Area members can view subcomisiones" ON public.subcomisiones;
CREATE POLICY "Area members can view subcomisiones"
ON public.subcomisiones FOR SELECT TO authenticated
USING ( public.is_area_member(area_id) );

DROP POLICY IF EXISTS "Admins or area creators manage subcomisiones" ON public.subcomisiones;
CREATE POLICY "Admins or area creators manage subcomisiones"
ON public.subcomisiones FOR ALL TO authenticated
USING ( public.is_platform_admin() OR public.is_area_creator(area_id) )
WITH CHECK ( public.is_platform_admin() OR public.is_area_creator(area_id) );
