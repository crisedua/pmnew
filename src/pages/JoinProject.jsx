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

            // 2. Get invitation details
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

            setInvitation(inviteData);
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

        } catch (err) {
            console.error('Error joining project:', err);
            alert('Error al unirse al proyecto: ' + err.message);
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
                <h1>Invitación al Proyecto</h1>
                <div className="invite-details">
                    <p>Has sido invitado a colaborar en:</p>
                    <div className="project-box">
                        <span className="project-name">{project?.name}</span>
                        <span className="project-role">{invitation?.role}</span>
                    </div>
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
