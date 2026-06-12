import React, { useEffect, useMemo, useState } from 'react';
import { Activity, CircleDot, Flag, PlusCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { HEALTH } from '../lib/health';
import './ActividadView.css';

const STATUS_LABEL = { 'To Do': 'Pendiente', 'In Progress': 'En Progreso', 'Complete': 'Completada' };
const statusLabel = (s) => STATUS_LABEL[s] || s || '—';
const healthLabel = (h) => (h && HEALTH[h] ? HEALTH[h].label : 'Automático');
const personName = (p) => p?.full_name || p?.email || 'Alguien';

function relative(dateStr) {
    if (!dateStr) return '';
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days <= 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    if (days < 30) return `Hace ${days} d`;
    return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

/**
 * Actividad: feed global de cambios (task_activity) de las iniciativas.
 * props:
 *  - initiatives: array de proyectos (para acotar a sus project_id)
 *  - onOpen: (projectId) => void
 */
function ActividadView({ initiatives = [], onOpen }) {
    const projectIds = useMemo(() => initiatives.map(i => i.id), [initiatives]);
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (projectIds.length === 0) { setFeed([]); setLoading(false); return; }
            setLoading(true);
            const { data, error } = await supabase
                .from('task_activity')
                .select('*, profiles(full_name, email), tasks(title), projects(name)')
                .in('project_id', projectIds)
                .order('created_at', { ascending: false })
                .limit(60);
            if (error) console.warn('Error fetching actividad:', error.message);
            if (!cancelled) { setFeed(data || []); setLoading(false); }
        };
        run();
        return () => { cancelled = true; };
    }, [projectIds]);

    const renderText = (a) => {
        const who = personName(a.profiles);
        const task = a.tasks?.title || 'una tarea';
        if (a.type === 'created') return <><strong>{who}</strong> creó la tarea <em>{task}</em></>;
        if (a.type === 'status_change') return <><strong>{who}</strong> cambió el estado de <em>{task}</em> de <b>{statusLabel(a.old_value)}</b> a <b>{statusLabel(a.new_value)}</b></>;
        if (a.type === 'health_change') return <><strong>{who}</strong> cambió el semáforo de <em>{task}</em> a <b>{healthLabel(a.new_value)}</b></>;
        return <><strong>{who}</strong> actualizó <em>{task}</em></>;
    };

    const iconFor = (type) => {
        if (type === 'created') return <PlusCircle size={15} />;
        if (type === 'health_change') return <Flag size={15} />;
        if (type === 'status_change') return <CircleDot size={15} />;
        return <Activity size={15} />;
    };

    return (
        <div className="actividad-view">
            <h1 className="actividad-title">Actividad</h1>

            {loading ? (
                <div className="actividad-empty">Cargando actividad…</div>
            ) : feed.length === 0 ? (
                <div className="actividad-empty">No hay actividad registrada todavía.</div>
            ) : (
                <div className="actividad-card">
                    {feed.map(a => (
                        <div className="act-item" key={a.id} onClick={() => onOpen && a.project_id && onOpen(a.project_id)}>
                            <span className={`act-ic ${a.type}`}>{iconFor(a.type)}</span>
                            <div className="act-body">
                                <div className="act-text">{renderText(a)}</div>
                                <div className="act-meta">
                                    {a.projects?.name && <span className="act-project">{a.projects.name}</span>}
                                    <span className="act-time">{relative(a.created_at)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ActividadView;
