import React from 'react';
import { CheckCircle, Clock, Circle, FileText, Edit } from 'lucide-react';
import './ProjectSummary.css';

function ProjectSummary({ project, tasks, documents }) {
    const completedTasks = tasks.filter(t => t.status === 'Complete').length;
    const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
    const pendingTasks = tasks.filter(t => t.status === 'To Do').length;
    const totalTasks = tasks.length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
    };

    return (
        <div className="project-summary">
            {/* Project Info Card */}
            <div className="info-card card">
                <div className="info-header">
                    <h2>Información del Proyecto</h2>
                    <button className="btn-icon">
                        <Edit size={20} />
                    </button>
                </div>

                <div className="status-badge-container">
                    <span className="badge badge-primary">{project.status}</span>
                </div>

                <div className="info-section">
                    <h4 className="info-label text-secondary">Descripción</h4>
                    <p>{project.description || 'Sin descripción'}</p>
                </div>

                <div className="info-grid">
                    <div className="info-item">
                        <h4 className="info-label text-secondary">Responsable</h4>
                        <p>{project.responsible_email || 'No asignado'}</p>
                    </div>
                    <div className="info-item">
                        <h4 className="info-label text-secondary">Fecha Límite</h4>
                        <p>{formatDate(project.due_date)}</p>
                    </div>
                    <div className="info-item">
                        <h4 className="info-label text-secondary">Institución</h4>
                        <p>{project.institution || 'N/A'}</p>
                    </div>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="stats-grid">
                <div className="stat-card card">
                    <div className="stat-icon blue">
                        <CheckCircle size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-number">{completedTasks}</div>
                        <div className="stat-label">Tareas Completadas</div>
                        <div className="stat-sublabel text-secondary">
                            {totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}% del total` : 'No hay tareas'}
                        </div>
                    </div>
                </div>

                <div className="stat-card card">
                    <div className="stat-icon orange">
                        <Clock size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-number">{inProgressTasks}</div>
                        <div className="stat-label">En Progreso</div>
                        <div className="stat-sublabel text-secondary">Tareas activas</div>
                    </div>
                </div>

                <div className="stat-card card">
                    <div className="stat-icon gray">
                        <Circle size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-number">{pendingTasks}</div>
                        <div className="stat-label">Pendientes</div>
                        <div className="stat-sublabel text-secondary">Por iniciar</div>
                    </div>
                </div>

                <div className="stat-card card">
                    <div className="stat-icon purple">
                        <FileText size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-number">{documents.length}</div>
                        <div className="stat-label">Documentos</div>
                        <div className="stat-sublabel text-secondary">Archivos adjuntos</div>
                    </div>
                </div>
            </div>

            {/* Progress Section */}
            <div className="progress-section card">
                <h3>Progreso del Proyecto</h3>

                <div className="progress-info">
                    <span className="text-secondary">Progreso General</span>
                    <span className="progress-percentage">{progress}%</span>
                </div>

                <div className="progress-bar-large">
                    <div
                        className="progress-fill"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="progress-breakdown">
                    <div className="breakdown-item">
                        <div className="breakdown-number completed">{completedTasks}</div>
                        <div className="breakdown-label text-sm">Completadas</div>
                    </div>
                    <div className="breakdown-item">
                        <div className="breakdown-number in-progress">{inProgressTasks}</div>
                        <div className="breakdown-label text-sm">En Progreso</div>
                    </div>
                    <div className="breakdown-item">
                        <div className="breakdown-number pending">{pendingTasks}</div>
                        <div className="breakdown-label text-sm">Pendientes</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProjectSummary;
