import React, { useMemo } from 'react';
import { ESTADOS, getInitiativeEstado, lineaColor } from '../lib/health';
import './TimelineView.css';

/**
 * Timeline: iniciativas ubicadas en un eje temporal por start_date/due_date.
 * props:
 *  - initiatives: array de proyectos { name, codigo, linea, start_date, due_date, tasks }
 *  - onOpen: (projectId) => void
 */
const MS_DAY = 86400000;

function parse(d) {
    if (!d) return null;
    const t = new Date(d).getTime();
    return Number.isNaN(t) ? null : t;
}

function fmt(ts) {
    return new Date(ts).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit' });
}

function TimelineView({ initiatives = [], onOpen }) {
    const { rows, min, max, hasRange } = useMemo(() => {
        const items = initiatives.map(it => ({
            ...it,
            start: parse(it.start_date),
            end: parse(it.due_date),
        }));
        const dates = items.flatMap(i => [i.start, i.end]).filter(d => d != null);
        if (dates.length === 0) {
            return { rows: items, min: 0, max: 0, hasRange: false };
        }
        const rawMin = Math.min(...dates);
        const rawMax = Math.max(...dates) === rawMin ? rawMin + 30 * MS_DAY : Math.max(...dates);
        const pad = (rawMax - rawMin) * 0.04;
        const sorted = [...items].sort((a, b) => (a.start || a.end || Infinity) - (b.start || b.end || Infinity));
        return { rows: sorted, min: rawMin - pad, max: rawMax + pad, hasRange: true };
    }, [initiatives]);

    const span = max - min || 1;
    const pos = (ts) => `${((ts - min) / span) * 100}%`;

    // 5 marcas temporales
    const ticks = hasRange
        ? Array.from({ length: 5 }, (_, i) => min + (span * i) / 4)
        : [];

    return (
        <div className="timeline-view">
            <h1 className="timeline-title">Timeline</h1>

            {!hasRange ? (
                <div className="timeline-empty">
                    Ninguna iniciativa tiene fechas definidas todavía. Agrega <strong>Inicio</strong> y
                    <strong> Cierre est.</strong> en la ficha de cada iniciativa para verlas aquí.
                </div>
            ) : (
                <div className="timeline-card">
                    <div className="tl-axis">
                        <div className="tl-axis-label" />
                        <div className="tl-axis-track">
                            {ticks.map((t, i) => (
                                <span className="tl-tick" key={i} style={{ left: pos(t) }}>{fmt(t)}</span>
                            ))}
                        </div>
                    </div>

                    {rows.map(it => {
                        const estado = ESTADOS[getInitiativeEstado(it.tasks || [])];
                        const color = lineaColor(it.linea);
                        const s = it.start || it.end;
                        const e = it.end || it.start;
                        const hasBar = s != null;
                        const left = hasBar ? pos(Math.min(s, e)) : 0;
                        const width = hasBar
                            ? `${Math.max(((Math.abs(e - s)) / span) * 100, 1.5)}%`
                            : 0;
                        return (
                            <div className="tl-row" key={it.id} onClick={() => onOpen && onOpen(it.id)}>
                                <div className="tl-label" title={it.name}>
                                    {it.codigo && <span className="tl-cod" style={{ color, background: `${color}1a` }}>{it.codigo}</span>}
                                    <span className="tl-name">{it.name}</span>
                                </div>
                                <div className="tl-track">
                                    {hasBar ? (
                                        <div
                                            className="tl-bar"
                                            style={{ left, width, background: color }}
                                            title={`${fmt(Math.min(s, e))} → ${fmt(Math.max(s, e))}`}
                                        >
                                            <span className="tl-bar-dot" style={{ background: estado.color }} />
                                        </div>
                                    ) : (
                                        <span className="tl-nodate">Sin fechas</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default TimelineView;
