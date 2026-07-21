import React, { useMemo } from 'react';
import { FileDown } from 'lucide-react';
import { ESTADOS } from '../lib/health';
import { buildAreaStats, exportAreaPdf } from '../lib/areaReport';
import './ReporteView.css';

const STATUS_LABEL = {
    'To Do': 'Por hacer',
    'In Progress': 'En progreso',
    'On Hold': 'En espera',
    'Complete': 'Completada',
};

// Mismo orden que las columnas del tablero.
const STATUS_ORDER = { 'To Do': 0, 'In Progress': 1, 'On Hold': 2 };

const statusClass = (s) => `rep-pill ${(s || '').replace(/\s+/g, '-').toLowerCase()}`;

function ReporteView({ initiatives = [], area, onOpen }) {
    const s = useMemo(() => buildAreaStats(initiatives), [initiatives]);

    // Tareas abiertas por iniciativa, tal cual están registradas.
    const grupos = useMemo(() => s.rows
        .map(r => ({
            ...r,
            abiertas: (r.tasks || [])
                .filter(t => t.status !== 'Complete')
                .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)),
        }))
        .filter(r => r.abiertas.length > 0), [s.rows]);

    return (
        <div className="reporte-view">
            <div className="rep-bar">
                <div>
                    <h1 className="rep-title">Reporte de estado</h1>
                    <p className="rep-sub">
                        {area?.name || 'Comisión'} · {s.totalIniciativas} iniciativas · {s.totalTasks} tareas
                    </p>
                </div>
                <button className="rep-pdf" onClick={() => exportAreaPdf({ area, initiatives })}>
                    <FileDown size={16} /> Exportar PDF
                </button>
            </div>

            {/* Métricas */}
            <div className="rep-stats">
                <div className="rep-stat"><span className="rep-stat-v">{s.totalIniciativas}</span><span className="rep-stat-l">Iniciativas</span></div>
                <div className="rep-stat"><span className="rep-stat-v">{s.totalTasks}</span><span className="rep-stat-l">Tareas</span></div>
                <div className="rep-stat"><span className="rep-stat-v ok">{s.doneTasks}</span><span className="rep-stat-l">Completadas</span></div>
                <div className="rep-stat"><span className="rep-stat-v">{s.abiertas.length}</span><span className="rep-stat-l">Abiertas</span></div>
                <div className="rep-stat"><span className="rep-stat-v bad">{s.bloqueadas.length}</span><span className="rep-stat-l">Bloqueadas</span></div>
                <div className="rep-stat"><span className="rep-stat-v warn">{s.atrasadas.length}</span><span className="rep-stat-l">Atrasadas</span></div>
            </div>

            {/* Avance global */}
            <div className="rep-progress">
                <div className="rep-progress-head">
                    <span>Avance global</span><strong>{s.avance}%</strong>
                </div>
                <div className="rep-bar-track"><span style={{ width: `${s.avance}%` }} /></div>
                <div className="rep-legend">
                    {Object.values(ESTADOS).map(e => (
                        <span className="rep-legend-item" key={e.key}>
                            <span className="rep-dot" style={{ background: e.color }} />
                            {e.label} <strong>{s.estadoCounts[e.key] || 0}</strong>
                        </span>
                    ))}
                </div>
            </div>

            {/* Tareas abiertas, tal cual, agrupadas por iniciativa */}
            <section className="rep-block">
                <div className="rep-block-head">
                    <h3>Tareas pendientes y en progreso</h3>
                    <span className="rep-count">{s.abiertas.length}</span>
                </div>

                {grupos.length === 0 ? (
                    <p className="rep-empty">No hay tareas pendientes ni en progreso.</p>
                ) : grupos.map(g => (
                    <div className="rep-group" key={g.id}>
                        <h4 className="rep-ini" onClick={() => onOpen?.(g.id)}>
                            {g.name} <span className="rep-count-sm">{g.abiertas.length}</span>
                        </h4>
                        <table className="rep-table">
                            <thead>
                                <tr><th>Tarea</th><th>Asignado a</th><th>Estado</th></tr>
                            </thead>
                            <tbody>
                                {g.abiertas.map(t => (
                                    <tr key={t.id}>
                                        <td className="rep-strong">{t.title || 'Sin título'}</td>
                                        <td>
                                            {t.assignee_name || t.assignee_email
                                                || <span className="rep-muted">Sin asignar</span>}
                                        </td>
                                        <td><span className={statusClass(t.status)}>{STATUS_LABEL[t.status] || t.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </section>

            {/* Panorama por iniciativa */}
            <section className="rep-block">
                <div className="rep-block-head">
                    <h3>Iniciativas</h3>
                    <span className="rep-count">{s.rows.length}</span>
                </div>
                {s.rows.length === 0 ? (
                    <p className="rep-empty">Esta comisión aún no tiene iniciativas.</p>
                ) : (
                    <table className="rep-table">
                        <thead>
                            <tr><th>Iniciativa</th><th>Owner</th><th>Estado</th><th>Pendientes</th><th>Avance</th></tr>
                        </thead>
                        <tbody>
                            {[...s.rows].sort((a, b) => a.progress - b.progress).map(r => (
                                <tr key={r.id} onClick={() => onOpen?.(r.id)} className="rep-row-link">
                                    <td className="rep-strong">{r.name}</td>
                                    <td className="rep-muted">{r.owner_name || r.owner_email || '—'}</td>
                                    <td>
                                        <span className="rep-dot" style={{ background: ESTADOS[r.estado].color }} />
                                        {ESTADOS[r.estado].label}
                                    </td>
                                    <td>{r.pendientes}</td>
                                    <td>
                                        <span className="rep-mini"><span style={{ width: `${r.progress}%` }} /></span>
                                        <span className="rep-muted">{r.progress}%</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    );
}

export default ReporteView;
