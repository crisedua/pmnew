-- ============================================================
-- BITÁCORA DE LA COMISIÓN
--
-- Registro editable y persistente por comisión (área): un seguimiento
-- tipo planilla (contactos con universidades, gestiones, etc.) que el
-- equipo va actualizando constantemente.
--
-- Columnas fijas: universidad, nombre, modalidad, disponibilidad,
-- estado, notas. "posicion" mantiene el orden de las filas.
--
-- Permisos (mismo modelo que area_kpis):
--   - Ver: cualquier miembro de la comisión.
--   - Editar: owner/editor de la comisión, o admin de plataforma.
--
-- Requiere las funciones de RLS existentes:
--   public.is_area_member(uuid), public.is_platform_admin()
--
-- Ejecuta en Supabase -> SQL Editor. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bitacora_entries (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    area_id        UUID REFERENCES public.areas(id) ON DELETE CASCADE NOT NULL,
    universidad    TEXT,
    nombre         TEXT,
    modalidad      TEXT,
    disponibilidad TEXT,
    estado         TEXT,
    notas          TEXT,
    posicion       INTEGER DEFAULT 0,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bitacora_entries_area_id_idx
    ON public.bitacora_entries(area_id);

ALTER TABLE public.bitacora_entries ENABLE ROW LEVEL SECURITY;

-- Ver: cualquier miembro de la comisión (o admin de plataforma).
DROP POLICY IF EXISTS "Area members can view bitacora" ON public.bitacora_entries;
CREATE POLICY "Area members can view bitacora"
ON public.bitacora_entries FOR SELECT TO authenticated
USING (
    public.is_platform_admin()
    OR public.is_area_member(bitacora_entries.area_id)
);

-- Crear: owner/editor de la comisión, o admin de plataforma.
DROP POLICY IF EXISTS "Editors can insert bitacora" ON public.bitacora_entries;
CREATE POLICY "Editors can insert bitacora"
ON public.bitacora_entries FOR INSERT TO authenticated
WITH CHECK (
    public.is_platform_admin()
    OR EXISTS (
        SELECT 1 FROM public.area_members am
        WHERE am.area_id = bitacora_entries.area_id
          AND am.user_id = auth.uid()
          AND am.role IN ('owner', 'editor')
    )
);

-- Actualizar: owner/editor de la comisión, o admin de plataforma.
DROP POLICY IF EXISTS "Editors can update bitacora" ON public.bitacora_entries;
CREATE POLICY "Editors can update bitacora"
ON public.bitacora_entries FOR UPDATE TO authenticated
USING (
    public.is_platform_admin()
    OR EXISTS (
        SELECT 1 FROM public.area_members am
        WHERE am.area_id = bitacora_entries.area_id
          AND am.user_id = auth.uid()
          AND am.role IN ('owner', 'editor')
    )
);

-- Borrar: owner/editor de la comisión, o admin de plataforma.
DROP POLICY IF EXISTS "Editors can delete bitacora" ON public.bitacora_entries;
CREATE POLICY "Editors can delete bitacora"
ON public.bitacora_entries FOR DELETE TO authenticated
USING (
    public.is_platform_admin()
    OR EXISTS (
        SELECT 1 FROM public.area_members am
        WHERE am.area_id = bitacora_entries.area_id
          AND am.user_id = auth.uid()
          AND am.role IN ('owner', 'editor')
    )
);
