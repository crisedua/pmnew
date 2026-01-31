import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProjectSummary from '../components/ProjectSummary';
import TasksView from '../components/TasksView';
import DocumentsTab from '../components/DocumentsTab';
import TeamTab from '../components/TeamTab';
import './ProjectDetail.css';

function ProjectDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('resumen');
    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [team, setTeam] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.body.className = 'dark';
        fetchProjectData();
    }, [id]);

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

        } catch (error) {
            console.error('Error fetching project data:', error);
        } finally {
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
                <div className="container flex-between">
                    <div className="flex gap-md">
                        <button className="btn-icon" onClick={() => navigate('/dashboard')}>
                            <ArrowLeft size={20} />
                        </button>
                        <div className="app-logo">📊</div>
                        <div className="flex-col">
                            <span className="app-title">{project.name}</span>
                            <span className="app-subtitle">{project.institution}</span>
                        </div>
                    </div>
                    <div className="flex gap-md">
                        <span className="user-email">edu@acme.com</span>
                        <button className="btn-icon">
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
                                onClick={() => setActiveTab(tab.id)}
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
                        <TeamTab team={team} />
                    )}
                </div>
            </main>
        </div>
    );
}

export default ProjectDetail;
