import React from 'react';
import { Users, Mail, User } from 'lucide-react';
import './TeamTab.css';

function TeamTab({ team }) {
    return (
        <div className="team-tab">
            <div className="team-header card">
                <h2>Equipo del Proyecto</h2>
                <p className="text-secondary">
                    {team.length} miembro{team.length !== 1 ? 's' : ''} del equipo
                </p>
            </div>

            {team.length === 0 ? (
                <div className="empty-state card">
                    <Users size={48} className="empty-icon" />
                    <h3>No hay miembros</h3>
                    <p className="text-secondary">
                        Todavía no se han asignado miembros a este proyecto.
                    </p>
                </div>
            ) : (
                <div className="team-grid">
                    {team.map(member => (
                        <div key={member.id} className="team-member-card card">
                            <div className="member-avatar">
                                <User size={32} />
                            </div>

                            <div className="member-info">
                                <h4 className="member-name">{member.name}</h4>
                                <p className="member-role text-secondary">{member.role || 'Miembro del equipo'}</p>

                                <div className="member-contact">
                                    <Mail size={14} />
                                    <span className="text-sm text-secondary">{member.email}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default TeamTab;
