import React, { useState } from 'react';
import { Users, Mail, User, Plus, X, SendsTo } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './TeamTab.css';

function TeamTab({ team = [], invitations = [], projectId, onUpdate }) {
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('member');
    const [isInviting, setIsInviting] = useState(false);

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteEmail.trim() || !projectId) return;

        setIsInviting(true);
        try {
            // Logic to send invitation
            const { error } = await supabase
                .from('project_invitations')
                .insert({
                    project_id: projectId,
                    email: inviteEmail.trim(),
                    role: inviteRole
                });

            if (error) throw error;

            setInviteEmail('');
            setInviteRole('member');
            setShowInviteModal(false);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error sending invitation:', error);
            alert('Error al enviar invitación: ' + error.message);
        } finally {
            setIsInviting(false);
        }
    };

    const cancelInvite = async (inviteId) => {
        if (!confirm('¿Estás seguro de cancelar esta invitación?')) return;

        try {
            const { error } = await supabase
                .from('project_invitations')
                .delete()
                .eq('id', inviteId);

            if (error) throw error;
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error cancelling invitation:', error);
            alert('Error al cancelar: ' + error.message);
        }
    };

    return (
        <div className="team-tab">
            <div className="team-header">
                <div className="flex-between">
                    <div>
                        <h2>Equipo del Proyecto</h2>
                        <p>
                            {team.length} miembro{team.length !== 1 ? 's' : ''} del equipo
                        </p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowInviteModal(true)}>
                        <Plus size={20} />
                        Invitar Miembro
                    </button>
                </div>
            </div>

            {/* Active Team Grid */}
            <div className="team-grid">
                {team.map(member => (
                    <div key={member.id} className="team-member-card">
                        <div className="member-avatar">
                            <User size={32} />
                        </div>

                        <div className="member-info">
                            <h4 className="member-name">{member.name}</h4>
                            <span className="member-role">{member.role || 'Miembro'}</span>

                            <div className="member-contact">
                                <Mail size={14} />
                                <span className="text-sm">{member.email}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {team.length === 0 && (
                <div className="empty-state">
                    <Users size={48} className="empty-icon" />
                    <h3>No hay miembros activos</h3>
                    <p>Invita a tu equipo para colaborar en este proyecto.</p>
                </div>
            )}

            {/* Pending Invitations */}
            {invitations && invitations.length > 0 && (
                <div className="invitations-section mt-xl">
                    <h3>Invitaciones Pendientes</h3>
                    <div className="invitations-list">
                        {invitations.map(invite => (
                            <div key={invite.id} className="invitation-item">
                                <div className="invite-info">
                                    <div className="invite-email">{invite.email}</div>
                                    <div className="invite-meta">
                                        <span className="invite-role">{invite.role}</span>
                                        <span className="invite-date">
                                            Enviado el {new Date(invite.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="invite-status">Pendiente</div>
                                <button
                                    className="btn-icon"
                                    title="Cancelar invitación"
                                    onClick={() => cancelInvite(invite.id)}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Invitar al Proyecto</h3>
                            <button className="btn-icon" onClick={() => setShowInviteModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <form id="invite-form" onSubmit={handleInvite}>
                                <div className="form-group">
                                    <label>Correo Electrónico</label>
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="ejemplo@empresa.com"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Rol</label>
                                    <select
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value)}
                                    >
                                        <option value="member">Miembro</option>
                                        <option value="admin">Administrador</option>
                                        <option value="viewer">Observador</option>
                                    </select>
                                </div>
                            </form>
                        </div>
                        <div className="modal-footer">
                            <button className="btn" onClick={() => setShowInviteModal(false)} type="button">
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                form="invite-form"
                                type="submit"
                                disabled={isInviting}
                            >
                                {isInviting ? 'Enviando...' : 'Enviar Invitación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TeamTab;
