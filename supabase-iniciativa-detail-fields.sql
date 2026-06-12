-- ============================================================
-- Detalle de iniciativa: fecha de inicio
-- ------------------------------------------------------------
-- Añade `start_date` (Inicio) a projects. El "Cierre est." de la
-- ficha reutiliza la columna existente `due_date`.
-- Ambas son opcionales: la UI muestra "Por definir" mientras estén
-- vacías. Ejecuta una sola vez en el SQL editor de Supabase.
-- ============================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
