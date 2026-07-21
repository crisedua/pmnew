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

/** Contexto compacto de la iniciativa para el modelo. */
export function buildProjectSummaryContext({ project, tasks = [], assignees = [] }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const abiertas = tasks.filter(t => t.status !== 'Complete');
    const hechas = tasks.filter(t => t.status === 'Complete');

    const lines = [];
    lines.push(`Iniciativa: ${project.name}`);
    lines.push(`Código: ${project.codigo || 's/código'} · Línea: ${project.linea || 'sin línea'}`);
    lines.push(`Owner: ${project.owner_name || project.owner_email || 'sin owner'}`);
    if (project.start_date) lines.push(`Inicio: ${project.start_date}`);
    if (project.due_date) lines.push(`Cierre estimado: ${project.due_date}`);
    if (assignees.length) lines.push(`Equipo: ${assignees.map(a => a.name || a.email).join(', ')}`);
    if (project.description) lines.push(`Descripción: ${clip(project.description, 600)}`);
    lines.push(
        `Avance: ${taskProgress(tasks)}% (${hechas.length} de ${tasks.length} tareas completadas, ` +
        `${abiertas.length} abiertas).`
    );
    lines.push('');

    if (abiertas.length) {
        lines.push('Tareas abiertas:');
        abiertas.forEach(t => {
            const h = getTaskHealth(t);
            const flags = [];
            if (h === 'red') flags.push('BLOQUEADA');
            if (h === 'yellow') flags.push('sin avance reciente');
            if (t.due_date && new Date(t.due_date) < today) flags.push('ATRASADA');
            if (!t.assignee_name && !t.assignee_email) flags.push('sin responsable');
            lines.push(
                `- ${clip(t.title, 120)} (${STATUS_LABEL[t.status] || t.status}` +
                `${t.assignee_name || t.assignee_email ? `, resp. ${t.assignee_name || t.assignee_email}` : ''}` +
                `${t.due_date ? `, vence ${t.due_date}` : ''}` +
                `${flags.length ? `, ${flags.join(', ')}` : ''})` +
                `${t.health_note ? ` — nota: ${clip(t.health_note, 120)}` : ''}`
            );
        });
    } else {
        lines.push('Tareas abiertas: ninguna.');
    }

    if (hechas.length) {
        lines.push('');
        lines.push(`Tareas completadas (${hechas.length}): ${hechas.map(t => clip(t.title, 80)).join('; ')}`);
    }

    return lines.join('\n');
}

const SYSTEM_PROMPT = `Eres un analista de proyectos que redacta el estado de una iniciativa en español para un reporte ejecutivo.

A partir de la descripción de la iniciativa y sus tareas, escribe en VIÑETAS qué está pasando ahora.

Reglas estrictas:
- Entre 4 y 6 viñetas. Cada una de máximo 25 palabras.
- NO enumeres las tareas una por una. Sintetiza y agrupa por tema o frente de trabajo.
- Tono ejecutivo y directo, en presente. Sin relleno ni recomendaciones genéricas.
- Prioriza: en qué va la iniciativa, qué frentes avanzan, qué está detenido o atrasado y por qué, qué vence pronto, qué falta definir.
- Menciona personas solo cuando aporte (por ejemplo, si concentran el trabajo o hay algo sin responsable).
- No inventes nada que no esté en los datos.
- Devuelve SOLO las viñetas, una por línea, empezando con "- ". Sin título ni cierre.`;

/** Devuelve un array de viñetas con el estado actual de la iniciativa. */
export async function generateProjectSummary({ project, tasks, assignees }) {
    const context = buildProjectSummaryContext({ project, tasks, assignees });

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
