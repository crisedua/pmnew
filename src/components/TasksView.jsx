import React, { useState } from 'react';
import { Search, Plus, Calendar, Trash2, User, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './TasksView.css';

function TasksView({ tasks, projectId, onTasksUpdate }) {
    const [viewMode, setViewMode] = useState('kanban');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('Activas');
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        status: 'To Do',
        priority: 'Media',
        assignee_name: '',
        assignee_email: '',
        due_date: ''
    });

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
    };

    const getPriorityClass = (priority) => {
        const map = {
            'Alta': 'badge-alta',
            'Media': 'badge-media',
            'Baja': 'badge-baja'
        };
        return map[priority] || 'badge-media';
    };

    const getStatusBadgeClass = (status) => {
        const map = {
            'In Progress': 'status-in-progress',
            'To Do': 'status-pending',
            'Complete': 'status-complete'
        };
        return map[status] || '';
    };

    const getStatusLabel = (status) => {
        const map = {
            'In Progress': 'En Progreso',
            'To Do': 'Pendiente',
            'Complete': 'Completada'
        };
        return map[status] || status;
    };

    const handleCreateTask = async () => {
        if (!newTask.title.trim()) {
            alert('El título de la tarea es obligatorio');
            return;
        }

        setIsCreating(true);

        try {
            const { error } = await supabase
                .from('tasks')
                .insert({
                    project_id: projectId,
                    title: newTask.title,
                    description: newTask.description,
                    status: newTask.status,
                    priority: newTask.priority,
                    assignee_name: newTask.assignee_name,
                    assignee_email: newTask.assignee_email,
                    due_date: newTask.due_date || null
                });

            if (error) throw error;

            // Reset form
            setNewTask({
                title: '',
                description: '',
                status: 'To Do',
                priority: 'Media',
                assignee_name: '',
                assignee_email: '',
                due_date: ''
            });
            setShowTaskModal(false);

            // Refresh tasks
            if (onTasksUpdate) {
                await onTasksUpdate();
            }
        } catch (error) {
            console.error('Error creating task:', error);
            alert('Error al crear la tarea: ' + error.message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId);

            if (error) throw error;

            if (onTasksUpdate) {
                await onTasksUpdate();
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('Error al eliminar la tarea');
        }
    };

    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterStatus === 'Activas'
            ? task.status !== 'Complete'
            : true;
        return matchesSearch && matchesFilter;
    });

    const tasksByStatus = {
        'To Do': filteredTasks.filter(t => t.status === 'To Do'),
        'In Progress': filteredTasks.filter(t => t.status === 'In Progress'),
        'Complete': filteredTasks.filter(t => t.status === 'Complete')
    };

    const columnLabels = {
        'To Do': 'To Do',
        'In Progress': 'In Progress',
        'Complete': 'Complete'
    };

    return (
        <div className="tasks-view">
            {/* Toolbar */}
            <div className="tasks-toolbar">
                <div className="view-toggle">
                    <button
                        className={`toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
                        onClick={() => setViewMode('kanban')}
                    >
                        Kanban
                    </button>
                    <button
                        className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setViewMode('list')}
                    >
                        Lista
                    </button>
                </div>

                <div className="toolbar-actions">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <select
                        className="filter-select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option>Activas</option>
                        <option>Todas</option>
                    </select>

                    <button
                        className="btn btn-primary"
                        onClick={() => setShowTaskModal(true)}
                    >
                        <Plus size={18} />
                        Nueva Tarea
                    </button>
                </div>
            </div>

            {/* Kanban View */}
            {viewMode === 'kanban' && (
                <div className="kanban-board">
                    {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
                        <div key={status} className="kanban-column">
                            <div className="column-header">
                                <h3>{columnLabels[status]}</h3>
                                <span className="task-count">{statusTasks.length}</span>
                                <button
                                    className="btn-icon"
                                    onClick={() => {
                                        setNewTask({ ...newTask, status });
                                        setShowTaskModal(true);
                                    }}
                                >
                                    <Plus size={18} />
                                </button>
                            </div>

                            <div className="column-tasks">
                                {statusTasks.length === 0 ? (
                                    <div className="empty-column">Sin tareas</div>
                                ) : (
                                    statusTasks.map(task => (
                                        <div key={task.id} className="task-card card">
                                            <div className="task-card-header">
                                                <h4 className="task-title">{task.title}</h4>
                                                <button
                                                    className="btn-icon btn-delete-small"
                                                    onClick={() => handleDeleteTask(task.id)}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <div className="task-meta">
                                                <span className={`badge ${getPriorityClass(task.priority)}`}>
                                                    {task.priority}
                                                </span>
                                            </div>
                                            <div className="task-footer">
                                                <div className="flex gap-sm">
                                                    <User size={14} />
                                                    <span className="text-xs">{task.assignee_name}</span>
                                                </div>
                                                <div className="flex gap-sm">
                                                    <Calendar size={14} />
                                                    <span className="text-xs">{formatDate(task.due_date)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <div className="tasks-list">
                    <div className="list-header">
                        <h3>TAREAS ACTIVAS ({filteredTasks.length})</h3>
                    </div>

                    <div className="list-items">
                        {filteredTasks.map(task => (
                            <div key={task.id} className="list-item">
                                <input type="checkbox" className="task-checkbox" />

                                <div className="list-item-content">
                                    <h4 className="task-title">{task.title}</h4>
                                </div>

                                <span className={`badge ${getPriorityClass(task.priority)}`}>
                                    {task.priority}
                                </span>

                                <span className={`badge-status ${getStatusBadgeClass(task.status)}`}>
                                    {getStatusLabel(task.status)}
                                </span>

                                <div className="assignee-info">
                                    <span className="text-sm">{task.assignee_name}</span>
                                </div>

                                <div className="date-info flex gap-sm">
                                    <Calendar size={14} />
                                    <span className="text-sm">{formatDate(task.due_date)}</span>
                                </div>

                                <button
                                    className="btn-delete"
                                    onClick={() => handleDeleteTask(task.id)}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Task Modal */}
            {showTaskModal && (
                <div className="modal-overlay" onClick={() => !isCreating && setShowTaskModal(false)}>
                    <div className="modal-content task-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Nueva Tarea</h3>
                            <button
                                className="btn-icon"
                                onClick={() => setShowTaskModal(false)}
                                disabled={isCreating}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="form-group">
                                <label>Título *</label>
                                <input
                                    type="text"
                                    placeholder="Nombre de la tarea"
                                    value={newTask.title}
                                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                    disabled={isCreating}
                                />
                            </div>

                            <div className="form-group">
                                <label>Descripción</label>
                                <textarea
                                    placeholder="Detalles de la tarea"
                                    value={newTask.description}
                                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                    disabled={isCreating}
                                    rows="3"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Estado</label>
                                    <select
                                        value={newTask.status}
                                        onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                                        disabled={isCreating}
                                    >
                                        <option value="To Do">Pendiente</option>
                                        <option value="In Progress">En Progreso</option>
                                        <option value="Complete">Completada</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Prioridad</label>
                                    <select
                                        value={newTask.priority}
                                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                                        disabled={isCreating}
                                    >
                                        <option value="Baja">Baja</option>
                                        <option value="Media">Media</option>
                                        <option value="Alta">Alta</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Asignado a</label>
                                <input
                                    type="text"
                                    placeholder="Nombre del responsable"
                                    value={newTask.assignee_name}
                                    onChange={(e) => setNewTask({ ...newTask, assignee_name: e.target.value })}
                                    disabled={isCreating}
                                />
                            </div>

                            <div className="form-group">
                                <label>Email del responsable</label>
                                <input
                                    type="email"
                                    placeholder="email@ejemplo.com"
                                    value={newTask.assignee_email}
                                    onChange={(e) => setNewTask({ ...newTask, assignee_email: e.target.value })}
                                    disabled={isCreating}
                                />
                            </div>

                            <div className="form-group">
                                <label>Fecha límite</label>
                                <input
                                    type="date"
                                    value={newTask.due_date}
                                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                                    disabled={isCreating}
                                />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn"
                                onClick={() => setShowTaskModal(false)}
                                disabled={isCreating}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCreateTask}
                                disabled={isCreating || !newTask.title.trim()}
                            >
                                {isCreating ? 'Creando...' : 'Crear Tarea'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TasksView;
