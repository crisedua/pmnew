-- ============================================================
-- BITÁCORA POR INICIATIVA (subcomisión)
--
-- Mueve la bitácora al nivel de la iniciativa: cada iniciativa
-- (proyecto) tiene su propia planilla de seguimiento.
--
-- Añade project_id a bitacora_entries y hace area_id opcional.
-- Los permisos se resuelven por la comisión (área) del proyecto,
-- igual que project_assignees.
--
-- Requiere: public.is_area_member(uuid), public.is_area_creator(uuid),
--           public.is_platform_admin()
--
-- Ejecuta en Supabase -> SQL Editor DESPUÉS de supabase-bitacora.sql.
-- Idempotente.
-- ============================================================

-- 1. Nueva columna project_id y area_id opcional -------------
ALTER TABLE public.bitacora_entries
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.bitacora_entries
    ALTER COLUMN area_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS bitacora_entries_project_id_idx
    ON public.bitacora_entries(project_id);

-- 2. Políticas para filas por iniciativa ---------------------
-- Ver: cualquier miembro de la comisión del proyecto.
DROP POLICY IF EXISTS "Area members can view project bitacora" ON public.bitacora_entries;
CREATE POLICY "Area members can view project bitacora"
ON public.bitacora_entries FOR SELECT TO authenticated
USING (
    project_id IS NOT NULL
    AND (
        public.is_platform_admin()
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = bitacora_entries.project_id
              AND public.is_area_member(p.area_id)
        )
    )
);

-- Crear: owner/editor de la comisión del proyecto.
DROP POLICY IF EXISTS "Editors can insert project bitacora" ON public.bitacora_entries;
CREATE POLICY "Editors can insert project bitacora"
ON public.bitacora_entries FOR INSERT TO authenticated
WITH CHECK (
    project_id IS NOT NULL
    AND (
        public.is_platform_admin()
        OR EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.area_members am ON am.area_id = p.area_id
            WHERE p.id = bitacora_entries.project_id
              AND am.user_id = auth.uid()
              AND am.role IN ('owner', 'editor')
        )
    )
);

-- Actualizar: owner/editor de la comisión del proyecto.
DROP POLICY IF EXISTS "Editors can update project bitacora" ON public.bitacora_entries;
CREATE POLICY "Editors can update project bitacora"
ON public.bitacora_entries FOR UPDATE TO authenticated
USING (
    project_id IS NOT NULL
    AND (
        public.is_platform_admin()
        OR EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.area_members am ON am.area_id = p.area_id
            WHERE p.id = bitacora_entries.project_id
              AND am.user_id = auth.uid()
              AND am.role IN ('owner', 'editor')
        )
    )
);

-- Borrar: owner/editor de la comisión del proyecto.
DROP POLICY IF EXISTS "Editors can delete project bitacora" ON public.bitacora_entries;
CREATE POLICY "Editors can delete project bitacora"
ON public.bitacora_entries FOR DELETE TO authenticated
USING (
    project_id IS NOT NULL
    AND (
        public.is_platform_admin()
        OR EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.area_members am ON am.area_id = p.area_id
            WHERE p.id = bitacora_entries.project_id
              AND am.user_id = auth.uid()
              AND am.role IN ('owner', 'editor')
        )
    )
);
