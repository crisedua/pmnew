import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Loader2, UserPlus } from 'lucide-react';
import './JoinProject.css';

function JoinProject() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [invitation, setInvitation] = useState(null);
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);
    const [isJoining, setIsJoining] = useState(false);

    useEffect(() => {
        checkUserAndInvitation();
    }, [id]);

    const checkUserAndInvitation = async () => {
        try {
            setLoading(true);

            // 1. Get current user
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            setUser(currentUser);

            // 2. Try to find area by share_token first (for area invitations)
            const { data: areaData, error: areaError } = await supabase
                .from('areas')
                .select('*')
                .eq('share_token', id)
                .single();

            if (areaData && !areaError) {
                // This is an area invitation
                setProject({ name: areaData.name, description: areaData.description });
                setInvitation({ 
                    area_id: areaData.id, 
                    role: 'member',
                    type: 'area'
                });
                setLoading(false);
                return;
            }

            // 3. If not an area, try project invitation
            const { data: inviteData, error: inviteError } = await supabase
                .from('project_invitations')
                .select('*, projects(*)')
                .eq('id', id)
                .single();

            if (inviteError || !inviteData) {
                throw new Error('Invitación no válida o expirada.');
            }

            if (inviteData.status !== 'pending') {
                throw new Error(`Esta invitación ya ha sido ${inviteData.status === 'accepted' ? 'aceptada' : 'cancelada'}.`);
            }

            setInvitation({ ...inviteData, type: 'project' });
            setProject(inviteData.projects);

        } catch (err) {
            console.error('Error checking invitation:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!user) {
            // Store target in session storage to redirect back after login
            sessionStorage.setItem('returnPath', `/join/${id}`);
            navigate('/login');
            return;
        }

        setIsJoining(true);
        try {
            if (invitation.type === 'area') {
                // Joining an area
                const { error: areaMemberError } = await supabase
                    .from('area_members')
                    .insert({
                        area_id: invitation.area_id,
                        user_id: user.id,
                        role: invitation.role
                    });

                if (areaMemberError) {
                    // Check if already a member
                    if (areaMemberError.code === '23505') { // unique violation
                        // Already a member, just redirect
                        navigate('/dashboard');
                        return;
                    } else {
                        throw areaMemberError;
                    }
                }

                // Success! Redirect to dashboard
                navigate('/dashboard');
            } else {
                // Joining a project
                // 1. Add to team_members
                const { error: teamError } = await supabase
                    .from('team_members')
                    .insert({
                        project_id: invitation.project_id,
                        user_id: user.id,
                        role: invitation.role,
                        email: user.email,
                        name: user.user_metadata?.full_name || user.email.split('@')[0]
                    });

                if (teamError) {
                    // Check if already in team
                    if (teamError.code === '23505') { // unique violation
                        // Continue to mark invite as accepted anyway
                    } else {
                        throw teamError;
                    }
                }

                // 2. Mark invitation as accepted
                const { error: inviteUpdateError } = await supabase
                    .from('project_invitations')
                    .update({ status: 'accepted' })
                    .eq('id', id);

                if (inviteUpdateError) throw inviteUpdateError;

                // 3. Success!
                navigate(`/project/${invitation.project_id}`);
            }

        } catch (err) {
            console.error('Error joining:', err);
            alert('Error al unirse: ' + err.message);
        } finally {
            setIsJoining(false);
        }
    };

    if (loading) {
        return (
            <div className="join-container">
                <Loader2 className="animate-spin" size={48} />
                <p>Verificando invitación...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="join-container">
                <div className="join-card error">
                    <XCircle size={64} color="#ef4444" />
                    <h2>Oops!</h2>
                    <p>{error}</p>
                    <Link to="/dashboard" className="btn btn-secondary">Ir al Dashboard</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="join-container">
            <div className="join-card">
                <div className="project-icon">
                    <UserPlus size={40} />
                </div>
                <h1>Invitación {invitation?.type === 'area' ? 'al Área' : 'al Proyecto'}</h1>
                <div className="invite-details">
                    <p>Has sido invitado a colaborar en:</p>
                    <div className="project-box">
                        <span className="project-name">{project?.name}</span>
                        <span className="project-role">{invitation?.role}</span>
                    </div>
                    {project?.description && (
                        <p className="project-description">{project.description}</p>
                    )}
                </div>

                {!user ? (
                    <div className="auth-notice">
                        <p>Debes iniciar sesión para aceptar la invitación.</p>
                        <button className="btn btn-primary" onClick={handleJoin}>
                            Iniciar Sesión y Aceptar
                        </button>
                    </div>
                ) : (
                    <div className="action-area">
                        <p>Logueado como: <strong>{user.email}</strong></p>
                        <button
                            className="btn btn-primary full-width"
                            onClick={handleJoin}
                            disabled={isJoining}
                        >
                            {isJoining ? 'Uniéndose...' : 'Aceptar Invitación y Entrar'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default JoinProject;
