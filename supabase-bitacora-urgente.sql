-- ============================================================
-- BITÁCORA: marca "urgente"
--
-- Permite marcar filas como urgentes con una bandera. Las filas
-- marcadas se listan en la pestaña "Urgente" de la iniciativa.
--
-- Ejecuta en Supabase -> SQL Editor. Idempotente.
-- ============================================================

ALTER TABLE public.bitacora_entries
    ADD COLUMN IF NOT EXISTS urgente BOOLEAN DEFAULT false;
