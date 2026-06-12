-- ============================================================
-- Iniciativas: línea estratégica y código de iniciativa
-- ------------------------------------------------------------
-- Añade dos columnas a `projects` (= iniciativas) para la vista
-- de Iniciativas:
--   · linea   -> línea estratégica, ej. 'L1 Gestion', 'L2 Conexion'
--   · codigo  -> código corto de la iniciativa, ej. 'L1-A', 'L2-D'
--
-- Ambas son opcionales: la UI muestra '—' mientras estén vacías.
-- Ejecuta este archivo una sola vez en el SQL editor de Supabase.
-- ============================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS linea  VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS codigo VARCHAR(20);

-- Índice para filtrar/ordenar por línea en la lista de iniciativas.
CREATE INDEX IF NOT EXISTS idx_projects_linea ON projects (linea);

-- ------------------------------------------------------------
-- (Opcional) Ejemplo de cómo poblar los valores de una comisión.
-- Descomenta y ajusta el area_id / nombres a tu caso real:
--
-- UPDATE projects SET linea = 'L1 Gestion',  codigo = 'L1-A'
--   WHERE name = 'Programa Gestion Innovacion PYMES CORFO';
-- UPDATE projects SET linea = 'L2 Conexion', codigo = 'L2-A'
--   WHERE name = 'Ejecucion Diagnostico de Madurez 2026';
-- ------------------------------------------------------------
