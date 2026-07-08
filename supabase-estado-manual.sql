-- Estado manual de una iniciativa (override del estado calculado por tareas).
-- Valores válidos: 'sin_iniciar' | 'en_curso' | 'en_riesgo' | 'bloqueada'.
-- NULL = automático (se calcula según el avance de las tareas).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS estado_manual VARCHAR(20);

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_estado_manual_check;
ALTER TABLE projects ADD CONSTRAINT projects_estado_manual_check
    CHECK (estado_manual IS NULL OR estado_manual IN ('sin_iniciar', 'en_curso', 'en_riesgo', 'bloqueada'));
