import React, { useMemo } from 'react';
import { Target, Activity, AlertTriangle, Ban, Clock, CalendarCheck } from 'lucide-react';
import { ESTADOS, getInitiativeEstado, taskProgress, lineaColor } from '../lib/health';
import './KpisView.css';

/**
 * KPIs & Sesiones: indicadores calculados desde las iniciativas.
 * props:
 *  - initiatives: array de proyectos { codigo, linea, tasks }
 *  - onOpen: (projectId) => void
 */
function KpisView({ initiatives = [], onOpen }) {
    const stats = useMemo(() => {
        const counts = { sin_iniciar: 0, en_curso: 0, en_riesgo: 0, bloqueada: 0 };
        let progressSum = 0;
        let blocked = 0;
        const rows = initiatives.map(it => {
            const tasks = it.tasks || [];
            const estado = getInitiativeEstado(tasks);
            const progress = taskProgress(tasks);
            counts[estado] += 1;
            progressSum += progress;
            blocked += tasks.filter(t => t.health === 'red').length;
            return { ...it, estado, progress, taskCount: tasks.length };
        });
        const total = initiatives.length;
        const avance = total ? Math.round(progressSum / total) : 0;

        // Desglose por línea
        const byLinea = new Map();
        rows.forEach(r => {
            const key = r.linea || 'Sin línea';
            if (!byLinea.has(key)) byLinea.set(key, { linea: key, count: 0, progressSum: 0 });
            const l = byLinea.get(key);
            l.count += 1;
            l.progressSum += r.progress;
        });
        const lineas = Array.from(byLinea.values()).map(l => ({
            ...l,
            avance: l.count ? Math.round(l.progressSum / l.count) : 0,
        }));

        return { counts, avance, blocked, total, rows, lineas };
    }, [initiatives]);

    const kpis = [
        { key: 'total', icon: Target, label: 'Iniciativas', value: stats.total, tone: '' },
        { key: 'avance', icon: CalendarCheck, label: 'Avance global', value: `${stats.avance}%`, tone: 'blue' },
        { key: 'en_curso', icon: Activity, label: 'En curso', value: stats.counts.en_curso, tone: 'ok' },
        { key: 'en_riesgo', icon: AlertTriangle, label: 'En riesgo', value: stats.counts.en_riesgo, tone: 'warn' },
        { key: 'bloqueada', icon: Ban, label: 'Bloqueadas', value: stats.counts.bloqueada, tone: 'danger' },
        { key: 'sin_iniciar', icon: Clock, label: 'Sin iniciar', value: stats.counts.sin_iniciar, tone: 'muted' },
    ];

    return (
        <div className="kpis-view">
            <h1 className="kpis-title">KPIs &amp; Sesiones</h1>

            <div className="kpis-cards">
                {kpis.map(k => {
                    const Icon = k.icon;
                    return (
                        <div className={`kpi-card ${k.tone}`} key={k.key}>
                            <Icon size={18} className="kpi-card-ic" />
                            <span className="kpi-card-value">{k.value}</span>
                            <span className="kpi-card-label">{k.label}</span>
                        </div>
                    );
                })}
            </div>

            <div className="kpis-grid">
                <div className="kpis-panel">
                    <h2 className="kpis-panel-title">Avance por línea</h2>
                    {stats.lineas.length === 0 ? (
                        <div className="kpis-empty">Sin datos</div>
                    ) : stats.lineas.map(l => (
                        <div className="kpi-linea" key={l.linea}>
                            <div className="kpi-linea-head">
                                <span className="kpi-linea-name" style={{ color: lineaColor(l.linea) }}>{l.linea}</span>
                                <span className="kpi-linea-meta">{l.count} · {l.avance}%</span>
                            </div>
                            <div className="kpi-bar">
                                <div className="kpi-bar-fill" style={{ width: `${l.avance}%`, background: lineaColor(l.linea) }} />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="kpis-panel">
                    <h2 className="kpis-panel-title">Avance por iniciativa</h2>
                    {stats.rows.length === 0 ? (
                        <div className="kpis-empty">Sin iniciativas</div>
                    ) : stats.rows.map(r => {
                        const estado = ESTADOS[r.estado];
                        return (
                            <div className="kpi-init" key={r.id} onClick={() => onOpen && onOpen(r.id)}>
                                <span className="kpi-init-dot" style={{ background: estado.color }} title={estado.label} />
                                <span className="kpi-init-name">{r.codigo ? `${r.codigo} · ` : ''}{r.name}</span>
                                <div className="kpi-bar sm">
                                    <div className="kpi-bar-fill" style={{ width: `${r.progress}%`, background: '#24528f' }} />
                                </div>
                                <span className="kpi-init-pct">{r.progress}%</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="kpis-panel">
                <h2 className="kpis-panel-title">Sesiones</h2>
                <div className="kpis-empty">
                    El registro de sesiones aún no está configurado. Próximamente podrás llevar
                    la bitácora de reuniones de la comisión aquí.
                </div>
            </div>
        </div>
    );
}

export default KpisView;
