-- ============================================================
-- BITÁCORA: columna "Estudiantes"
--
-- Añade un campo de texto para anotar los estudiantes de cada
-- universidad (nombres, cantidad, etc.).
--
-- Ejecuta en Supabase -> SQL Editor. Idempotente.
-- ============================================================

ALTER TABLE public.bitacora_entries
    ADD COLUMN IF NOT EXISTS estudiantes TEXT;
