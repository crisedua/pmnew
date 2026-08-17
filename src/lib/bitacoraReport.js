// Genera un PDF imprimible de la Bitácora (vía "Guardar como PDF" del
// navegador): mismas columnas que la tabla en pantalla, tal cual están
// escritas, con las filas urgentes marcadas.

function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Preserva saltos de línea de las notas dentro de una celda de tabla.
function multiline(value) {
    return esc(value).replace(/\n/g, '<br>');
}

export function buildBitacoraReportHtml({ title, subtitle, rows = [] }) {
    const now = new Date();
    const generado = now.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
        + ' · ' + now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    const urgentCount = rows.filter(r => r.urgente).length;

    const bodyRows = rows.map(r => `
        <tr class="${r.urgente ? 'urgent' : ''}">
            <td class="col-flag">${r.urgente ? '<span class="flag" title="Urgente">&#9873;</span>' : ''}</td>
            <td class="t-title">${esc(r.universidad) || '—'}</td>
            <td>${esc(r.nombre) || '—'}</td>
            <td>${esc(r.modalidad) || '—'}</td>
            <td>${multiline(r.estudiantes) || '—'}</td>
            <td>${multiline(r.notas) || '—'}</td>
        </tr>`).join('');

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Bitácora — ${esc(title || 'Comisión')}</title>
<style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #16243a; background: #fff; font-size: 11px; line-height: 1.45;
    }
    @page { size: A4 landscape; margin: 12mm; }

    header.cover {
        background: linear-gradient(135deg, #24528f 0%, #16345f 100%);
        color: #fff; border-radius: 14px; padding: 18px 22px; margin-bottom: 16px;
        display: flex; justify-content: space-between; align-items: center; gap: 1rem;
    }
    .brand { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.8; font-weight: 700; }
    header.cover h1 { margin: 6px 0 4px; font-size: 20px; }
    .cover-sub { font-size: 11px; opacity: 0.85; }
    .cover-meta { text-align: right; font-size: 10.5px; opacity: 0.9; }
    .cover-meta .chip {
        display: inline-block; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.25);
        border-radius: 999px; padding: 3px 10px; font-weight: 600; margin-bottom: 6px;
    }

    table { width: 100%; border-collapse: collapse; }
    thead th {
        text-align: left; background: #24528f; color: #fff; font-size: 9.5px;
        text-transform: uppercase; letter-spacing: 0.03em; padding: 7px 8px;
    }
    tbody td { padding: 6px 8px; border-bottom: 1px solid #eef2f8; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    tbody tr.urgent td { background: #fff6f6 !important; }
    tbody tr { page-break-inside: avoid; }
    .t-title { font-weight: 700; }
    .col-flag { width: 20px; text-align: center; }
    .flag { color: #dc2626; font-size: 12px; }

    footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e6ecf5; font-size: 9.5px; color: #94a3b8; display: flex; justify-content: space-between; }
</style>
</head>
<body>
    <header class="cover">
        <div>
            <div class="brand">ASIVA · Bitácora</div>
            <h1>${esc(title || 'Bitácora')}</h1>
            <div class="cover-sub">${esc(subtitle || '')}</div>
        </div>
        <div class="cover-meta">
            <div class="chip">${rows.length} registro${rows.length !== 1 ? 's' : ''}</div>
            ${urgentCount ? `<div class="chip">&#9873; ${urgentCount} urgente${urgentCount !== 1 ? 's' : ''}</div>` : ''}
        </div>
    </header>

    <table>
        <thead>
            <tr>
                <th class="col-flag"></th>
                <th>Universidad</th>
                <th>Nombre</th>
                <th>Modalidad</th>
                <th>Estudiantes</th>
                <th>Notas</th>
            </tr>
        </thead>
        <tbody>
            ${bodyRows || '<tr><td colspan="6" style="padding:16px;color:#94a3b8;font-style:italic;">Sin registros.</td></tr>'}
        </tbody>
    </table>

    <footer>
        <span>${esc(title || 'Bitácora')}</span>
        <span>Generado el ${esc(generado)}</span>
    </footer>

<script>
    window.addEventListener('load', function () {
        setTimeout(function () { window.print(); }, 300);
    });
</script>
</body>
</html>`;
}

/** Abre la bitácora en una ventana nueva y lanza el diálogo de impresión. */
export function exportBitacoraPdf(data) {
    try {
        const html = buildBitacoraReportHtml(data);
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        const win = window.open(url, '_blank');
        if (!win) {
            URL.revokeObjectURL(url);
            alert('Habilita las ventanas emergentes para exportar el PDF.');
            return;
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
        console.error('Error al generar el PDF de la bitácora:', err);
        alert('No se pudo generar el PDF: ' + (err?.message || 'error desconocido'));
    }
}
