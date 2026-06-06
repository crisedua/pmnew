import React from 'react';
import { Mail, Phone, User, ChevronRight } from 'lucide-react';
import { getInitiativeHealth, healthBreakdown, taskProgress, HEALTH } from '../lib/health';
import './InitiativesOverview.css';

/**
 * Vista de iniciativas (proyectos) a nivel de comisión.
 * props:
 *  - projects: array de proyectos, cada uno con .tasks
 *  - onOpen: (projectId) => void
 */
function InitiativesOverview({ projects = [], onOpen }) {
    if (projects.length === 0) {
        return (
            <div className="initiatives-overview">
                <h3 className="initiatives-title">Iniciativas</h3>
                <div className="initiatives-empty">No hay iniciativas en esta comisión todavía.</div>
            </div>
        );
    }

    return (
        <div className="initiatives-overview">
            <h3 className="initiatives-title">Iniciativas</h3>
            <div className="initiatives-list">
                {projects.map((project) => {
                    const tasks = project.tasks || [];
                    const progress = taskProgress(tasks);
                    const health = getInitiativeHealth(tasks);
                    const counts = healthBreakdown(tasks);
                    const ownerName = project.owner_name || project.responsible_email || 'Sin owner';

                    return (
                        <div
                            key={project.id}
                            className="initiative-card"
                            onClick={() => onOpen && onOpen(project.id)}
                        >
                            <div className="initiative-main">
                                <div className="initiative-head">
                                    <span
                                        className="initiative-health-dot"
                                        style={{ backgroundColor: HEALTH[health].color }}
                                        title={`Estado: ${HEALTH[health].label}`}
                                    />
                                    <h4 className="initiative-name">{project.name}</h4>
                                    <ChevronRight size={16} className="initiative-chevron" />
                                </div>

                                <div className="initiative-owner">
                                    <span><User size={13} /> {ownerName}</span>
                                    {project.owner_email && (
                                        <a href={`mailto:${project.owner_email}`} onClick={(e) => e.stopPropagation()}>
                                            <Mail size={13} /> {project.owner_email}
                                        </a>
                                    )}
                                    {project.owner_phone && (
                                        <a href={`tel:${project.owner_phone}`} onClick={(e) => e.stopPropagation()}>
                                            <Phone size={13} /> {project.owner_phone}
                                        </a>
                                    )}
                                </div>
                            </div>

                            <div className="initiative-metrics">
                                <div className="initiative-progress">
                                    <div className="initiative-progress-bar">
                                        <div className="initiative-progress-fill" style={{ width: `${progress}%` }} />
                                    </div>
                                    <span className="initiative-progress-label">{progress}% · {tasks.length} tareas</span>
                                </div>
                                <div className="initiative-counts">
                                    <span className="count-pill green" title="En curso">🟢 {counts.green}</span>
                                    <span className="count-pill yellow" title="Advertencia">🟡 {counts.yellow}</span>
                                    <span className="count-pill red" title="Bloqueada">🔴 {counts.red}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default InitiativesOverview;
