-- ============================================================
-- Seed: 6 iniciativas de la comisión "Comision Innovacion"
-- ------------------------------------------------------------
-- Requisitos previos:
--   1. Haber ejecutado supabase-iniciativas-fields.sql
--      (columnas projects.linea y projects.codigo).
--   2. Que exista la comisión (area) con nombre 'Comision Innovacion'.
--      Si tu comisión se llama distinto, ajusta el nombre en el
--      WHERE de abajo.
--
-- Es idempotente: vuelve a ejecutarlo sin crear duplicados
-- (se salta las iniciativas cuyo `codigo` ya existe en la comisión).
-- Líneas: 'L1 Gestion' -> badge L1, 'L2 Conexion' -> badge L2.
-- El estado "Sin iniciar" lo deriva la UI al no haber tareas todavía.
-- ============================================================

INSERT INTO projects (area_id, name, codigo, linea, owner_name, status)
SELECT a.id, v.name, v.codigo, v.linea, v.owner_name, 'En Progreso'
FROM areas a
CROSS JOIN (VALUES
    ('Programa Gestion Innovacion PYMES CORFO',        'L1-A', 'L1 Gestion',  'Daniel Hayvard'),
    ('Diseno Masterclass Tematicas Especializadas',    'L1-B', 'L1 Gestion',  'Julio Rueda'),
    ('Diseno Sprint / Bootcamp / Emprendeton Academia','L1-C', 'L1 Gestion',  'Eduardo Escalante'),
    ('Ejecucion Diagnostico de Madurez 2026',          'L2-A', 'L2 Conexion', 'Mariana Guerra'),
    ('Diseno Propuesta Summit 2027',                   'L2-B', 'L2 Conexion', 'David Rojas'),
    ('Vinculacion Inter-Comisiones',                   'L2-D', 'L2 Conexion', 'Cristian Campos')
) AS v(name, codigo, linea, owner_name)
WHERE a.name = 'Comision Innovacion'
  AND NOT EXISTS (
      SELECT 1 FROM projects p
      WHERE p.area_id = a.id AND p.codigo = v.codigo
  );

-- Comprobación: lista lo que quedó cargado.
SELECT p.codigo, p.name, p.linea, p.owner_name
FROM projects p
JOIN areas a ON a.id = p.area_id
WHERE a.name = 'Comision Innovacion'
ORDER BY p.codigo;
