// Genera un resumen imprimible (PDF vía "Guardar como PDF" del navegador)
// de una iniciativa: ficha, avance, equipo y estado actual en viñetas.
import { ESTADOS, getInitiativeEstado, taskProgress, getTaskHealth } from './health';

const STATUS_LABEL = {
    'To Do': 'Por hacer',
    'In Progress': 'En progreso',
    'On Hold': 'En espera',
    'Complete': 'Completada',
};

// Orden de las columnas del tablero, para listar las tareas igual que en la app.
const STATUS_ORDER = { 'To Do': 0, 'In Progress': 1, 'On Hold': 2 };

function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function fmtDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
}

function initials(text) {
    if (!text) return '?';
    const parts = String(text).trim().split(/\s+/);
    const a = parts[0]?.[0] || '';
    const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (a + b).toUpperCase() || '?';
}

export function buildProjectReportHtml({ project, tasks = [], assignees = [] }) {
    const estadoKey = getInitiativeEstado(tasks, project);
    const estado = ESTADOS[estadoKey] || ESTADOS.sin_iniciar;
    const owner = project.owner_name || project.responsible_email || '—';
    const ownerEmail = project.owner_email || project.responsible_email || '';

    const total = tasks.length;
    const completadas = tasks.filter(t => t.status === 'Complete').length;
    const enProgreso = tasks.filter(t => t.status === 'In Progress').length;
    const enEspera = tasks.filter(t => t.status === 'On Hold').length;
    const porHacer = tasks.filter(t => t.status === 'To Do').length;
    const bloqueadas = tasks.filter(t => getTaskHealth(t) === 'red').length;
    const progress = taskProgress(tasks);

    // Tareas abiertas, en el mismo orden que las columnas del tablero.
    const abiertas = tasks
        .filter(t => t.status !== 'Complete')
        .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

    const now = new Date();
    const generado = now.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
        + ' · ' + now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    const codeLine = [project.codigo, project.linea].filter(Boolean).join(' · ');

    const statTile = (label, value, color) => `
        <div class="stat">
            <div class="stat-value" style="color:${color}">${value}</div>
            <div class="stat-label">${esc(label)}</div>
        </div>`;

    const assigneeChips = assignees.length
        ? `<div class="team">${assignees.map(a => `
            <div class="member">
                <span class="avatar">${esc(initials(a.name || a.email))}</span>
                <div class="member-info">
                    <span class="member-name">${esc(a.name || a.email || '—')}</span>
                    ${a.email && a.name ? `<span class="member-email">${esc(a.email)}</span>` : ''}
                </div>
            </div>`).join('')}</div>`
        : `<p class="muted">Sin equipo asignado todavía.</p>`;


    const inicio = fmtDate(project.start_date) || 'Por definir';
    const cierre = fmtDate(project.due_date) || 'Por definir';
    const descripcion = project.description
        ? `<p class="desc">${esc(project.description)}</p>`
        : `<p class="muted">Sin descripción.</p>`;

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Resumen — ${esc(project.name || 'Iniciativa')}</title>
<style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #16243a; background: #fff; font-size: 12px; line-height: 1.55;
    }
    @page { size: A4; margin: 14mm; }

    .doc { max-width: 780px; margin: 0 auto; }

    header.cover {
        background: linear-gradient(135deg, #24528f 0%, #16345f 100%);
        color: #fff; border-radius: 14px; padding: 24px 26px; margin-bottom: 22px;
    }
    .brand { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.8; font-weight: 700; }
    .cover h1 { margin: 8px 0 12px; font-size: 24px; line-height: 1.2; }
    .cover-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .chip {
        display: inline-flex; align-items: center; gap: 6px;
        background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.25);
        border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 600;
    }
    .chip .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .cover-gen { margin-top: 14px; font-size: 11px; opacity: 0.8; }

    section { margin-bottom: 22px; page-break-inside: avoid; }
    h2 {
        font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em;
        color: #24528f; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e6ecf5;
    }

    .ficha { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
    .ficha .row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid #f0f3f8; }
    .ficha .k { color: #64748b; font-weight: 600; }
    .ficha .v { color: #16243a; font-weight: 600; text-align: right; }

    .desc { margin: 0; color: #33445c; white-space: pre-wrap; }

    .progress-wrap { margin-bottom: 14px; }
    .progress-head { display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 700; }
    .bar { height: 10px; background: #eef2f8; border-radius: 999px; overflow: hidden; }
    .bar > span { display: block; height: 100%; background: linear-gradient(90deg, #22c55e, #16a34a); }

    .stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
    .stat { background: #f6f8fc; border: 1px solid #e6ecf5; border-radius: 10px; padding: 12px 8px; text-align: center; }
    .stat-value { font-size: 22px; font-weight: 800; line-height: 1; }
    .stat-label { font-size: 10px; color: #64748b; margin-top: 5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }

    .team { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .member { display: flex; align-items: center; gap: 10px; background: #f6f8fc; border: 1px solid #e6ecf5; border-radius: 10px; padding: 8px 12px; }
    .avatar { width: 30px; height: 30px; border-radius: 50%; background: #24528f; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .member-info { display: flex; flex-direction: column; }
    .member-name { font-weight: 700; }
    .member-email { font-size: 10px; color: #64748b; }

    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead th { text-align: left; background: #f6f8fc; color: #47566b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; padding: 8px 10px; border-bottom: 2px solid #e6ecf5; }
    tbody td { padding: 8px 10px; border-bottom: 1px solid #f0f3f8; vertical-align: middle; }
    tbody tr { page-break-inside: avoid; }
    .t-title { font-weight: 600; color: #16243a; }
    .t-title.done { color: #64748b; text-decoration: line-through; }
    td .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }

    .pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 10px; font-weight: 700; }
    .pill.status.to-do { background: #eef2f8; color: #64748b; }
    .pill.status.in-progress { background: #dbeafe; color: #1d4ed8; }
    .pill.status.on-hold { background: #ede9fe; color: #7c3aed; }
    .pill.status.complete { background: #dcfce7; color: #15803d; }

    h2 .count { color: #94a3b8; font-weight: 700; }
    .col-estado { width: 120px; }

    .muted { color: #94a3b8; font-style: italic; margin: 4px 0; }

    footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #e6ecf5; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }

    /* Botón de respaldo por si el diálogo de impresión no se abre solo */
    .print-bar { position: fixed; top: 12px; right: 12px; z-index: 10; }
    .print-bar button {
        font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
        background: #24528f; color: #fff; border: none;
        border-radius: 8px; padding: 8px 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    @media print { .print-bar { display: none !important; } }
</style>
</head>
<body>
<div class="print-bar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
<div class="doc">
    <header class="cover">
        <div class="brand">ASIVA · Resumen de iniciativa</div>
        <h1>${esc(project.name || 'Iniciativa')}</h1>
        <div class="cover-meta">
            ${codeLine ? `<span class="chip">${esc(codeLine)}</span>` : ''}
            <span class="chip"><span class="dot" style="background:${estado.color}"></span>${esc(estado.label)}</span>
            <span class="chip">${progress}% completado</span>
        </div>
        <div class="cover-gen">Generado el ${esc(generado)}</div>
    </header>

    <section>
        <h2>Ficha</h2>
        <div class="ficha">
            <div class="row"><span class="k">Owner</span><span class="v">${esc(owner)}${ownerEmail ? ` · ${esc(ownerEmail)}` : ''}</span></div>
            <div class="row"><span class="k">Línea</span><span class="v">${esc(project.linea || '—')}</span></div>
            <div class="row"><span class="k">Estado</span><span class="v">${esc(estado.label)}</span></div>
            <div class="row"><span class="k">Código</span><span class="v">${esc(project.codigo || '—')}</span></div>
            <div class="row"><span class="k">Inicio</span><span class="v">${esc(inicio)}</span></div>
            <div class="row"><span class="k">Cierre est.</span><span class="v">${esc(cierre)}</span></div>
        </div>
    </section>

    <section>
        <h2>Descripción</h2>
        ${descripcion}
    </section>

    <section>
        <h2>Avance</h2>
        <div class="progress-wrap">
            <div class="progress-head"><span>Progreso general</span><span>${progress}%</span></div>
            <div class="bar"><span style="width:${progress}%"></span></div>
        </div>
        <div class="stats">
            ${statTile('Total', total, '#24528f')}
            ${statTile('Completadas', completadas, '#16a34a')}
            ${statTile('En progreso', enProgreso, '#1d4ed8')}
            ${statTile('En espera', enEspera, '#7c3aed')}
            ${statTile('Por hacer', porHacer, '#64748b')}
            ${statTile('Bloqueadas', bloqueadas, '#dc2626')}
        </div>
    </section>

    <section>
        <h2>Equipo</h2>
        ${assigneeChips}
    </section>

    <section>
        <h2>Tareas pendientes y en progreso <span class="count">${abiertas.length}</span></h2>
        ${abiertas.length ? `<table>
            <thead><tr><th>Tarea</th><th class="col-estado">Estado</th></tr></thead>
            <tbody>${abiertas.map(t => `<tr>
                <td class="t-title">${esc(t.title || 'Sin título')}</td>
                <td class="col-estado"><span class="pill status ${esc((t.status || '').replace(/\s+/g, '-').toLowerCase())}">${esc(STATUS_LABEL[t.status] || t.status || '—')}</span></td>
            </tr>`).join('')}</tbody>
        </table>` : '<p class="muted">No hay tareas pendientes ni en progreso.</p>'}
    </section>

    <footer>
        <span>${esc(project.name || 'Iniciativa')}</span>
        <span>Generado el ${esc(generado)}</span>
    </footer>
</div>
<script>
    // El documento se imprime a sí mismo: así el diálogo bloquea esta ventana
    // y no el hilo principal de la aplicación que la abrió.
    window.addEventListener('load', function () {
        setTimeout(function () { window.print(); }, 300);
    });
</script>
</body>
</html>`;
}

/**
 * Abre el resumen en una ventana nueva y lanza el diálogo de impresión.
 * Lista las tareas abiertas tal cual (título y estado), sin interpretación.
 */
export function exportProjectPdf(data) {
    const html = buildProjectReportHtml(data);
    const win = window.open('', '_blank');
    if (!win) {
        alert('Habilita las ventanas emergentes para exportar el PDF.');
        return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    // El propio documento se imprime (ver PRINT_SCRIPT). No llamamos win.print()
    // desde aquí: print() es síncrono y bloquearía el hilo principal de la app.
}
