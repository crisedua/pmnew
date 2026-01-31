import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, X, Folder, Share2, Copy, Trash2, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AIAssistant from '../components/AIAssistant';
import './Dashboard.css';

function Dashboard() {
    const navigate = useNavigate();
    const [areas, setAreas] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedArea, setSelectedArea] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

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
        document.body.className = 'dark';
        checkUser();
    }, []);

    useEffect(() => {
        if (user) {
            fetchAreas();
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
            // Fetch areas where user is a member
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

            // Select first area by default if none selected
            if (areasList.length > 0 && !selectedArea) {
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
                .select('*, tasks(id, status)')
                .eq('area_id', areaId);

            if (error) throw error;

            // Calculate progress
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

            // Reset
            setNewArea({ name: '', description: '' });
            setShowAreaModal(false);
            fetchAreas(); // Refresh list
        } catch (error) {
            console.error('Error creating area:', error);
            alert('Error creating area');
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
            alert('Error creating project');
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
        alert('Enlace de invitación copiado al portapapeles!');
    };

    if (loading) return <div className="loading">Cargando...</div>;

    return (
        <div className="dashboard-layout">
            {/* Sidebar - Areas */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="app-logo-sm">📊</div>
                    <h3>Portal PM</h3>
                </div>

                <div className="areas-list">
                    <div className="flex-between px-md mb-sm">
                        <span className="text-secondary text-sm font-bold">MIS ÁREAS</span>
                        <button className="btn-icon-sm" onClick={() => setShowAreaModal(true)}>
                            <Plus size={16} />
                        </button>
                    </div>

                    {areas.map(area => (
                        <div
                            key={area.id}
                            className={`area-item ${selectedArea?.id === area.id ? 'active' : ''}`}
                            onClick={() => setSelectedArea(area)}
                        >
                            <Folder size={18} />
                            <span className="truncate">{area.name}</span>
                            {selectedArea?.id === area.id && (
                                <ChevronRight size={16} className="ml-auto" />
                            )}
                        </div>
                    ))}

                    {areas.length === 0 && (
                        <div className="text-center p-md text-secondary text-sm">
                            No tienes áreas. Crea una para comenzar.
                        </div>
                    )}
                </div>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="avatar">{user.email[0].toUpperCase()}</div>
                        <div className="truncate">
                            <div className="text-sm font-bold truncate">{user.email}</div>
                        </div>
                    </div>
                    <button className="btn-icon" onClick={handleLogout}>
                        <LogOut size={18} />
                    </button>
                </div>
            </aside>

            {/* Main Content - Projects */}
            <main className="main-content">
                {selectedArea ? (
                    <>
                        <header className="area-header flex-between">
                            <div>
                                <h1>{selectedArea.name}</h1>
                                <p className="text-secondary">{selectedArea.description || 'Sin descripción'}</p>
                            </div>
                            <div className="flex gap-md">
                                <button
                                    className="btn btn-outline"
                                    onClick={() => copyInviteLink(selectedArea.share_token)}
                                >
                                    <Share2 size={16} />
                                    Invitar Miembros
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowProjectModal(true)}
                                >
                                    <Plus size={16} />
                                    Nuevo Proyecto
                                </button>
                            </div>
                        </header>

                        <div className="projects-grid">
                            {projects.map(project => (
                                <div
                                    key={project.id}
                                    className="project-card card"
                                    onClick={() => navigate(`/project/${project.id}`)}
                                >
                                    <div className="project-card-header">
                                        <h3 className="project-name">{project.name}</h3>
                                        <span className={`badge badge-${project.status === 'En Progreso' ? 'primary' : 'secondary'}`}>
                                            {project.status}
                                        </span>
                                    </div>

                                    <div className="project-progress mt-md">
                                        <div className="flex-between mb-xs">
                                            <span className="text-xs text-secondary">Progreso</span>
                                            <span className="text-xs font-bold">{project.progress}%</span>
                                        </div>
                                        <div className="progress-bar">
                                            <div className="progress-fill" style={{ width: `${project.progress}%` }}></div>
                                        </div>
                                    </div>

                                    <div className="project-footer mt-md pt-sm border-top flex-between text-secondary text-sm">
                                        <span>{project.taskCount} tareas</span>
                                        <span>{project.due_date || 'Sin fecha'}</span>
                                    </div>
                                </div>
                            ))}

                            {projects.length === 0 && (
                                <div className="empty-state-card card">
                                    <p>No hay proyectos en esta área.</p>
                                    <button className="btn-link" onClick={() => setShowProjectModal(true)}>
                                        Crear primer proyecto
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="empty-dashboard">
                        <h2>Bienvenido al Portal</h2>
                        <p className="text-secondary mb-lg">Selecciona un área o crea una nueva para gestionar tus proyectos.</p>
                        <button className="btn btn-primary btn-lg" onClick={() => setShowAreaModal(true)}>
                            <Plus size={20} />
                            Crear Nueva Área
                        </button>
                    </div>
                )}
            </main>

            {/* Create Area Modal */}
            {showAreaModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Nueva Área</h3>
                            <button
                                className="btn-icon"
                                onClick={() => setShowAreaModal(false)}
                            >
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

            {/* Create Project Modal */}
            {showProjectModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Nuevo Proyecto en {selectedArea?.name}</h3>
                            <button
                                className="btn-icon"
                                onClick={() => setShowProjectModal(false)}
                            >
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
            {selectedArea && (
                <AIAssistant
                    areaId={selectedArea.id}
                    projects={projects}
                    tasks={projects.flatMap(p => p.tasks || [])}
                    documents={[]}
                    onAction={() => fetchProjects(selectedArea.id)}
                />
            )}
        </div>
    );
}

export default Dashboard;
