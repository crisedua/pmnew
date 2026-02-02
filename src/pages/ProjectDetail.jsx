import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProjectSummary from '../components/ProjectSummary';
import TasksView from '../components/TasksView';
import DocumentsTab from '../components/DocumentsTab';
import TeamTab from '../components/TeamTab';
import AIAssistant from '../components/AIAssistant';
import './ProjectDetail.css';

function ProjectDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('tab') || 'resumen';
    });
    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [team, setTeam] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkUser();
        fetchProjectData();
    }, [id]);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
    };

    const fetchProjectData = async () => {
        try {
            // Fetch project
            const { data: projectData, error: projectError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', id)
                .single();

            if (projectError) throw projectError;
            setProject(projectData);

            // Fetch tasks
            const { data: tasksData, error: tasksError } = await supabase
                .from('tasks')
                .select('*')
                .eq('project_id', id);

            if (tasksError) throw tasksError;
            setTasks(tasksData || []);

            // Fetch documents
            const { data: docsData, error: docsError } = await supabase
                .from('documents')
                .select('*')
                .eq('project_id', id)
                .order('created_at', { ascending: false });

            if (docsError) throw docsError;
            setDocuments(docsData || []);

            // Fetch team
            const { data: teamData, error: teamError } = await supabase
                .from('team_members')
                .select('*')
                .eq('project_id', id);

            if (teamError) throw teamError;
            setTeam(teamData || []);

            // Fetch invitations
            const { data: invitesData, error: invitesError } = await supabase
                .from('project_invitations')
                .select('*')
                .eq('project_id', id)
                .order('created_at', { ascending: false });

            if (invitesError) {
                // Don't fail the whole page if invites fail (table might not exist yet)
                console.warn('Error fetching invites (table might be missing):', invitesError);
            }
            setInvitations(invitesData || []);

        } catch (error) {
            console.error('Error fetching project data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProject = async () => {
        if (!confirm('¿Estás seguro de que quieres eliminar este proyecto? Esta acción es irreversible y eliminará todos los datos asociados.')) {
            return;
        }

        try {
            setLoading(true);

            // Delete related records manually to ensure no FK constraints block deletion
            // (Even if ON DELETE CASCADE is set, this is safer if RLS policies are strict)
            await supabase.from('tasks').delete().eq('project_id', id);
            await supabase.from('documents').delete().eq('project_id', id);
            await supabase.from('team_members').delete().eq('project_id', id);
            await supabase.from('project_invitations').delete().eq('project_id', id);

            // Finally delete the project
            const { data, error } = await supabase
                .from('projects')
                .delete()
                .eq('id', id)
                .select();

            if (error) throw error;

            if (!data || data.length === 0) {
                // If no rows returned, deletion didn't happen (likely RLS)
                throw new Error("No tienes permisos para eliminar este proyecto o el proyecto ya no existe.");
            }

            // Force a full reload to clear any stale state in Dashboard
            window.location.href = '/dashboard';
        } catch (error) {
            console.error('Error deleting project:', error);
            alert('Error al eliminar el proyecto: ' + error.message);
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'resumen', label: 'Resumen', count: null },
        { id: 'tareas', label: 'Tareas', count: tasks.length },
        { id: 'documentos', label: 'Documentos', count: documents.length },
        { id: 'equipo', label: 'Equipo', count: team.length },
    ];

    if (loading) {
        return (
            <div className="project-detail">
                <div className="container">
                    <div className="loading">Cargando proyecto...</div>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="project-detail">
                <div className="container">
                    <div className="error-state">Proyecto no encontrado</div>
                </div>
            </div>
        );
    }

    return (
        <div className="project-detail">
            {/* Header */}
            <header className="project-header">
                <div className="container header-content">
                    <div className="header-left">
                        <button
                            className="btn-icon back-btn"
                            onClick={() => navigate('/dashboard')}
                            title="Volver al Dashboard"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="project-identity">
                            <div className="project-icon">📊</div>
                            <div className="project-details">
                                <h1 className="app-title">{project.name}</h1>
                                <span className="app-subtitle">{project.institution}</span>
                            </div>
                        </div>
                    </div>

                    <div className="header-right">
                        <div className="user-profile-pill">
                            <div className="avatar-circle">
                                <span>CB</span>
                            </div>
                            <span className="user-email">
                                <span className="email-prefix">CB</span>edu@acme.com
                            </span>
                        </div>
                        <button
                            className="btn-icon delete-btn"
                            title="Eliminar Proyecto"
                            onClick={handleDeleteProject}
                        >
                            <Trash2 size={20} />
                        </button>
                        <button
                            className="btn-icon logout-btn"
                            title="Cerrar sesión"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="tabs-container">
                <div className="container">
                    <div className="tabs">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    const newUrl = new URL(window.location);
                                    newUrl.searchParams.set('tab', tab.id);
                                    window.history.pushState({}, '', newUrl);
                                }}
                            >
                                {tab.label}
                                {tab.count !== null && (
                                    <span className="tab-count">{tab.count}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <main className="container">
                <div className="tab-content">
                    {activeTab === 'resumen' && (
                        <ProjectSummary
                            project={project}
                            tasks={tasks}
                            documents={documents}
                            onUpdate={fetchProjectData}
                        />
                    )}
                    {activeTab === 'tareas' && (
                        <TasksView
                            tasks={tasks}
                            projectId={id}
                            onTasksUpdate={fetchProjectData}
                        />
                    )}
                    {activeTab === 'documentos' && (
                        <DocumentsTab
                            documents={documents}
                            projectId={id}
                            onDocumentsUpdate={fetchProjectData}
                        />
                    )}
                    {activeTab === 'equipo' && (
                        <TeamTab
                            team={team}
                            invitations={invitations}
                            projectId={id}
                            onUpdate={fetchProjectData}
                        />
                    )}
                </div>
            </main>

            {/* AI Assistant */}
            {project && user && (
                <AIAssistant
                    areaId={project.area_id}
                    userId={user.id}
                    projects={[project]}
                    tasks={tasks}
                    documents={documents}
                    onAction={fetchProjectData}
                />
            )}
        </div>
    );
}

export default ProjectDetail;
