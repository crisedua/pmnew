import React, { useMemo, useState } from 'react';
import { List, LayoutGrid, Shield } from 'lucide-react';
import { getInitiativeHealth, taskProgress } from '../lib/health';
import './Iniciativas.css';

/**
 * Vista de Iniciativas (proyectos) en formato lista/tabla.
 * props:
 *  - initiatives: array de proyectos { id, name, codigo, linea, owner_name,
 *      owner_email, status, updated_at, tasks: [...] }
 *  - onOpen: (projectId) => void
 *  - onBoard: () => void          (toggle a vista Tablero)
 *  - isAdmin, onAdmin: () => void  (botón "Acceso admin")
 */

// Estados derivados de la salud de las tareas. Coinciden con los chips.
const ESTADOS = {
    sin_iniciar: { label: 'Sin iniciar', color: '#94a3b8' },
    en_curso: { label: 'En curso', color: '#22c55e' },
    en_riesgo: { label: 'En riesgo', color: '#f59e0b' },
    bloqueada: { label: 'Bloqueada', color: '#ef4444' },
};

const ESTADO_FILTERS = [
    { key: 'todos', label: 'Todos los estados' },
    { key: 'sin_iniciar', label: 'Sin iniciar' },
    { key: 'en_curso', label: 'En curso' },
    { key: 'en_riesgo', label: 'En riesgo' },
    { key: 'bloqueada', label: 'Bloqueadas' },
];

// Paleta determinista para los avatares de owner.
const AVATAR_COLORS = ['#24528f', '#3f9c43', '#7c3aed', '#0891b2', '#d97706', '#db2777', '#0d9488'];

function avatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// Color del badge de línea según su código (L1 azul, L2 verde, etc.).
const LINEA_COLORS = { L1: '#24528f', L2: '#3f9c43', L3: '#7c3aed', L4: '#d97706' };
function lineaColor(code) {
    return LINEA_COLORS[code] || '#6b7280';
}

function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function deriveEstado(tasks) {
    if (!tasks || tasks.length === 0) return 'sin_iniciar';
    const progress = taskProgress(tasks);
    const anyInProgress = tasks.some(t => t.status && t.status !== 'To Do' && t.status !== 'Complete');
    if (progress === 0 && !anyInProgress) return 'sin_iniciar';
    const health = getInitiativeHealth(tasks);
    if (health === 'red') return 'bloqueada';
    if (health === 'yellow') return 'en_riesgo';
    return 'en_curso';
}

function lastActivity(initiative) {
    const dates = [];
    (initiative.tasks || []).forEach(t => {
        const d = t.last_progress_at || t.updated_at;
        if (d) dates.push(new Date(d).getTime());
    });
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates));
}

function formatRelative(date) {
    if (!date) return '—';
    const days = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (days <= 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    if (days < 30) return `Hace ${days} d`;
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

function Iniciativas({ initiatives = [], onOpen, onBoard, isAdmin, onAdmin }) {
    const [lineaFilter, setLineaFilter] = useState('todas');
    const [estadoFilter, setEstadoFilter] = useState('todos');

    // Pre-computa estado y línea de cada iniciativa.
    const rows = useMemo(() => initiatives.map(it => {
        const tasks = it.tasks || [];
        const estado = deriveEstado(tasks);
        const blocked = tasks.filter(t => t.health === 'red').length;
        return {
            ...it,
            tasks,
            estado,
            taskCount: tasks.length,
            blocked,
            act: lastActivity(it),
        };
    }), [initiatives]);

    // Líneas distintas para los chips (en orden de aparición).
    const lineas = useMemo(() => {
        const seen = [];
        rows.forEach(r => { if (r.linea && !seen.includes(r.linea)) seen.push(r.linea); });
        return seen;
    }, [rows]);

    const filtered = rows.filter(r =>
        (lineaFilter === 'todas' || r.linea === lineaFilter) &&
        (estadoFilter === 'todos' || r.estado === estadoFilter)
    );

    return (
        <div className="iniciativas">
            <div className="iniciativas-bar">
                <h1 className="iniciativas-title">Iniciativas</h1>
                <div className="iniciativas-actions">
                    <div className="view-toggle">
                        <button className="view-toggle-btn active"><List size={15} /> Lista</button>
                        <button className="view-toggle-btn" onClick={onBoard}><LayoutGrid size={15} /> Tablero</button>
                    </div>
                    {isAdmin && (
                        <button className="btn-acceso-admin" onClick={onAdmin}>
                            <Shield size={15} /> Acceso admin
                        </button>
                    )}
                </div>
            </div>

            <div className="iniciativas-filters">
                <div className="filter-group">
                    <button
                        className={`chip ${lineaFilter === 'todas' ? 'active' : ''}`}
                        onClick={() => setLineaFilter('todas')}
                    >Todas</button>
                    {lineas.map(l => (
                        <button
                            key={l}
                            className={`chip ${lineaFilter === l ? 'active' : ''}`}
                            onClick={() => setLineaFilter(l)}
                        >{l}</button>
                    ))}
                </div>
                <div className="filter-group">
                    {ESTADO_FILTERS.map(f => (
                        <button
                            key={f.key}
                            className={`chip ${estadoFilter === f.key ? 'active' : ''}`}
                            onClick={() => setEstadoFilter(f.key)}
                        >{f.label}</button>
                    ))}
                </div>
            </div>

            <div className="iniciativas-table-wrap">
                <table className="iniciativas-table">
                    <thead>
                        <tr>
                            <th className="col-cod">Cod</th>
                            <th>Iniciativa</th>
                            <th>Owner</th>
                            <th>Estado</th>
                            <th>Linea</th>
                            <th>Tareas / Bloqueos</th>
                            <th>Ult. Act.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(r => {
                            const owner = r.owner_name || r.owner_email || r.responsible_email || 'Sin owner';
                            const estado = ESTADOS[r.estado];
                            const lineaCode = r.linea ? r.linea.split(/\s+/)[0] : null;
                            return (
                                <tr key={r.id} onClick={() => onOpen && onOpen(r.id)}>
                                    <td className="col-cod">{r.codigo || '—'}</td>
                                    <td className="col-name">{r.name}</td>
                                    <td>
                                        <div className="owner-cell">
                                            <span className="owner-avatar" style={{ background: avatarColor(owner) }}>
                                                {initials(owner)}
                                            </span>
                                            <span className="owner-name">{owner}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="estado-cell">
                                            <span className="estado-dot" style={{ background: estado.color }} />
                                            {estado.label}
                                        </span>
                                    </td>
                                    <td>
                                        {lineaCode
                                            ? <span
                                                className="linea-badge"
                                                title={r.linea}
                                                style={{ color: lineaColor(lineaCode), background: `${lineaColor(lineaCode)}1a` }}
                                              >{lineaCode}</span>
                                            : <span className="muted">—</span>}
                                    </td>
                                    <td>
                                        <span className="muted">{r.taskCount} tareas</span>
                                        {r.blocked > 0 && <span className="bloqueos"> · {r.blocked} bloqueos</span>}
                                    </td>
                                    <td className="muted">{formatRelative(r.act)}</td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr className="empty-row">
                                <td colSpan="7">No hay iniciativas que coincidan con el filtro.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Iniciativas;
