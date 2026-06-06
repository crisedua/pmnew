-- ============================================================
-- OKR / Gestión de Comisión - Capa de KPIs, Semáforo y Trazabilidad
-- Run this entire file in your Supabase SQL Editor
--
-- Mapeo: Comisión = area, Iniciativa = project, Tarea = task
-- ============================================================

-- ------------------------------------------------------------
-- 1. AREA KPIs (KPIs generales editables de la comisión)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS area_kpis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    area_id UUID REFERENCES areas(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(20) DEFAULT 'número', -- 'número' | '%' | 'moneda'
    baseline_value NUMERIC DEFAULT 0,
    current_value NUMERIC DEFAULT 0,
    target_value NUMERIC DEFAULT 0,
    due_date DATE,
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS area_kpis_area_id_idx ON area_kpis(area_id);

ALTER TABLE area_kpis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Area members can view KPIs" ON area_kpis;
DROP POLICY IF EXISTS "Area owners/editors can insert KPIs" ON area_kpis;
DROP POLICY IF EXISTS "Area owners/editors can update KPIs" ON area_kpis;
DROP POLICY IF EXISTS "Area owners/editors can delete KPIs" ON area_kpis;

-- Cualquier miembro del área (incluido viewer) puede VER los KPIs
CREATE POLICY "Area members can view KPIs"
ON area_kpis FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM area_members am
        WHERE am.area_id = area_kpis.area_id
        AND am.user_id = auth.uid()
    )
);

-- Solo owner/editor del área puede CREAR / EDITAR / BORRAR KPIs
CREATE POLICY "Area owners/editors can insert KPIs"
ON area_kpis FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM area_members am
        WHERE am.area_id = area_kpis.area_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'editor')
    )
);

CREATE POLICY "Area owners/editors can update KPIs"
ON area_kpis FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM area_members am
        WHERE am.area_id = area_kpis.area_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'editor')
    )
);

CREATE POLICY "Area owners/editors can delete KPIs"
ON area_kpis FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM area_members am
        WHERE am.area_id = area_kpis.area_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'editor')
    )
);

-- ------------------------------------------------------------
-- 2. PROJECTS - datos de contacto del owner de la iniciativa
-- ------------------------------------------------------------
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(50);

-- ------------------------------------------------------------
-- 3. TASKS - semáforo (health) + trazabilidad de avance
-- ------------------------------------------------------------
-- health: NULL = automático (calculado en frontend), o 'green'|'yellow'|'red' (override manual)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS health VARCHAR(10);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS health_note TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Inicializa last_progress_at en tareas existentes
UPDATE tasks SET last_progress_at = COALESCE(updated_at, created_at, NOW())
WHERE last_progress_at IS NULL;

-- ------------------------------------------------------------
-- 4. TASK COMMENTS (comentarios / notas de seguimiento)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_comments_task_id_idx ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS task_comments_created_at_idx ON task_comments(created_at DESC);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Area members can view task comments" ON task_comments;
DROP POLICY IF EXISTS "Area members can create task comments" ON task_comments;
DROP POLICY IF EXISTS "Users can update their own task comments" ON task_comments;
DROP POLICY IF EXISTS "Users can delete their own task comments" ON task_comments;

-- Ver: cualquier miembro del área (incluido viewer)
CREATE POLICY "Area members can view task comments"
ON task_comments FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM tasks t
        JOIN projects p ON t.project_id = p.id
        JOIN area_members am ON p.area_id = am.area_id
        WHERE t.id = task_comments.task_id
        AND am.user_id = auth.uid()
    )
);

-- Comentar: cualquier miembro del área (incluido viewer)
CREATE POLICY "Area members can create task comments"
ON task_comments FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM tasks t
        JOIN projects p ON t.project_id = p.id
        JOIN area_members am ON p.area_id = am.area_id
        WHERE t.id = task_comments.task_id
        AND am.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own task comments"
ON task_comments FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own task comments"
ON task_comments FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- 5. TASK ACTIVITY (trazabilidad automática de cambios)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_activity (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    type VARCHAR(30) NOT NULL, -- 'status_change' | 'health_change' | 'created'
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_activity_task_id_idx ON task_activity(task_id);
CREATE INDEX IF NOT EXISTS task_activity_project_id_idx ON task_activity(project_id);
CREATE INDEX IF NOT EXISTS task_activity_created_at_idx ON task_activity(created_at DESC);

ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Area members can view task activity" ON task_activity;
DROP POLICY IF EXISTS "Area members can insert task activity" ON task_activity;

-- Ver: cualquier miembro del área (incluido viewer)
CREATE POLICY "Area members can view task activity"
ON task_activity FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM tasks t
        JOIN projects p ON t.project_id = p.id
        JOIN area_members am ON p.area_id = am.area_id
        WHERE t.id = task_activity.task_id
        AND am.user_id = auth.uid()
    )
);

-- Insert directo permitido a miembros (el trigger también escribe con SECURITY DEFINER)
CREATE POLICY "Area members can insert task activity"
ON task_activity FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM tasks t
        JOIN projects p ON t.project_id = p.id
        JOIN area_members am ON p.area_id = am.area_id
        WHERE t.id = task_activity.task_id
        AND am.user_id = auth.uid()
    )
);

-- ------------------------------------------------------------
-- 6. TRIGGER: registra avance y trazabilidad al actualizar una tarea
--    - Actualiza last_progress_at cuando cambia el status
--    - Inserta filas en task_activity para status y health
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_task_progress()
RETURNS trigger AS $$
BEGIN
    -- Cambio de estado => cuenta como avance + trazabilidad
    IF (NEW.status IS DISTINCT FROM OLD.status) THEN
        NEW.last_progress_at := NOW();
        INSERT INTO public.task_activity (task_id, project_id, user_id, type, old_value, new_value)
        VALUES (NEW.id, NEW.project_id, auth.uid(), 'status_change', OLD.status, NEW.status);
    END IF;

    -- Cambio de semáforo manual => trazabilidad
    IF (NEW.health IS DISTINCT FROM OLD.health) THEN
        INSERT INTO public.task_activity (task_id, project_id, user_id, type, old_value, new_value)
        VALUES (NEW.id, NEW.project_id, auth.uid(), 'health_change', OLD.health, NEW.health);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_task_progress ON tasks;
CREATE TRIGGER on_task_progress
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE PROCEDURE public.handle_task_progress();

-- Registro de creación de tarea (trazabilidad inicial)
CREATE OR REPLACE FUNCTION public.handle_task_created()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.task_activity (task_id, project_id, user_id, type, new_value)
    VALUES (NEW.id, NEW.project_id, auth.uid(), 'created', NEW.status);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_task_created ON tasks;
CREATE TRIGGER on_task_created
    AFTER INSERT ON tasks
    FOR EACH ROW EXECUTE PROCEDURE public.handle_task_created();
