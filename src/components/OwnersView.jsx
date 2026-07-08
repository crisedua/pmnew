import React, { useMemo } from 'react';
import { getInitiativeEstado, ESTADOS, lineaColor } from '../lib/health';
import { avatarColor, initials } from '../lib/avatar';
import './OwnersView.css';

/**
 * Vista de Owners: agrupa las iniciativas por responsable (owner).
 * props:
 *  - initiatives: array de proyectos { owner_name, owner_email, codigo, linea, tasks }
 *  - onOpen: (projectId) => void
 */
function OwnersView({ initiatives = [], onOpen }) {
    const owners = useMemo(() => {
        const map = new Map();
        initiatives.forEach(it => {
            const key = it.owner_name || it.owner_email || 'Sin owner';
            if (!map.has(key)) {
                map.set(key, { name: key, email: it.owner_email || null, items: [] });
            }
            const o = map.get(key);
            if (!o.email && it.owner_email) o.email = it.owner_email;
            o.items.push(it);
        });
        return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
    }, [initiatives]);

    return (
        <div className="owners-view">
            <h1 className="owners-title">Owners</h1>

            {owners.length === 0 ? (
                <div className="owners-empty">No hay owners asignados todavía.</div>
            ) : (
                <div className="owners-grid">
                    {owners.map(owner => (
                        <div className="owner-card" key={owner.name}>
                            <div className="owner-head">
                                <span className="owner-avatar" style={{ background: avatarColor(owner.name) }}>
                                    {initials(owner.name)}
                                </span>
                                <div className="owner-id">
                                    <strong>{owner.name}</strong>
                                    {owner.email && <span>{owner.email}</span>}
                                </div>
                                <span className="owner-count">{owner.items.length}</span>
                            </div>

                            <div className="owner-items">
                                {owner.items.map(it => {
                                    const estado = ESTADOS[getInitiativeEstado(it.tasks || [], it)];
                                    return (
                                        <div
                                            className="owner-item"
                                            key={it.id}
                                            onClick={() => onOpen && onOpen(it.id)}
                                        >
                                            {it.codigo && (
                                                <span
                                                    className="owner-item-cod"
                                                    style={{ color: lineaColor(it.linea), background: `${lineaColor(it.linea)}1a` }}
                                                >{it.codigo}</span>
                                            )}
                                            <span className="owner-item-name">{it.name}</span>
                                            <span className="owner-item-estado">
                                                <span className="owner-item-dot" style={{ background: estado.color }} />
                                                {estado.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default OwnersView;
