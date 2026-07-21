// Resumen ejecutivo generado con IA para una iniciativa concreta,
// a partir de su descripción y del estado de sus tareas.
import { callOpenAI } from './openai';
import { getTaskHealth, taskProgress } from './health';

const STATUS_LABEL = {
    'To Do': 'por hacer',
    'In Progress': 'en progreso',
    'On Hold': 'en espera',
    'Complete': 'completada',
};

const clip = (text, max) => {
    if (!text) return '';
    const t = String(text).replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max)}…` : t;
};

/**
 * Contexto para el modelo. Solo incluye las tareas ABIERTAS
 * (por hacer / en progreso / en espera): el resumen debe describir
 * el trabajo vivo, no lo ya completado.
 */
export function buildProjectSummaryContext({ project, tasks = [] }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const abiertas = tasks.filter(t => t.status !== 'Complete');

    const lines = [];
    lines.push(`Iniciativa: ${project.name}`);
    lines.push(`Tareas abiertas: ${abiertas.length} de ${tasks.length}.`);
    lines.push('');

    if (!abiertas.length) {
        lines.push('No hay tareas abiertas.');
        return lines.join('\n');
    }

    lines.push('TAREAS ABIERTAS (única fuente para el resumen):');
    abiertas.forEach((t, i) => {
        const h = getTaskHealth(t);
        const flags = [];
        if (h === 'red') flags.push('BLOQUEADA');
        if (h === 'yellow') flags.push('sin avance en 2+ semanas');
        if (t.due_date && new Date(t.due_date) < today) flags.push('ATRASADA');
        if (!t.assignee_name && !t.assignee_email) flags.push('SIN RESPONSABLE');

        lines.push(
            `${i + 1}. [PENDIENTE — todavía NO ocurrió] "${clip(t.title, 200)}"` +
            ` | estado: ${STATUS_LABEL[t.status] || t.status}` +
            ` | responsable: ${t.assignee_name || t.assignee_email || 'ninguno'}` +
            ` | prioridad: ${t.priority || 'no definida'}` +
            ` | vence: ${t.due_date || 'sin fecha'}` +
            (flags.length ? ` | ALERTAS: ${flags.join(', ')}` : '')
        );
        if (t.description) lines.push(`   detalle: ${clip(t.description, 300)}`);
        if (t.health_note) lines.push(`   nota de estado: ${clip(t.health_note, 200)}`);
    });

    return lines.join('\n');
}

const SYSTEM_PROMPT = `Eres un analista de proyectos que redacta el estado de una iniciativa en español para un reporte ejecutivo.

Se te entrega ÚNICAMENTE la lista de tareas abiertas (por hacer, en progreso y en espera).
Escribe en VIÑETAS, con detalle concreto, qué está pasando con ese trabajo.

Reglas estrictas:
- Entre 6 y 10 viñetas. Cada una de máximo 35 palabras.
- Usa EXCLUSIVAMENTE la información de esas tareas. No hables del avance porcentual,
  ni de tareas completadas, ni de la descripción general de la iniciativa.
- Sé específico: nombra el trabajo concreto, quién es el responsable y la fecha comprometida
  cuando exista. Ese detalle es lo que se espera del reporte.
- Agrupa tareas relacionadas en un mismo frente de trabajo cuando compartan tema
  (por ejemplo, convocatoria, sede, coordinación con universidades), pero sin perder el detalle.
- Marca explícitamente lo que está BLOQUEADO, ATRASADO, SIN RESPONSABLE o sin fecha definida.
- Tono ejecutivo y directo. Sin relleno ni recomendaciones genéricas.
- No inventes nada: si un dato no está en la tarea, no lo afirmes.

REGLA CRÍTICA — TODAS estas tareas están ABIERTAS, es decir PENDIENTES.
Nunca las describas como hechas, logradas, confirmadas ni cerradas.
Conserva siempre el carácter pendiente de la acción:
- "por hacer" = todavía no empieza. Usa "queda pendiente", "aún debe", "está por".
- "en progreso" = en curso, sin terminar. Usa "está gestionando", "se encuentra en curso".
- "en espera" = detenida a la espera de algo. Usa "está detenida a la espera de".

Ejemplo de lo que NO debes hacer:
  Tarea: "Felipe Cruz va a confirmar uso de sala Mutual de Seguros"
  INCORRECTO: "Felipe Cruz confirma el uso de la sala Mutual de Seguros." (afirma que ya ocurrió)
  CORRECTO: "Felipe Cruz aún debe confirmar el uso de la sala Mutual de Seguros."

- Devuelve SOLO las viñetas, una por línea, empezando con "- ". Sin título ni cierre.`;

/**
 * Resumen calculado sin IA. Se usa como respaldo cuando /api/chat no está
 * disponible, para que el reporte nunca salga vacío.
 */
export function buildFallbackSummary({ tasks = [] }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const abiertas = tasks.filter(t => t.status !== 'Complete');
    const hechas = tasks.filter(t => t.status === 'Complete');
    const enProgreso = tasks.filter(t => t.status === 'In Progress').length;
    const enEspera = tasks.filter(t => t.status === 'On Hold').length;
    const porHacer = tasks.filter(t => t.status === 'To Do').length;
    const bloqueadas = abiertas.filter(t => getTaskHealth(t) === 'red');
    const atrasadas = abiertas.filter(t => t.due_date && new Date(t.due_date) < today);
    const estancadas = abiertas.filter(t => getTaskHealth(t) === 'yellow');
    const sinResp = abiertas.filter(t => !t.assignee_name && !t.assignee_email);

    const bullets = [];
    bullets.push(`Avance ${taskProgress(tasks)}%: ${hechas.length} de ${tasks.length} tareas completadas.`);
    if (abiertas.length) {
        bullets.push(
            `${abiertas.length} tareas abiertas: ${enProgreso} en progreso, ` +
            `${porHacer} por hacer, ${enEspera} en espera.`
        );
    }
    if (bloqueadas.length) bullets.push(`${bloqueadas.length} tarea(s) bloqueada(s) requieren decisión.`);
    if (atrasadas.length) bullets.push(`${atrasadas.length} tarea(s) pasaron su fecha de vencimiento.`);
    if (estancadas.length) bullets.push(`${estancadas.length} tarea(s) sin avance en las últimas dos semanas.`);
    if (sinResp.length) bullets.push(`${sinResp.length} tarea(s) abierta(s) sin responsable asignado.`);

    const proximas = abiertas
        .filter(t => t.due_date && new Date(t.due_date) >= today)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    if (proximas.length) {
        const p = proximas[0];
        bullets.push(`Próximo vencimiento: ${clip(p.title, 70)} (${p.due_date}).`);
    }

    return bullets;
}

/** Devuelve un array de viñetas con el estado actual de la iniciativa. */
export async function generateProjectSummary({ project, tasks }) {
    const context = buildProjectSummaryContext({ project, tasks });

    const message = await callOpenAI([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: context },
    ]);

    const text = message?.content || '';
    const bullets = text
        .split('\n')
        .map(l => l.replace(/^\s*[-*•]\s*/, '').trim())
        .filter(Boolean);

    return bullets.length ? bullets : [text.trim()].filter(Boolean);
}
