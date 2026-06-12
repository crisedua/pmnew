import React from 'react';
import { List, LayoutGrid, Shield } from 'lucide-react';
import { ESTADOS, getInitiativeEstado, lineaColor } from '../lib/health';
import { avatarColor, initials } from '../lib/avatar';
import './IniciativasBoard.css';

/**
 * Tablero de iniciativas agrupadas por estado (Kanban).
 * props:
 *  - initiatives: array de proyectos { id, name, codigo, linea, owner_name, tasks }
 *  - onOpen: (projectId) => void
 *  - onList: () => void            (volver a vista Lista)
 *  - isAdmin, onAdmin: () => void
 */

const COLUMNS = ['sin_iniciar', 'en_curso', 'en_riesgo', 'bloqueada'];

function lastActivityLabel(tasks = []) {
    const times = [];
    tasks.forEach(t => {
        const d = t.last_progress_at || t.updated_at;
        if (d) times.push(new Date(d).getTime());
    });
    if (times.length === 0) return 'Sin act.';
    const days = Math.floor((Date.now() - Math.max(...times)) / 86400000);
    if (days <= 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    if (days < 30) return `Hace ${days} d`;
    return new Date(Math.max(...times)).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

function IniciativasBoard({ initiatives = [], onOpen, onList, isAdmin, onAdmin }) {
    const byEstado = { sin_iniciar: [], en_curso: [], en_riesgo: [], bloqueada: [] };
    initiatives.forEach(it => {
        byEstado[getInitiativeEstado(it.tasks || [])].push(it);
    });

    return (
        <div className="ini-board">
            <div className="iniciativas-bar">
                <h1 className="iniciativas-title">Tablero</h1>
                <div className="iniciativas-actions">
                    <div className="view-toggle">
                        <button className="view-toggle-btn" onClick={onList}><List size={15} /> Lista</button>
                        <button className="view-toggle-btn active"><LayoutGrid size={15} /> Tablero</button>
                    </div>
                    {isAdmin && (
                        <button className="btn-acceso-admin" onClick={onAdmin}>
                            <Shield size={15} /> Acceso admin
                        </button>
                    )}
                </div>
            </div>

            <div className="board-cols">
                {COLUMNS.map(key => {
                    const est = ESTADOS[key];
                    const items = byEstado[key];
                    return (
                        <div className="board-col" key={key} style={{ '--col-accent': est.color }}>
                            <div className="board-col-head">
                                <span className="board-col-dot" style={{ background: est.color }} />
                                <span className="board-col-name">{est.label}</span>
                                <span className="board-col-count">{items.length}</span>
                            </div>
                            <div className="board-col-body">
                                {items.length === 0 ? (
                                    <div className="board-col-empty">Sin iniciativas</div>
                                ) : (
                                    items.map(it => {
                                        const owner = it.owner_name || it.owner_email || it.responsible_email || 'Sin owner';
                                        return (
                                            <div className="ini-card" key={it.id} onClick={() => onOpen && onOpen(it.id)}>
                                                {it.codigo && (
                                                    <span
                                                        className="ini-card-cod"
                                                        title={it.linea || ''}
                                                        style={{ color: lineaColor(it.linea), background: `${lineaColor(it.linea)}1a` }}
                                                    >{it.codigo}</span>
                                                )}
                                                <div className="ini-card-name">{it.name}</div>
                                                <div className="ini-card-foot">
                                                    <span className="ini-card-avatar" style={{ background: avatarColor(owner) }} title={owner}>
                                                        {initials(owner)}
                                                    </span>
                                                    <span className="ini-card-act">{lastActivityLabel(it.tasks || [])}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default IniciativasBoard;
