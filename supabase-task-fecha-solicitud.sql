-- ============================================================
-- TAREAS: columna "Fecha de solicitud"
--
-- Fecha en que se solicitó/originó la tarea (distinta de due_date,
-- que es la fecha límite).
--
-- Ejecuta en Supabase -> SQL Editor. Idempotente.
-- ============================================================

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS fecha_solicitud DATE;
