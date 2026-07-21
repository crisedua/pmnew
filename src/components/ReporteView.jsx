import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { FileDown, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { ESTADOS } from '../lib/health';
import { buildAreaStats, exportAreaPdf } from '../lib/areaReport';
import { generateAreaSummary } from '../lib/areaSummary';
import './ReporteView.css';

function ReporteView({ initiatives = [], area, onOpen }) {
    const s = useMemo(() => buildAreaStats(initiatives), [initiatives]);

    const [summary, setSummary] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const runSummary = useCallback(async () => {
        if (!initiatives.length) {
            setSummary([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const bullets = await generateAreaSummary({ area, initiatives, stats: s });
            setSummary(bullets);
        } catch (err) {
            console.error('Error generando resumen:', err);
            setError('No se pudo generar el resumen. Revisa la configuración de la IA e inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    }, [area, initiatives, s]);

    // Genera el resumen al entrar a la comisión (una vez por comisión).
    useEffect(() => {
        setSummary([]);
        setError(null);
        if (initiatives.length) runSummary();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [area?.id, initiatives.length]);

    return (
        <div className="reporte-view">
            <div className="rep-bar">
                <div>
                    <h1 className="rep-title">Reporte de estado</h1>
                    <p className="rep-sub">
                        {area?.name || 'Comisión'} · {s.totalIniciativas} iniciativas · {s.totalTasks} tareas
                    </p>
                </div>
                <button
                    className="rep-pdf"
                    onClick={() => exportAreaPdf({ area, initiatives, summary })}
                >
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

            {/* Resumen ejecutivo generado con IA */}
            <section className="rep-block rep-ai">
                <div className="rep-block-head">
                    <Sparkles size={16} />
                    <h3>Resumen ejecutivo</h3>
                    <button
                        className="rep-regen"
                        onClick={runSummary}
                        disabled={loading || !initiatives.length}
                        title="Regenerar resumen"
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                        {loading ? 'Generando…' : 'Regenerar'}
                    </button>
                </div>

                {loading && summary.length === 0 && (
                    <div className="rep-skeleton">
                        <span /><span /><span /><span />
                    </div>
                )}

                {error && (
                    <p className="rep-error"><AlertCircle size={14} /> {error}</p>
                )}

                {!loading && !error && summary.length === 0 && (
                    <p className="rep-empty">
                        {initiatives.length
                            ? 'Sin resumen todavía. Usa "Regenerar" para crearlo.'
                            : 'Esta comisión aún no tiene iniciativas que resumir.'}
                    </p>
                )}

                {summary.length > 0 && (
                    <ul className="rep-bullets">
                        {summary.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                )}
            </section>

            {/* Panorama por iniciativa (una línea cada una, sin detalle de tareas) */}
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
