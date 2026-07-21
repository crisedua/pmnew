// Resumen ejecutivo generado con IA a partir de las tareas pendientes
// y en progreso de una comisión. Devuelve viñetas cortas, sin detalle.
import { callOpenAI } from './openai';
import { getTaskHealth } from './health';
import { ESTADOS } from './health';

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
 * Arma un contexto compacto para el modelo: descripción de cada iniciativa
 * y sus tareas abiertas (pendientes / en progreso / en espera).
 */
export function buildSummaryContext({ area, initiatives = [], stats }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lines = [];
    lines.push(`Comisión: ${area?.name || 'Sin nombre'}`);
    lines.push(
        `Totales: ${stats.totalIniciativas} iniciativas, ${stats.totalTasks} tareas, ` +
        `${stats.avance}% de avance global, ${stats.bloqueadas.length} bloqueadas, ` +
        `${stats.atrasadas.length} atrasadas, ${stats.sinResponsable.length} sin responsable.`
    );
    lines.push('');

    initiatives.forEach(it => {
        const row = stats.rows.find(r => r.id === it.id);
        const estado = row ? (ESTADOS[row.estado]?.label || row.estado) : '—';
        const abiertas = (it.tasks || []).filter(t => t.status !== 'Complete');

        lines.push(`## ${it.name} [${it.codigo || 's/código'} · ${it.linea || 'sin línea'}]`);
        lines.push(`Estado: ${estado}. Avance: ${row?.progress ?? 0}%. Owner: ${it.owner_name || it.owner_email || 'sin owner'}.`);
        if (it.description) lines.push(`Descripción: ${clip(it.description, 400)}`);

        if (abiertas.length === 0) {
            lines.push('Tareas abiertas: ninguna.');
        } else {
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
        }
        lines.push('');
    });

    return lines.join('\n');
}

const SYSTEM_PROMPT = `Eres un analista de proyectos que redacta reportes ejecutivos en español para el directorio de una comisión.

A partir del estado de las iniciativas y sus tareas abiertas, escribe un resumen en VIÑETAS de qué está pasando ahora.

Reglas estrictas:
- Entre 5 y 8 viñetas. Cada una de máximo 25 palabras.
- NO enumeres tareas una por una. Sintetiza y agrupa: temas, patrones, avances y riesgos.
- Escribe en tono ejecutivo y directo. Nada de relleno ni recomendaciones genéricas.
- CRÍTICO: las tareas listadas están ABIERTAS (pendientes). Nunca las describas como
  hechas, confirmadas o cerradas. Ejemplo: si la tarea dice "va a confirmar la sede",
  escribe "aún debe confirmar la sede", NO "confirma la sede".
- CRÍTICO: "resp." indica sólo a quién está asignada la tarea, no necesariamente quién
  ejecuta la acción del título (puede ser la contraparte o quien hace seguimiento).
  No le atribuyas acciones, omisiones ni estados que la tarea no diga literalmente,
  ni inventes causas ("ya que...", "debido a..."). Repite la situación tal como está escrita.
- Prioriza: qué avanza, qué está detenido y por qué, qué decisión se necesita, qué vence pronto, dónde falta responsable.
- Menciona nombres de iniciativas o personas solo cuando aporte (máximo lo justo).
- Si algo no se puede afirmar con los datos, no lo inventes.
- Devuelve SOLO las viñetas, una por línea, empezando con "- ". Sin título, sin cierre, sin markdown adicional.`;

/** Devuelve un array de viñetas (strings) con el resumen ejecutivo. */
export async function generateAreaSummary({ area, initiatives, stats }) {
    const context = buildSummaryContext({ area, initiatives, stats });

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
