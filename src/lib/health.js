// OKR / semáforo helpers
// Mapeo: Comisión = area, Iniciativa = project, Tarea = task
import { supabase } from './supabase';

// Umbral de inactividad para pasar a amarillo (2 semanas)
export const STALE_DAYS = 14;

export const HEALTH = {
    green: { key: 'green', label: 'En curso', color: '#22c55e', emoji: '🟢' },
    yellow: { key: 'yellow', label: 'Advertencia', color: '#f59e0b', emoji: '🟡' },
    red: { key: 'red', label: 'Bloqueada', color: '#ef4444', emoji: '🔴' },
};

const daysSince = (dateStr) => {
    if (!dateStr) return Infinity;
    const then = new Date(dateStr).getTime();
    if (Number.isNaN(then)) return Infinity;
    return (Date.now() - then) / (1000 * 60 * 60 * 24);
};

/**
 * Devuelve el semáforo de una tarea.
 * 1. health manual ('green'|'yellow'|'red') tiene prioridad.
 * 2. Si está completa -> verde.
 * 3. Si no hay avance en > STALE_DAYS -> amarillo.
 * 4. En otro caso -> verde.
 * (Rojo solo se asigna manualmente: bloqueo/obstáculo.)
 */
export function getTaskHealth(task) {
    if (!task) return HEALTH.green.key;
    if (task.health && HEALTH[task.health]) return task.health;
    if (task.status === 'Complete') return HEALTH.green.key;

    const reference = task.last_progress_at || task.updated_at || task.created_at;
    if (daysSince(reference) > STALE_DAYS) return HEALTH.yellow.key;
    return HEALTH.green.key;
}

/** True si el semáforo fue calculado (no fijado manualmente). */
export function isAutoHealth(task) {
    return !(task && task.health && HEALTH[task.health]);
}

const SEVERITY = { green: 0, yellow: 1, red: 2 };

/** Semáforo agregado de una iniciativa = peor semáforo de sus tareas activas. */
export function getInitiativeHealth(tasks = []) {
    const active = tasks.filter((t) => t.status !== 'Complete');
    if (active.length === 0) return HEALTH.green.key;
    let worst = 'green';
    for (const t of active) {
        const h = getTaskHealth(t);
        if (SEVERITY[h] > SEVERITY[worst]) worst = h;
    }
    return worst;
}

/** Conteo {green, yellow, red} de las tareas. */
export function healthBreakdown(tasks = []) {
    const counts = { green: 0, yellow: 0, red: 0 };
    for (const t of tasks) counts[getTaskHealth(t)] += 1;
    return counts;
}

/** Progreso (% completadas) de un conjunto de tareas. */
export function taskProgress(tasks = []) {
    if (tasks.length === 0) return 0;
    const done = tasks.filter((t) => t.status === 'Complete').length;
    return Math.round((done / tasks.length) * 100);
}

/**
 * Rol del usuario actual en un área ('owner'|'editor'|'viewer'|'member'|null).
 * Se usa para gatear edición vs. solo lectura.
 */
export async function getUserAreaRole(areaId, userId) {
    if (!areaId || !userId) return null;
    const { data, error } = await supabase
        .from('area_members')
        .select('role')
        .eq('area_id', areaId)
        .eq('user_id', userId)
        .maybeSingle();
    if (error || !data) return null;
    return data.role;
}

/** ¿Puede editar (KPIs, semáforo, iniciativas)? owner/editor. */
export function canEdit(role) {
    return role === 'owner' || role === 'editor';
}
