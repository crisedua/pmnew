-- ============================================================
-- MODELO: Comisión -> Subcomisión
-- La "subcomisión" ES la entidad `projects` (solo cambió la etiqueta
-- en la interfaz). NO existe una tabla separada de subcomisiones.
--
-- Por lo tanto, a nivel de base de datos NO hay nada que crear.
-- Este script solo LIMPIA los artefactos de un intento anterior que
-- creaba una tabla `subcomisiones` aparte (modelo de 3 niveles),
-- por si llegaste a ejecutarlo. Es idempotente y seguro de correr
-- aunque nunca lo hayas ejecutado.
--
-- Ejecuta en Supabase -> SQL Editor (opcional; solo para limpiar).
-- ============================================================

-- 1. Quitar triggers que dependían de la tabla/columna
DROP TRIGGER IF EXISTS on_area_created_subcomision ON public.areas;
DROP TRIGGER IF EXISTS trg_set_project_area ON public.projects;

-- 2. Quitar funciones asociadas
DROP FUNCTION IF EXISTS public.add_default_subcomision();
DROP FUNCTION IF EXISTS public.set_project_area_from_subcomision();

-- 3. Quitar la columna de enlace en projects
ALTER TABLE public.projects DROP COLUMN IF EXISTS subcomision_id;

-- 4. Quitar la tabla separada (y cualquier dependencia restante)
DROP TABLE IF EXISTS public.subcomisiones CASCADE;
