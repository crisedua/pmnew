// Reporte de estado de una comisión (área): agrega todas sus iniciativas
// y tareas para responder "¿cómo vamos hoy?".
import { ESTADOS, getInitiativeEstado, taskProgress, getTaskHealth } from './health';

const DAY = 1000 * 60 * 60 * 24;

function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Calcula todas las métricas de la comisión a partir de sus iniciativas.
 * Se usa tanto en la vista en pantalla como en el PDF.
 */
export function buildAreaStats(initiatives = []) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const estadoCounts = { sin_iniciar: 0, en_curso: 0, en_riesgo: 0, bloqueada: 0 };
    const healthCounts = { green: 0, yellow: 0, red: 0 };
    const statusCounts = { 'To Do': 0, 'In Progress': 0, 'On Hold': 0, 'Complete': 0 };
    const porResponsable = new Map();
    const porLinea = new Map();

    let allTasks = [];
    const rows = initiatives.map(it => {
        const tasks = it.tasks || [];
        const estado = getInitiativeEstado(tasks, it);
        estadoCounts[estado] = (estadoCounts[estado] || 0) + 1;

        const linea = it.linea || 'Sin línea';
        if (!porLinea.has(linea)) porLinea.set(linea, { linea, total: 0, done: 0, iniciativas: 0 });
        const lineaBucket = porLinea.get(linea);
        lineaBucket.iniciativas += 1;

        tasks.forEach(t => {
            const enriched = { ...t, initiativeName: it.name, initiativeId: it.id, linea: it.linea };
            allTasks.push(enriched);

            statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
            healthCounts[getTaskHealth(t)] += 1;

            lineaBucket.total += 1;
            if (t.status === 'Complete') lineaBucket.done += 1;

            if (t.status !== 'Complete') {
                const who = t.assignee_name || t.assignee_email || 'Sin responsable';
                if (!porResponsable.has(who)) porResponsable.set(who, { who, abiertas: 0, bloqueadas: 0, atrasadas: 0 });
                const b = porResponsable.get(who);
                b.abiertas += 1;
                if (getTaskHealth(t) === 'red') b.bloqueadas += 1;
                if (t.due_date && new Date(t.due_date) < today) b.atrasadas += 1;
            }
        });

        return {
            ...it,
            tasks,
            estado,
            progress: taskProgress(tasks),
            pendientes: tasks.filter(t => t.status !== 'Complete').length,
            bloqueadas: tasks.filter(t => getTaskHealth(t) === 'red').length,
        };
    });

    const totalTasks = allTasks.length;
    const doneTasks = allTasks.filter(t => t.status === 'Complete').length;
    const avance = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const abiertas = allTasks.filter(t => t.status !== 'Complete');

    // Requieren atención: bloqueadas primero, luego atrasadas, luego estancadas.
    const bloqueadas = abiertas.filter(t => getTaskHealth(t) === 'red');
    const atrasadas = abiertas.filter(t => t.due_date && new Date(t.due_date) < today && getTaskHealth(t) !== 'red');
    const estancadas = abiertas.filter(t => getTaskHealth(t) === 'yellow' && !bloqueadas.includes(t) && !atrasadas.includes(t));

    // Próximos 14 días.
    const proximos = abiertas
        .filter(t => {
            if (!t.due_date) return false;
            const d = new Date(t.due_date);
            return d >= today && (d - today) <= 14 * DAY;
        })
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

    const sinResponsable = abiertas.filter(t => !t.assignee_name && !t.assignee_email);

    return {
        rows,
        totalIniciativas: initiatives.length,
        estadoCounts,
        healthCounts,
        statusCounts,
        totalTasks,
        doneTasks,
        avance,
        abiertas,
        bloqueadas,
        atrasadas,
        estancadas,
        proximos,
        sinResponsable,
        responsables: [...porResponsable.values()].sort((a, b) => b.abiertas - a.abiertas),
        lineas: [...porLinea.values()].sort((a, b) => b.total - a.total),
    };
}

export function buildAreaReportHtml({ area, initiatives = [], summary = [] }) {
    const s = buildAreaStats(initiatives);
    const now = new Date();
    const generado = now.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
        + ' · ' + now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    const tile = (label, value, color) => `
        <div class="stat"><div class="stat-value" style="color:${color}">${value}</div><div class="stat-label">${esc(label)}</div></div>`;

    const estadoRow = Object.values(ESTADOS).map(e =>
        `<div class="legend-item"><span class="dot" style="background:${e.color}"></span>${esc(e.label)}<strong>${s.estadoCounts[e.key] || 0}</strong></div>`
    ).join('');

    const initiativeRows = s.rows
        .slice()
        .sort((a, b) => a.progress - b.progress)
        .map(r => `<tr>
            <td class="t-title">${esc(r.name)}</td>
            <td>${esc(r.codigo || '—')}</td>
            <td>${esc(r.owner_name || r.owner_email || '—')}</td>
            <td><span class="dot" style="background:${ESTADOS[r.estado].color}"></span>${esc(ESTADOS[r.estado].label)}</td>
            <td>${r.pendientes}</td>
            <td>
                <div class="mini-bar"><span style="width:${r.progress}%"></span></div>
                <span class="mini-pct">${r.progress}%</span>
            </td>
        </tr>`).join('');

    const responsableRows = s.responsables.map(r => `<tr>
        <td class="t-title">${esc(r.who)}</td>
        <td>${r.abiertas}</td>
        <td class="${r.bloqueadas ? 'danger' : ''}">${r.bloqueadas}</td>
        <td class="${r.atrasadas ? 'danger' : ''}">${r.atrasadas}</td>
    </tr>`).join('');

    const lineaRows = s.lineas.map(l => {
        const pct = l.total ? Math.round((l.done / l.total) * 100) : 0;
        return `<tr>
            <td class="t-title">${esc(l.linea)}</td>
            <td>${l.iniciativas}</td>
            <td>${l.total}</td>
            <td><div class="mini-bar"><span style="width:${pct}%"></span></div><span class="mini-pct">${pct}%</span></td>
        </tr>`;
    }).join('');

    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" />
<title>Reporte de estado — ${esc(area?.name || 'Comisión')}</title>
<style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #16243a; background: #fff; font-size: 11.5px; line-height: 1.5; }
    @page { size: A4; margin: 13mm; }
    .doc { max-width: 800px; margin: 0 auto; }

    header.cover { background: linear-gradient(135deg, #24528f 0%, #16345f 100%); color: #fff; border-radius: 14px; padding: 22px 24px; margin-bottom: 20px; }
    .brand { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.8; font-weight: 700; }
    .cover h1 { margin: 8px 0 12px; font-size: 22px; line-height: 1.2; }
    .cover-meta { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.25); border-radius: 999px; padding: 4px 12px; font-size: 10.5px; font-weight: 600; }
    .cover-gen { margin-top: 12px; font-size: 10.5px; opacity: 0.8; }

    section { margin-bottom: 20px; page-break-inside: avoid; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #24528f; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e6ecf5; display: flex; justify-content: space-between; }
    h2 .count { color: #94a3b8; font-weight: 700; }

    .stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px; }
    .stat { background: #f6f8fc; border: 1px solid #e6ecf5; border-radius: 10px; padding: 10px 6px; text-align: center; }
    .stat-value { font-size: 20px; font-weight: 800; line-height: 1; }
    .stat-label { font-size: 9px; color: #64748b; margin-top: 4px; font-weight: 700; text-transform: uppercase; }

    .progress-head { display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: 700; }
    .bar { height: 10px; background: #eef2f8; border-radius: 999px; overflow: hidden; }
    .bar > span { display: block; height: 100%; background: linear-gradient(90deg, #22c55e, #16a34a); }

    .legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; }
    .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #47566b; }
    .legend-item strong { color: #16243a; }

    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead th { text-align: left; background: #f6f8fc; color: #47566b; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; padding: 7px 9px; border-bottom: 2px solid #e6ecf5; }
    tbody td { padding: 7px 9px; border-bottom: 1px solid #f0f3f8; vertical-align: middle; }
    tbody tr { page-break-inside: avoid; }
    .t-title { font-weight: 600; color: #16243a; }
    .t-sub { color: #64748b; }
    td.danger { color: #dc2626; font-weight: 700; }
    .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 5px; }

    .mini-bar { display: inline-block; width: 70px; height: 6px; background: #eef2f8; border-radius: 999px; overflow: hidden; vertical-align: middle; margin-right: 6px; }
    .mini-bar > span { display: block; height: 100%; background: #22c55e; }
    .mini-pct { font-size: 10px; color: #64748b; font-weight: 600; }

    .ai { background: #f6f9fd; border: 1px solid #e0e9f6; border-left: 3px solid #24528f; border-radius: 10px; padding: 14px 16px; }
    .ai h2 { border-bottom: none; margin-bottom: 6px; padding-bottom: 0; }
    .bullets { margin: 0; padding-left: 18px; }
    .bullets li { margin-bottom: 6px; color: #26374f; font-size: 11.5px; line-height: 1.5; }
    .bullets li:last-child { margin-bottom: 0; }

    .muted { color: #94a3b8; font-style: italic; }
    footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e6ecf5; font-size: 9.5px; color: #94a3b8; display: flex; justify-content: space-between; }

    .print-bar { position: fixed; top: 12px; right: 12px; z-index: 10; }
    .print-bar button {
        font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
        background: #24528f; color: #fff; border: none;
        border-radius: 8px; padding: 8px 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    @media print { .print-bar { display: none !important; } }
</style></head>
<body>
<div class="print-bar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
<div class="doc">
    <header class="cover">
        <div class="brand">ASIVA · Reporte de estado</div>
        <h1>${esc(area?.name || 'Comisión')}</h1>
        <div class="cover-meta">
            <span class="chip">${s.totalIniciativas} iniciativas</span>
            <span class="chip">${s.totalTasks} tareas</span>
            <span class="chip">${s.avance}% completado</span>
            <span class="chip">${s.bloqueadas.length} bloqueadas</span>
        </div>
        <div class="cover-gen">Generado el ${esc(generado)}</div>
    </header>

    <section>
        <h2>Resumen</h2>
        <div class="stats">
            ${tile('Iniciativas', s.totalIniciativas, '#24528f')}
            ${tile('Tareas', s.totalTasks, '#24528f')}
            ${tile('Completadas', s.doneTasks, '#16a34a')}
            ${tile('Abiertas', s.abiertas.length, '#64748b')}
            ${tile('Bloqueadas', s.bloqueadas.length, '#dc2626')}
            ${tile('Atrasadas', s.atrasadas.length, '#d97706')}
        </div>
        <div class="progress-head"><span>Avance global</span><span>${s.avance}%</span></div>
        <div class="bar"><span style="width:${s.avance}%"></span></div>
        <div class="legend">${estadoRow}</div>
    </section>

    ${summary.length ? `<section class="ai">
        <h2>Resumen ejecutivo</h2>
        <ul class="bullets">${summary.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
    </section>` : ''}

    <section>
        <h2>Iniciativas <span class="count">${s.rows.length}</span></h2>
        ${s.rows.length ? `<table>
            <thead><tr><th>Iniciativa</th><th>Código</th><th>Owner</th><th>Estado</th><th>Pend.</th><th>Avance</th></tr></thead>
            <tbody>${initiativeRows}</tbody>
        </table>` : '<p class="muted">Esta comisión aún no tiene iniciativas.</p>'}
    </section>

    <section>
        <h2>Carga por responsable</h2>
        ${s.responsables.length ? `<table>
            <thead><tr><th>Responsable</th><th>Abiertas</th><th>Bloqueadas</th><th>Atrasadas</th></tr></thead>
            <tbody>${responsableRows}</tbody>
        </table>` : '<p class="muted">Sin tareas abiertas.</p>'}
    </section>

    <section>
        <h2>Por línea</h2>
        ${s.lineas.length ? `<table>
            <thead><tr><th>Línea</th><th>Iniciativas</th><th>Tareas</th><th>Avance</th></tr></thead>
            <tbody>${lineaRows}</tbody>
        </table>` : '<p class="muted">Sin datos por línea.</p>'}
    </section>

    <footer>
        <span>${esc(area?.name || 'Comisión')} · Reporte de estado</span>
        <span>Generado el ${esc(generado)}</span>
    </footer>
</div>
<script>
    // Se imprime a sí mismo para no bloquear el hilo de la aplicación.
    window.addEventListener('load', function () {
        setTimeout(function () { window.print(); }, 300);
    });
</script>
</body></html>`;
}

/** Abre el reporte de la comisión e invoca el diálogo de impresión (Guardar como PDF). */
export function exportAreaPdf(data) {
    const html = buildAreaReportHtml(data);
    const win = window.open('', '_blank');
    if (!win) {
        alert('Habilita las ventanas emergentes para exportar el PDF.');
        return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    // El propio documento se imprime; no llamamos win.print() desde aquí porque
    // print() es síncrono y bloquearía el hilo principal de la aplicación.
}
