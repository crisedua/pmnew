import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LogOut, Plus, X, Folder, Share2, ChevronRight, ChevronDown,
    Search, Bell, FileText, LayoutDashboard, Inbox, Users, BarChart3,
    Settings, FolderPlus, CheckSquare, UserPlus, MessageSquare, HelpCircle,
    Check, Calendar, Flag
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import AIAssistant from '../components/AIAssistant';
import WhatsAppAnalyzer from '../components/WhatsAppAnalyzer';
import './Dashboard.css';

function Dashboard() {
    const navigate = useNavigate();
    const [areas, setAreas] = useState([]);
    const [projects, setProjects] = useState([]);
    const [allTasks, setAllTasks] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [selectedArea, setSelectedArea] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedProjects, setExpandedProjects] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [activeView, setActiveView] = useState('dashboard');

    // Modals
    const [showAreaModal, setShowAreaModal] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Form states
    const [newArea, setNewArea] = useState({ name: '', description: '' });
    const [newProject, setNewProject] = useState({
        name: '',
        description: '',
        due_date: '',
        status: 'En Progreso'
    });

    useEffect(() => {
        checkUser();
    }, []);

    useEffect(() => {
        if (user) {
            fetchAreas();
            fetchAllTasks();
        }
    }, [user]);

    useEffect(() => {
        if (selectedArea) {
            fetchProjects(selectedArea.id);
        } else {
            setProjects([]);
        }
    }, [selectedArea]);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUser(user);
        } else {
            navigate('/login');
        }
    };

    const fetchAreas = async () => {
        try {
            const { data, error } = await supabase
                .from('area_members')
                .select(`
                    area_id,
                    role,
                    areas (
                        id,
                        name,
                        description,
                        share_token,
                        created_by
                    )
                `)
                .eq('user_id', user.id);

            if (error) throw error;

            const areasList = data.map(item => ({
                ...item.areas,
                role: item.role
            }));

            setAreas(areasList);

            // Check for areaId in URL query params
            const searchParams = new URLSearchParams(window.location.search);
            const targetAreaId = searchParams.get('areaId');

            if (targetAreaId) {
                const targetArea = areasList.find(a => a.id === targetAreaId);
                if (targetArea) {
                    setSelectedArea(targetArea);
                    // Optional: Clean up URL
                    window.history.replaceState({}, '', '/dashboard');
                } else if (areasList.length > 0 && !selectedArea) {
                    setSelectedArea(areasList[0]);
                }
            } else if (areasList.length > 0 && !selectedArea) {
                setSelectedArea(areasList[0]);
            }

        } catch (error) {
            console.error('Error fetching areas:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProjects = async (areaId) => {
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*, tasks(id, title, status, priority, due_date)')
                .eq('area_id', areaId);

            if (error) throw error;

            const projectsWithProgress = data.map(project => {
                const tasks = project.tasks || [];
                const completed = tasks.filter(t => t.status === 'Complete').length;
                const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
                return { ...project, taskCount: tasks.length, progress };
            });

            setProjects(projectsWithProgress);
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    };

    const fetchAllTasks = async () => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*, projects(name)')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setAllTasks(data || []);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    };

    const handleCreateArea = async () => {
        if (!newArea.name.trim()) return;
        setIsCreating(true);

        try {
            const { data, error } = await supabase
                .from('areas')
                .insert({
                    name: newArea.name,
                    description: newArea.description,
                    created_by: user.id
                })
                .select()
                .single();

            if (error) throw error;

            setNewArea({ name: '', description: '' });
            setShowAreaModal(false);
            fetchAreas();
        } catch (error) {
            console.error('Error creating area:', error);
            alert('Error creating area: ' + (error.message || JSON.stringify(error)));
        } finally {
            setIsCreating(false);
        }
    };

    const handleCreateProject = async () => {
        if (!newProject.name.trim() || !selectedArea) return;
        setIsCreating(true);

        try {
            const { error } = await supabase
                .from('projects')
                .insert({
                    area_id: selectedArea.id,
                    name: newProject.name,
                    description: newProject.description,
                    status: newProject.status,
                    due_date: newProject.due_date || null,
                    created_by: user.id
                });

            if (error) throw error;

            setNewProject({ name: '', description: '', due_date: '', status: 'En Progreso' });
            setShowProjectModal(false);
            fetchProjects(selectedArea.id);
        } catch (error) {
            console.error('Error creating project:', error);
            alert('Error creating project: ' + (error.message || JSON.stringify(error)));
        } finally {
            setIsCreating(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const copyInviteLink = (token) => {
        const link = `${window.location.origin}/join/${token}`;
        navigator.clipboard.writeText(link);
        alert('Enlace de invitación copiado!');
    };

    const toggleProjectExpand = (projectId) => {
        setExpandedProjects(prev => ({
            ...prev,
            [projectId]: !prev[projectId]
        }));
    };

    const todoTasks = allTasks.filter(t => t.status !== 'Complete').slice(0, 5);
    const reviewTasks = allTasks.filter(t => t.status === 'In Review' || t.status === 'En Revisión').slice(0, 5);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('es', { month: 'short', day: 'numeric' }) + ' - ' +
            date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'Alta': return '#ef4444';
            case 'Media': return '#f59e0b';
            case 'Baja': return '#22c55e';
            default: return '#6b7280';
        }
    };

    if (loading) return <div className="loading">Cargando...</div>;

    return (
        <div className="dashboard-layout taskboard">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="workspace-selector">
                        <div className="workspace-icon">📊</div>
                        <span className="workspace-name">{selectedArea?.name || 'TaskBoard'}</span>
                        <ChevronDown size={16} />
                    </div>
                </div>

                <button className="btn-add-new" onClick={() => setShowProjectModal(true)}>
                    <Plus size={18} />
                    Añadir Nuevo
                </button>

                <nav className="sidebar-nav">
                    <a
                        className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveView('dashboard')}
                    >
                        <LayoutDashboard size={18} />
                        Dashboard
                    </a>
                    <a
                        className={`nav-item ${activeView === 'whatsapp' ? 'active' : ''}`}
                        onClick={() => setActiveView('whatsapp')}
                    >
                        <MessageSquare size={18} />
                        Análisis WhatsApp
                    </a>
                    <a className="nav-item">
                        <Users size={18} />
                        Teams
                    </a>
                    <a className="nav-item">
                        <BarChart3 size={18} />
                        Analytics
                    </a>
                    <a className="nav-item">
                        <Settings size={18} />
                        Settings
                    </a>
                </nav>

                <div className="sidebar-section">
                    <div className="section-header">
                        <span>Añadir Proyectos</span>
                        <button className="btn-icon-sm" onClick={() => setShowProjectModal(true)}>
                            <Plus size={14} />
                        </button>
                    </div>

                    {projects.map(project => (
                        <div key={project.id} className="project-item">
                            <div
                                className="project-header"
                                onClick={() => toggleProjectExpand(project.id)}
                            >
                                {expandedProjects[project.id] ?
                                    <ChevronDown size={16} /> :
                                    <ChevronRight size={16} />
                                }
                                <Folder size={16} />
                                <span
                                    className="project-name-link"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/project/${project.id}`);
                                    }}
                                >
                                    {project.name}
                                </span>
                            </div>
                            {expandedProjects[project.id] && project.tasks && (
                                <div className="project-tasks">
                                    {project.tasks.slice(0, 3).map(task => (
                                        <div key={task.id} className="task-mini">
                                            <Flag size={12} style={{ color: getPriorityColor(task.priority) }} />
                                            <span>{task.title}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="sidebar-footer">
                    <button className="btn-footer" onClick={() => copyInviteLink(selectedArea?.share_token)}>
                        <UserPlus size={16} />
                        Invite Team
                    </button>
                    <button className="btn-footer">
                        <HelpCircle size={16} />
                        Help
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {/* Top Header */}
                <header className="top-header">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="header-actions">
                        <button className="btn-icon">
                            <FileText size={20} />
                        </button>
                        <button className="btn-icon">
                            <Bell size={20} />
                        </button>
                        <div className="user-avatar" onClick={handleLogout} title="Cerrar sesión">
                            {user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                    </div>
                </header>

                {/* Dashboard Content */}
                <div className="dashboard-content">
                    {activeView === 'whatsapp' ? (
                        <>
                            <h1 className="page-title">Análisis WhatsApp - {selectedArea?.name}</h1>
                            {selectedArea ? (
                                <WhatsAppAnalyzer areaId={selectedArea.id} />
                            ) : (
                                <div className="empty-state">
                                    <p>Selecciona un área para comenzar.</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <h1 className="page-title">Dashboard</h1>

                            {/* Quick Actions */}
                            <div className="quick-actions">
                                <div className="action-card" onClick={() => setShowProjectModal(true)}>
                                    <div className="action-icon blue">
                                        <FolderPlus size={24} />
                                    </div>
                                    <div className="action-text">
                                        <strong>Crear Proyecto</strong>
                                        <span>Organiza tus tareas</span>
                                    </div>
                                </div>
                                <div className="action-card" onClick={() => projects[0] && navigate(`/project/${projects[0].id}`)}>
                                    <div className="action-icon purple">
                                        <CheckSquare size={24} />
                                    </div>
                                    <div className="action-text">
                                        <strong>Crear Tarea</strong>
                                        <span>Organiza tus tareas</span>
                                    </div>
                                </div>
                                <div className="action-card" onClick={() => copyInviteLink(selectedArea?.share_token)}>
                                    <div className="action-icon green">
                                        <UserPlus size={24} />
                                    </div>
                                    <div className="action-text">
                                        <strong>Invitar Equipo</strong>
                                        <span>Organiza tus tareas</span>
                                    </div>
                                </div>
                                <div className="action-card" onClick={() => setActiveView('whatsapp')}>
                                    <div className="action-icon orange">
                                        <MessageSquare size={24} />
                                    </div>
                                    <div className="action-text">
                                        <strong>Analizar WhatsApp</strong>
                                        <span>Organiza tus tareas</span>
                                    </div>
                                </div>
                            </div>

                            {/* Task Tables */}
                            <div className="tables-grid">
                                {/* To Do This Week */}
                                <div className="task-table-card">
                                    <h3>Por hacer esta semana</h3>
                                    <table className="task-table">
                                        <thead>
                                            <tr>
                                                <th>Nombre</th>
                                                <th>Proyecto</th>
                                                <th>Fecha</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {todoTasks.map(task => (
                                                <tr key={task.id}>
                                                    <td>
                                                        <div className="task-name">
                                                            <Flag size={14} style={{ color: getPriorityColor(task.priority) }} />
                                                            {task.title}
                                                        </div>
                                                    </td>
                                                    <td>{task.projects?.name || '-'}</td>
                                                    <td>{formatDate(task.due_date) || 'Add date'}</td>
                                                </tr>
                                            ))}
                                            {todoTasks.length === 0 && (
                                                <tr>
                                                    <td colSpan="3" className="empty-cell">No hay tareas pendientes</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* To Review */}
                                <div className="task-table-card">
                                    <h3>Por revisar</h3>
                                    <table className="task-table">
                                        <thead>
                                            <tr>
                                                <th>Nombre</th>
                                                <th>Proyecto</th>
                                                <th>Fecha</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reviewTasks.map(task => (
                                                <tr key={task.id}>
                                                    <td>
                                                        <div className="task-name">
                                                            <Check size={14} className="check-green" />
                                                            {task.title}
                                                        </div>
                                                    </td>
                                                    <td>{task.projects?.name || '-'}</td>
                                                    <td>{formatDate(task.due_date) || 'Add date'}</td>
                                                </tr>
                                            ))}
                                            {reviewTasks.length === 0 && (
                                                <tr>
                                                    <td colSpan="3" className="empty-cell">No hay tareas para revisar</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className="activity-section">
                                <div className="section-header-row">
                                    <h3>Actividad Reciente</h3>
                                    <a className="view-all">Ver Todo</a>
                                </div>
                                <div className="activity-list">
                                    {projects.map(project => (
                                        <div key={project.id} className="activity-item">
                                            <div className="activity-icon">
                                                <Check size={14} />
                                            </div>
                                            <div className="activity-content">
                                                <strong>{project.name}</strong> - {project.taskCount} tareas
                                                <span className="activity-time">Progreso: {project.progress}%</span>
                                            </div>
                                        </div>
                                    ))}
                                    {projects.length === 0 && (
                                        <div className="activity-item">
                                            <span className="text-secondary">No hay actividad reciente</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Task Progress Overview */}
                            <div className="progress-section">
                                <div className="section-header-row">
                                    <h3>Resumen de Progreso</h3>
                                    <a className="view-all">Ver Todo</a>
                                </div>
                                <div className="progress-cards">
                                    {projects.map(project => (
                                        <div key={project.id} className="progress-card" onClick={() => navigate(`/project/${project.id}`)}>
                                            <div className="progress-info">
                                                <span className="progress-name">{project.name}</span>
                                                <span className="progress-percent">{project.progress}%</span>
                                            </div>
                                            <div className="progress-bar-sm">
                                                <div
                                                    className="progress-fill"
                                                    style={{ width: `${project.progress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>

            {/* Modals */}
            {showAreaModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Nueva Área</h3>
                            <button className="btn-icon" onClick={() => setShowAreaModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Nombre del Área</label>
                                <input
                                    type="text"
                                    value={newArea.name}
                                    onChange={e => setNewArea({ ...newArea, name: e.target.value })}
                                    placeholder="Ej: Marketing, Ingeniería"
                                />
                            </div>
                            <div className="form-group">
                                <label>Descripción</label>
                                <textarea
                                    value={newArea.description}
                                    onChange={e => setNewArea({ ...newArea, description: e.target.value })}
                                    placeholder="Para gestionar proyectos de..."
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn" onClick={() => setShowAreaModal(false)}>Cancelar</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCreateArea}
                                disabled={isCreating || !newArea.name.trim()}
                            >
                                Crear Área
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showProjectModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Nuevo Proyecto en {selectedArea?.name}</h3>
                            <button className="btn-icon" onClick={() => setShowProjectModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Nombre del Proyecto</label>
                                <input
                                    type="text"
                                    value={newProject.name}
                                    onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Estado</label>
                                <select
                                    value={newProject.status}
                                    onChange={e => setNewProject({ ...newProject, status: e.target.value })}
                                >
                                    <option>En Progreso</option>
                                    <option>Planificación</option>
                                    <option>Completado</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Fecha Límite</label>
                                <input
                                    type="date"
                                    value={newProject.due_date}
                                    onChange={e => setNewProject({ ...newProject, due_date: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn" onClick={() => setShowProjectModal(false)}>Cancelar</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCreateProject}
                                disabled={isCreating || !newProject.name.trim()}
                            >
                                Crear Proyecto
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Assistant */}
            {selectedArea && user && (
                <AIAssistant
                    areaId={selectedArea.id}
                    userId={user.id}
                    projects={projects}
                    tasks={allTasks}
                    documents={[]}
                    onAction={() => {
                        fetchProjects(selectedArea.id);
                        fetchAllTasks();
                    }}
                />
            )}
        </div>
    );
}

export default Dashboard;
