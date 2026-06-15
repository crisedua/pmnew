import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ShieldCheck, Search, Building2, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchIsSuperAdmin } from '../lib/admin';
import AppHeader from '../components/AppHeader';
import './Admin.css';

function Admin() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [profiles, setProfiles] = useState([]);
    const [comisiones, setComisiones] = useState([]);
    // memberships: { [userId]: Set(area_id) }
    const [memberships, setMemberships] = useState({});
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState(null);
    const [managing, setManaging] = useState(null); // perfil cuyo acceso se edita
    const [savingArea, setSavingArea] = useState(null);

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/login');
            return;
        }
        const superAdmin = await fetchIsSuperAdmin(user.id);
        if (!superAdmin) {
            // Solo el super administrador gestiona usuarios
            navigate('/dashboard');
            return;
        }
        setUser(user);
        await Promise.all([fetchProfiles(), fetchComisiones(), fetchMemberships()]);
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

    const fetchComisiones = async () => {
        const { data, error } = await supabase
            .from('areas')
            .select('id, name')
            .order('name', { ascending: true });
        if (error) {
            console.warn('Error fetching comisiones:', error.message);
            return;
        }
        setComisiones(data || []);
    };

    const fetchMemberships = async () => {
        const { data, error } = await supabase
            .from('area_members')
            .select('user_id, area_id');
        if (error) {
            console.warn('Error fetching memberships:', error.message);
            return;
        }
        const map = {};
        (data || []).forEach(m => {
            (map[m.user_id] = map[m.user_id] || new Set()).add(m.area_id);
        });
        setMemberships(map);
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

    const hasAccess = (userId, areaId) => memberships[userId]?.has(areaId);

    const toggleMembership = async (userId, areaId) => {
        const currently = hasAccess(userId, areaId);
        setSavingArea(areaId);
        setError(null);
        try {
            if (currently) {
                const { error } = await supabase
                    .from('area_members')
                    .delete()
                    .eq('user_id', userId)
                    .eq('area_id', areaId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('area_members')
                    .insert({ user_id: userId, area_id: areaId, role: 'editor' });
                if (error) throw error;
            }
            setMemberships(prev => {
                const set = new Set(prev[userId] || []);
                if (currently) set.delete(areaId); else set.add(areaId);
                return { ...prev, [userId]: set };
            });
        } catch (err) {
            console.error('Error updating membership:', err);
            setError('No se pudo actualizar el acceso: ' + err.message);
        } finally {
            setSavingArea(null);
        }
    };

    const filtered = profiles.filter(p => {
        const q = searchQuery.toLowerCase();
        return (
            (p.email || '').toLowerCase().includes(q) ||
            (p.full_name || '').toLowerCase().includes(q)
        );
    });

    const accessCount = (userId) => memberships[userId]?.size || 0;

    if (loading) return <div className="loading">Cargando...</div>;

    return (
        <div className="admin-page">
            <AppHeader
                title="Administración"
                icon={<Shield size={20} />}
                onBack={() => navigate('/dashboard')}
            />

            <div className="admin-body">
            <p className="admin-intro">
                Gestiona el rol de administrador y a qué comisiones tiene acceso cada usuario.
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
                            <th>Comisiones</th>
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
                                        className="btn btn-sm btn-comisiones"
                                        onClick={() => setManaging(p)}
                                    >
                                        <Building2 size={14} /> {accessCount(p.id)} comisión{accessCount(p.id) === 1 ? '' : 'es'}
                                    </button>
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
                                <td colSpan="5" className="admin-empty">No se encontraron usuarios.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            </div>

            {/* Modal: asignar comisiones a un usuario */}
            {managing && (
                <div className="modal-overlay" onClick={() => setManaging(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Comisiones de {managing.full_name || managing.email}</h3>
                            <button className="btn-icon" onClick={() => setManaging(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="text-secondary" style={{ marginTop: 0 }}>
                                Marca las comisiones a las que este usuario tendrá acceso.
                            </p>
                            {comisiones.length === 0 && (
                                <p className="text-secondary">No hay comisiones creadas todavía.</p>
                            )}
                            <div className="comision-checklist">
                                {comisiones.map(c => {
                                    const checked = hasAccess(managing.id, c.id);
                                    return (
                                        <button
                                            key={c.id}
                                            className={`comision-check ${checked ? 'checked' : ''}`}
                                            onClick={() => toggleMembership(managing.id, c.id)}
                                            disabled={savingArea === c.id}
                                        >
                                            <span className="comision-check-box">
                                                {checked && <Check size={14} />}
                                            </span>
                                            <span className="comision-check-name">{c.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary" onClick={() => setManaging(null)}>
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Admin;
