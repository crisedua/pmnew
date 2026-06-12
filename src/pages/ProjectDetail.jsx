import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LogOut, Trash2, X, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AppHeader from '../components/AppHeader';
import ProjectSummary from '../components/ProjectSummary';
import TasksView from '../components/TasksView';
import DocumentsTab from '../components/DocumentsTab';
import TeamTab from '../components/TeamTab';
import AIAssistant from '../components/AIAssistant';
import Traceability from '../components/Traceability';
import { getUserAreaRole, canEdit, ESTADOS, getInitiativeEstado, lineaColor } from '../lib/health';
import { fetchIsAdmin } from '../lib/admin';
import { avatarColor, initials } from '../lib/avatar';
import './ProjectDetail.css';

function formatLongDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
}

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
    const [assignees, setAssignees] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showDesc, setShowDesc] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [savingEdit, setSavingEdit] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkUser();
        fetchProjectData();
    }, [id]);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        if (user) setIsAdmin(await fetchIsAdmin(user.id));
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
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

            // Rol del usuario en el área (para gatear edición vs solo lectura)
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser && projectData?.area_id) {
                const userRole = await getUserAreaRole(projectData.area_id, currentUser.id);
                setRole(userRole);
            }

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

            // Fetch assignees (equipo libre: nombre/email sin cuenta)
            const { data: assigneesData, error: assigneesError } = await supabase
                .from('project_assignees')
                .select('*')
                .eq('project_id', id)
                .order('created_at', { ascending: true });

            if (assigneesError) {
                console.warn('Error fetching assignees (table might be missing):', assigneesError);
            }
            setAssignees(assigneesData || []);

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

    const openEdit = () => {
        setEditForm({
            codigo: project.codigo || '',
            linea: project.linea || '',
            owner_name: project.owner_name || '',
            owner_email: project.owner_email || '',
            description: project.description || '',
            start_date: project.start_date || '',
            due_date: project.due_date || '',
        });
        setEditing(true);
    };

    const saveEdit = async () => {
        setSavingEdit(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .update({
                    codigo: editForm.codigo || null,
                    linea: editForm.linea || null,
                    owner_name: editForm.owner_name || null,
                    owner_email: editForm.owner_email || null,
                    description: editForm.description || null,
                    start_date: editForm.start_date || null,
                    due_date: editForm.due_date || null,
                })
                .eq('id', id)
                .select();

            if (error) throw error;
            // Con RLS, un UPDATE sin permiso afecta 0 filas sin lanzar error.
            if (!data || data.length === 0) {
                alert('No tienes permisos para editar esta iniciativa.');
                return;
            }
            setEditing(false);
            await fetchProjectData();
        } catch (err) {
            console.error('Error updating initiative:', err);
            alert('Error al guardar: ' + (err.message || JSON.stringify(err)));
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeleteProject = async () => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta subcomisión? Esta acción es irreversible y eliminará todos los datos asociados.')) {
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
                throw new Error("No tienes permisos para eliminar esta subcomisión o ya no existe.");
            }

            // Force a full reload to clear any stale state in Dashboard
            window.location.href = '/dashboard';
        } catch (error) {
            console.error('Error deleting project:', error);
            alert('Error al eliminar la subcomisión: ' + error.message);
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'resumen', label: 'Resumen', count: null },
        { id: 'tareas', label: 'Tareas', count: tasks.length },
        { id: 'documentos', label: 'Documentos', count: documents.length },
        { id: 'equipo', label: 'Equipo', count: team.length },
        { id: 'trazabilidad', label: 'Trazabilidad', count: null },
    ];

    if (loading) {
        return (
            <div className="project-detail">
                <div className="container">
                    <div className="loading">Cargando subcomisión...</div>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="project-detail">
                <div className="container">
                    <div className="error-state">Subcomisión no encontrada</div>
                </div>
            </div>
        );
    }

    return (
        <div className="project-detail">
            {/* Header */}
            <AppHeader title={project.name} onBack={() => navigate('/dashboard')}>
                <button
                    className="btn-icon delete-btn"
                    title="Eliminar Subcomisión"
                    onClick={handleDeleteProject}
                >
                    <Trash2 size={20} />
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
            </AppHeader>

            {/* Ficha de la iniciativa (estilo prototipo) */}
            {(() => {
                const estado = ESTADOS[getInitiativeEstado(tasks)];
                const owner = project.owner_name || project.responsible_email;
                const lineaCode = project.linea ? project.linea.split(/\s+/)[0] : null;
                const inicio = formatLongDate(project.start_date);
                const cierre = formatLongDate(project.due_date);
                return (
                    <section className="initiative-hero">
                        <div className="container">
                            <div className="ih-eyebrow">
                                {(project.codigo || project.linea) && (
                                    <span className="ih-code">
                                        {project.codigo || '—'}{project.linea ? ` · ${project.linea}` : ''}
                                    </span>
                                )}
                                <span className="ih-estado">
                                    <span className="ih-estado-dot" style={{ background: estado.color }} />
                                    {estado.label}
                                </span>
                                {(isAdmin || canEdit(role)) && (
                                    <button className="ih-edit-btn" onClick={openEdit}>
                                        <Pencil size={14} /> Editar
                                    </button>
                                )}
                            </div>
                            <h1 className="ih-title">{project.name}</h1>

                            <div className="ih-card">
                                <div className="ih-row">
                                    <span className="ih-label">Owner</span>
                                    <div className="ih-value">
                                        {owner ? (
                                            <div className="ih-person">
                                                <span className="ih-avatar" style={{ background: avatarColor(owner) }}>
                                                    {initials(owner)}
                                                </span>
                                                <div className="ih-person-text">
                                                    <strong>{project.owner_name || owner}</strong>
                                                    {project.owner_email && <span>{project.owner_email}</span>}
                                                </div>
                                            </div>
                                        ) : <span className="ih-muted">Sin owner</span>}
                                    </div>
                                </div>

                                <div className="ih-row">
                                    <span className="ih-label">Descripción</span>
                                    <div className="ih-value">
                                        {project.description ? (
                                            <div className="ih-desc">
                                                <p className="ih-desc-clamp" onClick={() => setShowDesc(true)}>
                                                    {project.description}
                                                </p>
                                                <button className="ih-desc-more" onClick={() => setShowDesc(true)}>
                                                    Ver más
                                                </button>
                                            </div>
                                        ) : <span className="ih-muted">Sin descripción</span>}
                                    </div>
                                </div>

                                <div className="ih-row">
                                    <span className="ih-label">Equipo</span>
                                    <div className="ih-value">
                                        {assignees.length > 0 ? (
                                            <div className="ih-team">
                                                {assignees.map(a => (
                                                    <span className="ih-team-member" key={a.id} title={a.email || a.name}>
                                                        <span className="ih-avatar sm" style={{ background: avatarColor(a.name || a.email || '') }}>
                                                            {initials(a.name || a.email || '?')}
                                                        </span>
                                                        {a.name || a.email}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : <span className="ih-muted">Sin equipo</span>}
                                    </div>
                                </div>

                                <div className="ih-row">
                                    <span className="ih-label">Linea</span>
                                    <div className="ih-value">
                                        {lineaCode
                                            ? <span className="ih-linea" style={{ color: lineaColor(project.linea), background: `${lineaColor(project.linea)}1a` }}>{project.linea}</span>
                                            : <span className="ih-muted">—</span>}
                                    </div>
                                </div>

                                <div className="ih-row">
                                    <span className="ih-label">Estado</span>
                                    <div className="ih-value">
                                        <span className="ih-estado-pill">
                                            <span className="ih-estado-dot" style={{ background: estado.color }} />
                                            {estado.label}
                                        </span>
                                    </div>
                                </div>

                                <div className="ih-row">
                                    <span className="ih-label">Inicio</span>
                                    <div className="ih-value">
                                        {inicio || <span className="ih-muted">Por definir</span>}
                                    </div>
                                </div>

                                <div className="ih-row">
                                    <span className="ih-label">Cierre est.</span>
                                    <div className="ih-value">
                                        {cierre || <span className="ih-muted">Por definir</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                );
            })()}

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
                            canManage={isAdmin || role === 'owner'}
                        />
                    )}
                    {activeTab === 'tareas' && (
                        <TasksView
                            tasks={tasks}
                            projectId={id}
                            onTasksUpdate={fetchProjectData}
                            canEdit={isAdmin || canEdit(role)}
                            canCreate={isAdmin}
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
                            canInvite={isAdmin}
                        />
                    )}
                    {activeTab === 'trazabilidad' && user && (
                        <Traceability
                            projectId={id}
                            tasks={tasks}
                            userId={user.id}
                            canComment={!!role}
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

            {/* Editar ficha de la iniciativa */}
            {editing && (
                <div className="ih-modal-overlay" onClick={() => setEditing(false)}>
                    <div className="ih-modal ih-edit" onClick={(e) => e.stopPropagation()}>
                        <div className="ih-modal-head">
                            <h3>Editar iniciativa</h3>
                            <button className="ih-modal-close" onClick={() => setEditing(false)} title="Cerrar">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="ih-modal-body">
                            <div className="ih-form-grid">
                                <label className="ih-field">
                                    <span>Código</span>
                                    <input
                                        type="text"
                                        placeholder="L1-A"
                                        value={editForm.codigo}
                                        onChange={(e) => setEditForm({ ...editForm, codigo: e.target.value })}
                                    />
                                </label>
                                <label className="ih-field">
                                    <span>Línea</span>
                                    <input
                                        type="text"
                                        placeholder="L1 Gestion"
                                        value={editForm.linea}
                                        onChange={(e) => setEditForm({ ...editForm, linea: e.target.value })}
                                    />
                                </label>
                                <label className="ih-field">
                                    <span>Owner</span>
                                    <input
                                        type="text"
                                        placeholder="Nombre"
                                        value={editForm.owner_name}
                                        onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })}
                                    />
                                </label>
                                <label className="ih-field">
                                    <span>Email del owner</span>
                                    <input
                                        type="email"
                                        placeholder="owner@empresa.cl"
                                        value={editForm.owner_email}
                                        onChange={(e) => setEditForm({ ...editForm, owner_email: e.target.value })}
                                    />
                                </label>
                                <label className="ih-field">
                                    <span>Inicio</span>
                                    <input
                                        type="date"
                                        value={editForm.start_date || ''}
                                        onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                                    />
                                </label>
                                <label className="ih-field">
                                    <span>Cierre est.</span>
                                    <input
                                        type="date"
                                        value={editForm.due_date || ''}
                                        onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                                    />
                                </label>
                                <label className="ih-field ih-field-full">
                                    <span>Descripción</span>
                                    <textarea
                                        rows={6}
                                        value={editForm.description}
                                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    />
                                </label>
                            </div>
                            <p className="ih-form-note">
                                El estado se calcula automáticamente según el avance de las tareas.
                            </p>
                        </div>
                        <div className="ih-modal-foot">
                            <button className="ih-btn-secondary" onClick={() => setEditing(false)} disabled={savingEdit}>
                                Cancelar
                            </button>
                            <button className="ih-btn-primary" onClick={saveEdit} disabled={savingEdit}>
                                {savingEdit ? 'Guardando…' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Descripción completa */}
            {showDesc && (
                <div className="ih-modal-overlay" onClick={() => setShowDesc(false)}>
                    <div className="ih-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ih-modal-head">
                            <h3>{project.name}</h3>
                            <button className="ih-modal-close" onClick={() => setShowDesc(false)} title="Cerrar">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="ih-modal-body">
                            {project.description}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProjectDetail;
