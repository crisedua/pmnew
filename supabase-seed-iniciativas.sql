-- ============================================================
-- Seed: 6 iniciativas de la comisión de Innovación
-- ------------------------------------------------------------
-- Requisito previo: haber ejecutado supabase-iniciativas-fields.sql
-- (columnas projects.linea y projects.codigo).
--
-- En vez de adivinar el nombre exacto de la comisión (que puede
-- llevar acentos o texto extra), anclamos al área que YA contiene
-- una iniciativa existente y visible en tu vista. Por defecto usamos
-- 'Emprendeton - Asociados Asiva'. Si tu iniciativa ancla se llama
-- distinto, cámbiala en el WITH de abajo.
--
-- Es idempotente: re-ejecutarlo no crea duplicados (se salta los
-- `codigo` que ya existan en esa comisión).
-- Líneas: 'L1 Gestion' -> badge L1, 'L2 Conexion' -> badge L2.
--
-- ¿No estás seguro del nombre? Lista tus comisiones con:
--     SELECT id, name FROM areas ORDER BY name;
--
-- NOTA: la tabla projects tiene un trigger (trg_projects_admin_only)
-- que solo permite insertar a administradores autenticados. En el SQL
-- editor no hay usuario (auth.uid() = NULL), así que lo desactivamos
-- solo para este seed y lo reactivamos al final. Si la inserción
-- fallara a mitad, vuelve a ejecutar la última línea (ENABLE TRIGGER).
-- ============================================================

ALTER TABLE public.projects DISABLE TRIGGER trg_projects_admin_only;

WITH target AS (
    SELECT area_id AS id
    FROM projects
    WHERE name = 'Emprendeton - Asociados Asiva'
    ORDER BY created_at
    LIMIT 1
)
INSERT INTO projects (area_id, name, codigo, linea, owner_name, status)
SELECT t.id, v.name, v.codigo, v.linea, v.owner_name, 'En Progreso'
FROM target t
CROSS JOIN (VALUES
    ('Programa Gestion Innovacion PYMES CORFO',        'L1-A', 'L1 Gestion',  'Daniel Hayvard'),
    ('Diseno Masterclass Tematicas Especializadas',    'L1-B', 'L1 Gestion',  'Julio Rueda'),
    ('Diseno Sprint / Bootcamp / Emprendeton Academia','L1-C', 'L1 Gestion',  'Eduardo Escalante'),
    ('Ejecucion Diagnostico de Madurez 2026',          'L2-A', 'L2 Conexion', 'Mariana Guerra'),
    ('Diseno Propuesta Summit 2027',                   'L2-B', 'L2 Conexion', 'David Rojas'),
    ('Vinculacion Inter-Comisiones',                   'L2-D', 'L2 Conexion', 'Cristian Campos')
) AS v(name, codigo, linea, owner_name)
WHERE NOT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.area_id = t.id AND p.codigo = v.codigo
);

-- Reactiva el control de admin.
ALTER TABLE public.projects ENABLE TRIGGER trg_projects_admin_only;

-- Comprobación: lista las iniciativas de esa comisión.
SELECT p.codigo, p.name, p.linea, p.owner_name
FROM projects p
WHERE p.area_id = (
    SELECT area_id FROM projects
    WHERE name = 'Emprendeton - Asociados Asiva'
    ORDER BY created_at LIMIT 1
)
ORDER BY p.codigo NULLS FIRST;
