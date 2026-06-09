import React from 'react';
import { User, Calendar, Clock, CheckSquare, ChevronRight } from 'lucide-react';
import { taskProgress } from '../lib/health';
import { ESTADO_SALUD } from '../lib/kpis';
import './ProjectCards.css';

/**
 * Cuadrícula de tarjetas de proyecto con su KPI.
 * props:
 *  - projects: array de proyectos (con .tasks, .owner_name, .due_date)
 *  - kpisById: { [proyecto_id]: fila de kpi_proyecto } (opcional, del servidor)
 *  - onOpen: (projectId) => void
 */
function ProjectCards({ projects = [], kpisById = {}, onOpen }) {
    if (projects.length === 0) {
        return (
            <div className="project-cards-empty">
                Esta comisión todavía no tiene proyectos.
            </div>
        );
    }

    const formatDate = (d) => {
        if (!d) return null;
        return new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <div className="project-cards-grid">
            {projects.map((project) => {
                const tasks = project.tasks || [];
                const kpi = kpisById[project.id];
                const avance = kpi ? kpi.avance_pct : taskProgress(tasks);
                const total = kpi ? kpi.actividades_total : (project.taskCount ?? tasks.length);
                const completadas = kpi
                    ? kpi.actividades_completadas
                    : tasks.filter(t => t.status === 'Complete').length;
                const vencidas = kpi ? kpi.actividades_vencidas : 0;
                const estado = kpi ? ESTADO_SALUD[kpi.estado_salud] : null;
                const owner = project.owner_name || 'Sin responsable';

                return (
                    <div
                        key={project.id}
                        className="project-kpi-card"
                        onClick={() => onOpen && onOpen(project.id)}
                    >
                        <div className="pkc-header">
                            <h3 className="pkc-name">{project.name}</h3>
                            {estado && (
                                <span
                                    className="pkc-estado"
                                    style={{ color: estado.color, borderColor: estado.color }}
                                >
                                    {estado.label}
                                </span>
                            )}
                        </div>

                        <div className="pkc-avance">
                            <div className="pkc-avance-top">
                                <span className="pkc-avance-pct">{avance}%</span>
                                <span className="pkc-avance-label">avance</span>
                            </div>
                            <div className="pkc-bar">
                                <div className="pkc-fill" style={{ width: `${avance}%` }} />
                            </div>
                        </div>

                        <div className="pkc-stats">
                            <span title="Actividades completadas / total">
                                <CheckSquare size={14} /> {completadas}/{total}
                            </span>
                            {vencidas > 0 && (
                                <span className="pkc-overdue" title="Actividades vencidas">
                                    <Clock size={14} /> {vencidas}
                                </span>
                            )}
                            {project.due_date && (
                                <span title="Fecha límite">
                                    <Calendar size={14} /> {formatDate(project.due_date)}
                                </span>
                            )}
                        </div>

                        <div className="pkc-footer">
                            <span className="pkc-owner">
                                <User size={14} /> {owner}
                            </span>
                            <ChevronRight size={16} className="pkc-chevron" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default ProjectCards;
