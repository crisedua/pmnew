import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LogOut, Plus, X, Folder, Share2, ChevronRight, ChevronDown,
    Search, Bell, FileText, LayoutDashboard, Inbox, BarChart3,
    Settings, FolderPlus, CheckSquare, UserPlus, HelpCircle,
    Check, Calendar, Flag, Trash2, ListChecks,
    LayoutGrid, Activity, Video, Shield, Users, File, Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import AIAssistant from '../components/AIAssistant';
import ProjectCards from '../components/ProjectCards';
import Iniciativas from '../components/Iniciativas';
import IniciativasBoard from '../components/IniciativasBoard';
import OwnersView from '../components/OwnersView';
import KpisView from '../components/KpisView';
import TimelineView from '../components/TimelineView';
import ActividadView from '../components/ActividadView';
import Placeholder from '../components/Placeholder';
import { fetchIsAdmin } from '../lib/admin';
import { fetchProjectKpis, fetchComisionKpi } from '../lib/kpis';
import './Dashboard.css';

function Dashboard() {
    const navigate = useNavigate();
    const [areas, setAreas] = useState([]);
    const [projects, setProjects] = useState([]);
    const [projectKpis, setProjectKpis] = useState({});
    const [comisionKpi, setComisionKpi] = useState(null);
    const [allTasks, setAllTasks] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [selectedArea, setSelectedArea] = useState(null);
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expandedProjects, setExpandedProjects] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [activeView, setActiveView] = useState('iniciativas');
    const [initiatives, setInitiatives] = useState([]);
    const [showAreaDropdown, setShowAreaDropdown] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

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
        status: 'En Progreso',
        owner_name: '',
        owner_email: ''
    });

    useEffect(() => {
        checkUser();
    }, []);

    useEffect(() => {
        if (user) {
            (async () => {
                const admin = await fetchIsAdmin(user.id);
                setIsAdmin(admin);
                fetchAreas(admin);
                fetchAllTasks();
            })();
        }
    }, [user]);

    useEffect(() => {
        if (areas.length > 0) {
            fetchInitiatives();
        }
    }, [areas]);

    useEffect(() => {
        if (selectedArea) {
            fetchProjects(selectedArea.id);
            fetchAreaKpis(selectedArea.id);
        } else {
            setProjects([]);
            setProjectKpis({});
            setComisionKpi(null);
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

    const fetchAreas = async (admin = isAdmin) => {
        try {
            let areasList = [];

            if (admin) {
                // Los admins de plataforma ven TODAS las comisiones, no solo
                // las de las que son miembros. Requiere la política RLS
                // "Admins can view all areas" (supabase-admin-visibility.sql).
                const { data, error } = await supabase
                    .from('areas')
                    .select('id, name, description, share_token, created_by');
                if (error) throw error;
                areasList = (data || []).map(a => ({ ...a, role: 'owner' }));
            } else {
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
                areasList = data
                    .map(item => ({ ...item.areas, role: item.role }))
                    .filter(a => a && a.id);
            }

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
                .select('*, tasks(id, title, status, priority, due_date, health, health_note, last_progress_at, updated_at, created_at)')
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

    const fetchAreaKpis = async (areaId) => {
        // KPIs calculados en el servidor (vistas kpi_*). Si el SQL aún no se
        // ha ejecutado, los helpers devuelven vacío y la UI degrada al
        // cálculo cliente sin romperse.
        const [rows, comK] = await Promise.all([
            fetchProjectKpis(areaId),
            fetchComisionKpi(areaId),
        ]);
        const byId = {};
        rows.forEach(r => { byId[r.proyecto_id] = r; });
        setProjectKpis(byId);
        setComisionKpi(comK);
    };

    const fetchInitiatives = async () => {
        try {
            const areaIds = areas.map(a => a.id);
            if (areaIds.length === 0) {
                setInitiatives([]);
                return;
            }
            const { data, error } = await supabase
                .from('projects')
                .select('id, name, area_id, status, codigo, linea, owner_name, owner_email, responsible_email, created_at, updated_at, tasks(id, status, health, last_progress_at, updated_at, created_at)')
                .in('area_id', areaIds);

            if (error) throw error;
            setInitiatives(data || []);
        } catch (error) {
            console.error('Error fetching initiatives:', error);
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
            await fetchAreas();
            // Selecciona automáticamente la comisión recién creada (el creador es owner)
            if (data) setSelectedArea({ ...data, role: 'owner' });
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
                    owner_name: newProject.owner_name || null,
                    owner_email: newProject.owner_email || null,
                    created_by: user.id
                });

            if (error) throw error;

            setNewProject({ name: '', description: '', due_date: '', status: 'En Progreso', owner_name: '', owner_email: '' });
            setShowProjectModal(false);
            fetchProjects(selectedArea.id);
            fetchInitiatives();
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
                    <div
                        className="workspace-selector"
                        onClick={() => setShowAreaDropdown(v => !v)}
                        title="Cambiar de comisión"
                    >
                        <img
                            src="https://www.asiva.cl/wp-content/uploads/2023/05/Asiva-Logo-blanco.png"
                            alt="ASIVA"
                            className="workspace-logo"
                            onError={(e) => { e.currentTarget.src = '/asiva-logo.svg'; }}
                        />
                        <span className="workspace-name">{selectedArea?.name || 'Selecciona comisión'}</span>
                        <ChevronDown size={16} />
                    </div>

                    {showAreaDropdown && (
                        <div className="area-dropdown">
                            <div className="area-dropdown-label">Comisiones</div>
                            {areas.length === 0 && (
                                <div className="area-dropdown-empty">No tienes comisiones todavía</div>
                            )}
                            {areas.map(area => (
                                <button
                                    key={area.id}
                                    className={`area-dropdown-item ${selectedArea?.id === area.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedArea(area);
                                        setShowAreaDropdown(false);
                                    }}
                                >
                                    <Folder size={14} />
                                    <span>{area.name}</span>
                                    {selectedArea?.id === area.id && <Check size={14} className="area-check" />}
                                </button>
                            ))}
                            <button
                                className="area-dropdown-new"
                                onClick={() => {
                                    setShowAreaDropdown(false);
                                    setShowAreaModal(true);
                                }}
                            >
                                <Plus size={14} /> Nueva Comisión
                            </button>
                        </div>
                    )}
                </div>

                {isAdmin && (
                    <button className="btn-add-new" onClick={() => setShowProjectModal(true)}>
                        <Plus size={18} />
                        Añadir Nuevo
                    </button>
                )}

                <div className="sidebar-nav-label">Workspace</div>
                <nav className="sidebar-nav">
                    <a
                        className={`nav-item ${activeView === 'iniciativas' ? 'active' : ''}`}
                        onClick={() => setActiveView('iniciativas')}
                    >
                        <ListChecks size={18} />
                        Iniciativas
                        <span className="nav-count">{initiatives.length}</span>
                    </a>
                    <a
                        className={`nav-item ${activeView === 'tablero' ? 'active' : ''}`}
                        onClick={() => setActiveView('tablero')}
                    >
                        <LayoutGrid size={18} />
                        Tablero
                    </a>
                    <a
                        className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveView('dashboard')}
                    >
                        <Activity size={18} />
                        Dashboard
                    </a>
                    <a
                        className={`nav-item ${activeView === 'timeline' ? 'active' : ''}`}
                        onClick={() => setActiveView('timeline')}
                    >
                        <Calendar size={18} />
                        Timeline
                    </a>
                    <a
                        className={`nav-item ${activeView === 'reunion' ? 'active' : ''}`}
                        onClick={() => setActiveView('reunion')}
                    >
                        <Video size={18} />
                        Vista Reunion
                    </a>
                </nav>

                <div className="sidebar-nav-label">Gestion</div>
                <nav className="sidebar-nav">
                    <a
                        className={`nav-item ${activeView === 'kpis' ? 'active' : ''}`}
                        onClick={() => setActiveView('kpis')}
                    >
                        <FileText size={18} />
                        KPIs & Sesiones
                    </a>
                    <a
                        className={`nav-item ${activeView === 'decisiones' ? 'active' : ''}`}
                        onClick={() => setActiveView('decisiones')}
                    >
                        <Shield size={18} />
                        Decisiones
                    </a>
                    <a
                        className={`nav-item ${activeView === 'owners' ? 'active' : ''}`}
                        onClick={() => setActiveView('owners')}
                    >
                        <Users size={18} />
                        Owners
                    </a>
                    <a
                        className={`nav-item ${activeView === 'reporte' ? 'active' : ''}`}
                        onClick={() => setActiveView('reporte')}
                    >
                        <File size={18} />
                        Reporte
                    </a>
                    <a
                        className={`nav-item ${activeView === 'actividad' ? 'active' : ''}`}
                        onClick={() => setActiveView('actividad')}
                    >
                        <Clock size={18} />
                        Actividad
                    </a>
                </nav>

                <div className="sidebar-spacer" />

                <div className="sidebar-footer">
                    {isAdmin && (
                        <button className="btn-footer" onClick={() => copyInviteLink(selectedArea?.share_token)}>
                            <UserPlus size={16} />
                            Invitar Equipo
                        </button>
                    )}
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
                        <div className="user-menu">
                            <div
                                className="user-avatar"
                                onClick={() => setShowUserMenu(v => !v)}
                                title="Cuenta"
                            >
                                {user?.email?.[0]?.toUpperCase() || 'U'}
                            </div>
                            {showUserMenu && (
                                <>
                                    <div className="user-menu-backdrop" onClick={() => setShowUserMenu(false)} />
                                    <div className="user-menu-dropdown">
                                        <div className="user-menu-info">
                                            <div className="user-menu-avatar">
                                                {user?.email?.[0]?.toUpperCase() || 'U'}
                                            </div>
                                            <div className="user-menu-details">
                                                <span className="user-menu-name">
                                                    {user?.user_metadata?.full_name || 'Usuario'}
                                                </span>
                                                <span className="user-menu-email">{user?.email}</span>
                                                {isAdmin && <span className="user-menu-role">Administrador</span>}
                                            </div>
                                        </div>
                                        <button className="user-menu-logout" onClick={handleLogout}>
                                            <LogOut size={16} />
                                            Cerrar sesión
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Main view content */}
                <div className="dashboard-content">
                    {activeView === 'iniciativas' ? (
                        <Iniciativas
                            initiatives={initiatives}
                            onOpen={(projectId) => navigate(`/project/${projectId}`)}
                            onBoard={() => setActiveView('tablero')}
                            isAdmin={isAdmin}
                            onAdmin={() => navigate('/admin')}
                        />
                    ) : activeView === 'tablero' ? (
                        <IniciativasBoard
                            initiatives={initiatives}
                            onOpen={(projectId) => navigate(`/project/${projectId}`)}
                            onList={() => setActiveView('iniciativas')}
                            isAdmin={isAdmin}
                            onAdmin={() => navigate('/admin')}
                        />
                    ) : activeView === 'owners' ? (
                        <OwnersView
                            initiatives={initiatives}
                            onOpen={(projectId) => navigate(`/project/${projectId}`)}
                        />
                    ) : activeView === 'timeline' ? (
                        <TimelineView
                            initiatives={initiatives}
                            onOpen={(projectId) => navigate(`/project/${projectId}`)}
                        />
                    ) : activeView === 'kpis' ? (
                        <KpisView
                            initiatives={initiatives}
                            onOpen={(projectId) => navigate(`/project/${projectId}`)}
                        />
                    ) : activeView === 'actividad' ? (
                        <ActividadView
                            initiatives={initiatives}
                            onOpen={(projectId) => navigate(`/project/${projectId}`)}
                        />
                    ) : activeView === 'reunion' ? (
                        <Placeholder title="Vista Reunión" subtitle="Modo presentación para revisar iniciativas en reuniones." />
                    ) : activeView === 'decisiones' ? (
                        <Placeholder title="Decisiones" subtitle="Bitácora de decisiones tomadas por la comisión." />
                    ) : activeView === 'reporte' ? (
                        <Placeholder title="Reporte" subtitle="Reporte ejecutivo del avance de la comisión." />
                    ) : (
                        <>
                            <h1 className="page-title">
                                {selectedArea ? selectedArea.name : 'Dashboard'}
                            </h1>

                            {/* Quick Actions (solo administradores) */}
                            {isAdmin && (
                                <div className="quick-actions">
                                    <div className="action-card" onClick={() => setShowProjectModal(true)}>
                                        <div className="action-icon blue">
                                            <FolderPlus size={24} />
                                        </div>
                                        <div className="action-text">
                                            <strong>Crear Subcomisión</strong>
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
                                </div>
                            )}

                            {/* Resumen calculado de la comisión (vista kpi_comision) */}
                            {selectedArea && comisionKpi && (
                                <div className="comision-summary">
                                    <div className="comision-summary-main">
                                        <span className="comision-summary-label">Avance global</span>
                                        <span className="comision-summary-value">{comisionKpi.avance_global_pct}%</span>
                                        <div className="comision-summary-bar">
                                            <div
                                                className="comision-summary-fill"
                                                style={{ width: `${comisionKpi.avance_global_pct}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="comision-summary-stats">
                                        <div className="summary-stat">
                                            <strong>{comisionKpi.proyectos_total}</strong>
                                            <span>Subcomisiones</span>
                                        </div>
                                        <div className="summary-stat ok">
                                            <strong>{comisionKpi.proyectos_completados}</strong>
                                            <span>Completados</span>
                                        </div>
                                        <div className="summary-stat warn">
                                            <strong>{comisionKpi.proyectos_en_riesgo}</strong>
                                            <span>En riesgo</span>
                                        </div>
                                        <div className="summary-stat danger">
                                            <strong>{comisionKpi.proyectos_atrasados}</strong>
                                            <span>Atrasados</span>
                                        </div>
                                        <div className="summary-stat danger">
                                            <strong>{comisionKpi.actividades_vencidas}</strong>
                                            <span>Act. vencidas</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tarjetas de proyectos con su KPI */}
                            {selectedArea && (
                                <>
                                    <h2 className="section-title">Subcomisiones de {selectedArea.name}</h2>
                                    <ProjectCards
                                        projects={projects}
                                        kpisById={projectKpis}
                                        onOpen={(projectId) => navigate(`/project/${projectId}`)}
                                    />
                                </>
                            )}

                            {/* Task Tables */}
                            <div className="tables-grid">
                                {/* To Do This Week */}
                                <div className="task-table-card">
                                    <h3>Por hacer esta semana</h3>
                                    <table className="task-table">
                                        <thead>
                                            <tr>
                                                <th>Nombre</th>
                                                <th>Subcomisión</th>
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
                                                <th>Subcomisión</th>
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
                                    placeholder="Para gestionar subcomisiones de..."
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
                            <h3>Nueva Subcomisión en {selectedArea?.name}</h3>
                            <button className="btn-icon" onClick={() => setShowProjectModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Nombre de la Subcomisión</label>
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
                            <div className="form-group">
                                <label>Responsable</label>
                                <input
                                    type="text"
                                    value={newProject.owner_name}
                                    onChange={e => setNewProject({ ...newProject, owner_name: e.target.value })}
                                    placeholder="Nombre de la persona a cargo"
                                />
                            </div>
                            <div className="form-group">
                                <label>Email del responsable</label>
                                <input
                                    type="email"
                                    value={newProject.owner_email}
                                    onChange={e => setNewProject({ ...newProject, owner_email: e.target.value })}
                                    placeholder="email@ejemplo.com"
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
                                Crear Subcomisión
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
