-- ============================================================
-- CAPA DE KPIs CALCULADOS (no almacenados) — vistas SQL
--
-- Jerarquía real de la app:
--   Comisión (areas) -> Proyecto (projects) -> Actividad (tasks)
--   (Sin nivel "subcomisión".)
--
-- Principio: los KPIs NO se almacenan, se calculan. El usuario
-- solo edita actividades (status, fechas, responsable). Todo
-- indicador de proyecto y comisión se deriva por consulta, así
-- que cambiar una actividad se refleja en todos los niveles sin
-- recálculo manual.
--
-- Mapeo de campos del spec -> esquema real:
--   actividad.estado      -> tasks.status ('To Do'|'In Progress'|'Complete')
--   actividad.completada  -> tasks.status = 'Complete'
--   actividad.bloqueada   -> tasks.health = 'red' (semáforo)
--   actividad.fecha_limite-> tasks.due_date
--   actividad.responsable -> tasks.assignee_email
--   proyecto.peso         -> projects.peso (alto=3, medio=2, bajo=1)
--
-- Ejecuta TODO este archivo en Supabase -> SQL Editor. Idempotente.
-- Requiere Postgres 15+ (usa security_invoker para respetar el RLS
-- de las tablas base; los proyectos de Supabase recientes ya lo son).
-- ============================================================

-- 0. Columnas base que faltan --------------------------------
-- Peso del proyecto: alto=3, medio=2, bajo=1 (default medio).
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS peso SMALLINT NOT NULL DEFAULT 2;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_peso_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_peso_check CHECK (peso IN (1, 2, 3));

-- Avance esperado opcional (0-100). Si es NULL, esa regla de
-- "en_riesgo" simplemente no se evalúa.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS avance_esperado NUMERIC;

-- 1. Constante reutilizable: ventana de riesgo (en días) -----
-- No se repite el "7" en cada vista; se cambia aquí una vez.
CREATE OR REPLACE FUNCTION public.kpi_risk_days()
RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 7 $$;

-- 2. kpi_proyecto --------------------------------------------
-- avance_pct = completadas / total * 100 (conteo simple).
-- Proyecto sin actividades => avance 0 (sin error de división).
DROP VIEW IF EXISTS public.kpi_proyecto CASCADE;
CREATE VIEW public.kpi_proyecto
WITH (security_invoker = true) AS
WITH agg AS (
    SELECT
        p.id              AS proyecto_id,
        p.area_id         AS comision_id,
        p.name            AS proyecto_nombre,
        p.peso            AS peso,
        p.due_date        AS fecha_limite,
        p.avance_esperado AS avance_esperado,
        COUNT(t.id)                                               AS actividades_total,
        COUNT(t.id) FILTER (WHERE t.status = 'Complete')          AS actividades_completadas,
        COUNT(t.id) FILTER (
            WHERE t.status <> 'Complete'
              AND t.due_date IS NOT NULL
              AND t.due_date < CURRENT_DATE)                      AS actividades_vencidas,
        COUNT(t.id) FILTER (
            WHERE t.assignee_email IS NULL
               OR btrim(t.assignee_email) = '')                   AS actividades_sin_responsable,
        COUNT(t.id) FILTER (WHERE t.health = 'red')               AS actividades_bloqueadas
    FROM public.projects p
    LEFT JOIN public.tasks t ON t.project_id = p.id
    GROUP BY p.id, p.area_id, p.name, p.peso, p.due_date, p.avance_esperado
),
calc AS (
    SELECT
        agg.*,
        CASE WHEN actividades_total = 0 THEN 0
             ELSE ROUND(actividades_completadas::numeric / actividades_total * 100)
        END AS avance_pct
    FROM agg
)
SELECT
    calc.*,
    CASE
        -- Atrasado (vencido y sin terminar) tiene prioridad sobre en_riesgo.
        WHEN fecha_limite IS NOT NULL
             AND fecha_limite < CURRENT_DATE
             AND avance_pct < 100
            THEN 'atrasado'
        WHEN (avance_esperado IS NOT NULL AND avance_pct < avance_esperado)
             OR (fecha_limite IS NOT NULL
                 AND (fecha_limite - CURRENT_DATE) < public.kpi_risk_days()
                 AND avance_pct < 100)
            THEN 'en_riesgo'
        ELSE 'en_plan'
    END AS estado_salud
FROM calc;

-- 3. kpi_comision --------------------------------------------
-- avance_global_pct = promedio del avance de proyectos PONDERADO
-- por el peso del proyecto. Comisión sin proyectos => 0.
DROP VIEW IF EXISTS public.kpi_comision CASCADE;
CREATE VIEW public.kpi_comision
WITH (security_invoker = true) AS
SELECT
    a.id   AS comision_id,
    a.name AS comision_nombre,
    COUNT(kp.proyecto_id)                                       AS proyectos_total,
    COUNT(*) FILTER (WHERE kp.avance_pct = 100)                 AS proyectos_completados,
    COUNT(*) FILTER (WHERE kp.estado_salud = 'en_riesgo')       AS proyectos_en_riesgo,
    COUNT(*) FILTER (WHERE kp.estado_salud = 'atrasado')        AS proyectos_atrasados,
    COALESCE(SUM(kp.actividades_total), 0)                      AS actividades_total,
    COALESCE(SUM(kp.actividades_completadas), 0)                AS actividades_completadas,
    COALESCE(SUM(kp.actividades_vencidas), 0)                   AS actividades_vencidas,
    CASE WHEN COALESCE(SUM(kp.peso), 0) = 0 THEN 0
         ELSE ROUND(SUM(kp.avance_pct * kp.peso)::numeric / SUM(kp.peso))
    END AS avance_global_pct
FROM public.areas a
LEFT JOIN public.kpi_proyecto kp ON kp.comision_id = a.id
GROUP BY a.id, a.name;

-- 4. kpi_carga_responsable -----------------------------------
-- Actividades abiertas (no completadas) por responsable, por comisión.
DROP VIEW IF EXISTS public.kpi_carga_responsable CASCADE;
CREATE VIEW public.kpi_carga_responsable
WITH (security_invoker = true) AS
SELECT
    p.area_id          AS comision_id,
    t.assignee_email   AS responsable_email,
    COUNT(*)           AS actividades_abiertas,
    COUNT(*) FILTER (
        WHERE t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE
    )                  AS actividades_vencidas
FROM public.tasks t
JOIN public.projects p ON p.id = t.project_id
WHERE t.status <> 'Complete'
  AND t.assignee_email IS NOT NULL
  AND btrim(t.assignee_email) <> ''
GROUP BY p.area_id, t.assignee_email;

-- 5. Exponer vía API de Supabase (rol authenticated) ---------
-- Con security_invoker = true se respeta el RLS de areas/projects/
-- tasks: cada usuario solo ve los KPIs de las comisiones a las que
-- pertenece. No se exponen endpoints de escritura: son solo lectura.
GRANT SELECT ON public.kpi_proyecto         TO authenticated;
GRANT SELECT ON public.kpi_comision         TO authenticated;
GRANT SELECT ON public.kpi_carga_responsable TO authenticated;
