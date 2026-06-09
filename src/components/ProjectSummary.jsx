import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Circle, FileText, Edit, X, Mail, Phone, User, UserPlus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { healthBreakdown } from '../lib/health';
import './ProjectSummary.css';

function ProjectSummary({ project, tasks, documents, onUpdate, canManage = false }) {
    const [showEditModal, setShowEditModal] = useState(false);
    const [assignees, setAssignees] = useState([]);
    const [newAssignee, setNewAssignee] = useState({ name: '', email: '' });
    const [savingAssignee, setSavingAssignee] = useState(false);
    const [editForm, setEditForm] = useState({
        name: project.name || '',
        description: project.description || '',
        status: project.status || 'En Progreso',
        due_date: project.due_date || '',
        owner_name: project.owner_name || '',
        owner_email: project.owner_email || '',
        owner_phone: project.owner_phone || ''
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchAssignees();
    }, [project.id]);

    const fetchAssignees = async () => {
        const { data, error } = await supabase
            .from('project_assignees')
            .select('*')
            .eq('project_id', project.id)
            .order('created_at', { ascending: true });
        if (error) {
            // La tabla puede no existir aún (SQL sin correr): no rompemos la página.
            console.warn('Error fetching project assignees:', error.message);
            return;
        }
        setAssignees(data || []);
    };

    const handleAddAssignee = async (e) => {
        e.preventDefault();
        if (!newAssignee.name.trim() && !newAssignee.email.trim()) return;
        setSavingAssignee(true);
        try {
            const { error } = await supabase
                .from('project_assignees')
                .insert({
                    project_id: project.id,
                    name: newAssignee.name.trim() || null,
                    email: newAssignee.email.trim() || null,
                });
            if (error) throw error;
            setNewAssignee({ name: '', email: '' });
            await fetchAssignees();
        } catch (error) {
            console.error('Error adding assignee:', error);
            alert('Error al asignar persona: ' + error.message);
        } finally {
            setSavingAssignee(false);
        }
    };

    const handleRemoveAssignee = async (id) => {
        try {
            const { error } = await supabase
                .from('project_assignees')
                .delete()
                .eq('id', id);
            if (error) throw error;
            await fetchAssignees();
        } catch (error) {
            console.error('Error removing assignee:', error);
            alert('Error al quitar persona: ' + error.message);
        }
    };

    const completedTasks = tasks.filter(t => t.status === 'Complete').length;
    const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
    const pendingTasks = tasks.filter(t => t.status === 'To Do').length;
    const totalTasks = tasks.length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const health = healthBreakdown(tasks);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
    };

    const handleEditClick = () => {
        setEditForm({
            name: project.name || '',
            description: project.description || '',
            status: project.status || 'En Progreso',
            due_date: project.due_date || '',
            owner_name: project.owner_name || '',
            owner_email: project.owner_email || '',
            owner_phone: project.owner_phone || ''
        });
        setShowEditModal(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('projects')
                .update({
                    name: editForm.name,
                    description: editForm.description,
                    status: editForm.status,
                    due_date: editForm.due_date || null,
                    owner_name: editForm.owner_name || null,
                    owner_email: editForm.owner_email || null,
                    owner_phone: editForm.owner_phone || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', project.id);

            if (error) throw error;

            setShowEditModal(false);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error updating project:', error);
            alert('Error al actualizar el proyecto: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="project-summary">
            {/* Project Info Card */}
            <div className="info-card card">
                <div className="info-header">
                    <h2>Información del Proyecto</h2>
                    <button className="btn-icon" onClick={handleEditClick}>
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
                        <h4 className="info-label text-secondary">Owner de la Iniciativa</h4>
                        <p>{project.owner_name || project.responsible_email || 'No asignado'}</p>
                    </div>
                    <div className="info-item">
                        <h4 className="info-label text-secondary">Fecha Límite</h4>
                        <p>{formatDate(project.due_date)}</p>
                    </div>
                </div>

                {(project.owner_email || project.owner_phone) && (
                    <div className="owner-contact">
                        {project.owner_name && (
                            <span className="owner-chip"><User size={14} /> {project.owner_name}</span>
                        )}
                        {project.owner_email && (
                            <a className="owner-chip" href={`mailto:${project.owner_email}`}>
                                <Mail size={14} /> {project.owner_email}
                            </a>
                        )}
                        {project.owner_phone && (
                            <a className="owner-chip" href={`tel:${project.owner_phone}`}>
                                <Phone size={14} /> {project.owner_phone}
                            </a>
                        )}
                    </div>
                )}
            </div>

            {/* Personas asignadas al proyecto */}
            <div className="assignees-card card">
                <div className="info-header">
                    <h3>Personas Asignadas</h3>
                </div>

                {assignees.length === 0 ? (
                    <p className="text-secondary">Nadie asignado todavía.</p>
                ) : (
                    <div className="assignees-list">
                        {assignees.map(a => (
                            <div key={a.id} className="assignee-chip">
                                <User size={14} />
                                <span className="assignee-name">{a.name || a.email}</span>
                                {a.email && a.name && (
                                    <a href={`mailto:${a.email}`} className="assignee-email">
                                        <Mail size={12} /> {a.email}
                                    </a>
                                )}
                                {canManage && (
                                    <button
                                        className="assignee-remove"
                                        title="Quitar"
                                        onClick={() => handleRemoveAssignee(a.id)}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {canManage && (
                    <form className="assignee-add-form" onSubmit={handleAddAssignee}>
                        <input
                            type="text"
                            placeholder="Nombre"
                            value={newAssignee.name}
                            onChange={e => setNewAssignee({ ...newAssignee, name: e.target.value })}
                        />
                        <input
                            type="email"
                            placeholder="email@ejemplo.com"
                            value={newAssignee.email}
                            onChange={e => setNewAssignee({ ...newAssignee, email: e.target.value })}
                        />
                        <button
                            type="submit"
                            className="btn btn-primary btn-sm"
                            disabled={savingAssignee || (!newAssignee.name.trim() && !newAssignee.email.trim())}
                        >
                            <UserPlus size={16} /> Asignar
                        </button>
                    </form>
                )}
            </div>

            {/* Semáforo de tareas */}
            <div className="health-summary card">
                <h3>Semáforo de Tareas</h3>
                <div className="health-grid">
                    <div className="health-item green">
                        <span className="health-num">{health.green}</span>
                        <span className="health-text">🟢 En curso</span>
                    </div>
                    <div className="health-item yellow">
                        <span className="health-num">{health.yellow}</span>
                        <span className="health-text">🟡 Advertencia</span>
                    </div>
                    <div className="health-item red">
                        <span className="health-num">{health.red}</span>
                        <span className="health-text">🔴 Bloqueada</span>
                    </div>
                </div>
                <p className="health-hint text-secondary">
                    Amarillo = sin avance en 2 semanas · Rojo = obstáculo/bloqueo (manual)
                </p>
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

            {/* Edit Modal */}
            {showEditModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Editar Proyecto</h3>
                            <button className="btn-icon" onClick={() => setShowEditModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Nombre del Proyecto</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Descripción</label>
                                <textarea
                                    value={editForm.description}
                                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                    rows="3"
                                />
                            </div>
                            <div className="form-group">
                                <label>Estado</label>
                                <select
                                    value={editForm.status}
                                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                                >
                                    <option>En Progreso</option>
                                    <option>Planificación</option>
                                    <option>Completado</option>
                                    <option>En Pausa</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Fecha Límite</label>
                                <input
                                    type="date"
                                    value={editForm.due_date}
                                    onChange={e => setEditForm({ ...editForm, due_date: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Owner de la Iniciativa</label>
                                <input
                                    type="text"
                                    placeholder="Nombre del owner"
                                    value={editForm.owner_name}
                                    onChange={e => setEditForm({ ...editForm, owner_name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Email del Owner</label>
                                <input
                                    type="email"
                                    placeholder="owner@ejemplo.com"
                                    value={editForm.owner_email}
                                    onChange={e => setEditForm({ ...editForm, owner_email: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Teléfono del Owner</label>
                                <input
                                    type="tel"
                                    placeholder="+56 9 ..."
                                    value={editForm.owner_phone}
                                    onChange={e => setEditForm({ ...editForm, owner_phone: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn" onClick={() => setShowEditModal(false)}>
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={isSaving || !editForm.name.trim()}
                            >
                                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProjectSummary;
