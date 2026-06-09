import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, ShieldCheck, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchIsAdmin } from '../lib/admin';
import './Admin.css';

function Admin() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/login');
            return;
        }
        const admin = await fetchIsAdmin(user.id);
        if (!admin) {
            // Solo los administradores pueden acceder
            navigate('/dashboard');
            return;
        }
        setUser(user);
        await fetchProfiles();
        setLoading(false);
    };

    const fetchProfiles = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, full_name, is_admin, created_at')
            .order('created_at', { ascending: true });
        if (error) {
            console.error('Error fetching profiles:', error);
            setError('No se pudieron cargar los usuarios: ' + error.message);
            return;
        }
        setProfiles(data || []);
    };

    const toggleAdmin = async (profile) => {
        const next = !profile.is_admin;
        if (profile.id === user.id && !next &&
            !confirm('Vas a quitarte el rol de administrador a ti mismo. ¿Continuar?')) {
            return;
        }
        setSavingId(profile.id);
        setError(null);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_admin: next })
                .eq('id', profile.id);
            if (error) throw error;
            setProfiles(prev =>
                prev.map(p => (p.id === profile.id ? { ...p, is_admin: next } : p))
            );
        } catch (err) {
            console.error('Error updating admin role:', err);
            setError('No se pudo actualizar el rol: ' + err.message);
        } finally {
            setSavingId(null);
        }
    };

    const filtered = profiles.filter(p => {
        const q = searchQuery.toLowerCase();
        return (
            (p.email || '').toLowerCase().includes(q) ||
            (p.full_name || '').toLowerCase().includes(q)
        );
    });

    if (loading) return <div className="loading">Cargando...</div>;

    return (
        <div className="admin-page">
            <div className="admin-header">
                <button className="btn-back" onClick={() => navigate('/dashboard')}>
                    <ArrowLeft size={18} />
                    Volver
                </button>
                <h1><Shield size={22} /> Administración</h1>
            </div>

            <p className="admin-intro">
                Los administradores pueden crear proyectos, tareas e invitar equipo.
                Activa o desactiva el rol de administrador para cada usuario.
            </p>

            {error && <div className="error-message mb-md">{error}</div>}

            <div className="admin-search">
                <Search size={18} />
                <input
                    type="text"
                    placeholder="Buscar por nombre o email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="admin-table-wrap">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Email</th>
                            <th>Rol</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(p => (
                            <tr key={p.id}>
                                <td>
                                    <div className="admin-user">
                                        <div className="admin-avatar">
                                            {(p.full_name || p.email || '?')[0]?.toUpperCase()}
                                        </div>
                                        <span>{p.full_name || '—'}</span>
                                        {p.id === user.id && <span className="admin-you">(tú)</span>}
                                    </div>
                                </td>
                                <td>{p.email}</td>
                                <td>
                                    {p.is_admin ? (
                                        <span className="badge-admin">
                                            <ShieldCheck size={14} /> Administrador
                                        </span>
                                    ) : (
                                        <span className="badge-member">Miembro</span>
                                    )}
                                </td>
                                <td>
                                    <button
                                        className={`btn btn-sm ${p.is_admin ? 'btn-danger-outline' : 'btn-primary'}`}
                                        onClick={() => toggleAdmin(p)}
                                        disabled={savingId === p.id}
                                    >
                                        {savingId === p.id
                                            ? 'Guardando...'
                                            : p.is_admin ? 'Quitar admin' : 'Hacer admin'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan="4" className="admin-empty">No se encontraron usuarios.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Admin;
