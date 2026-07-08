import React, { useState, useEffect } from 'react';
import { MessageSquare, Activity, Send, CircleDot, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { HEALTH } from '../lib/health';
import './Traceability.css';

const statusLabel = (s) => ({
    'To Do': 'Pendiente',
    'In Progress': 'En Progreso',
    'On Hold': 'En Espera',
    'Complete': 'Completada',
}[s] || s || '—');

const healthLabel = (h) => (h && HEALTH[h] ? HEALTH[h].label : 'Automático');

const personName = (profile, fallback = 'Alguien') =>
    profile?.full_name || profile?.email || fallback;

const formatWhen = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) +
        ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Trazabilidad de la iniciativa: timeline de actividad + comentarios.
 * props:
 *  - projectId
 *  - tasks: tareas del proyecto (para etiquetar y elegir dónde comentar)
 *  - userId
 *  - canComment: bool (cualquier miembro puede comentar)
 */
function Traceability({ projectId, tasks = [], userId, canComment = true }) {
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTaskId, setSelectedTaskId] = useState('');
    const [comment, setComment] = useState('');
    const [posting, setPosting] = useState(false);

    const taskTitle = (id) => tasks.find((t) => t.id === id)?.title || 'Tarea';

    useEffect(() => {
        if (projectId) fetchFeed();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, tasks.length]);

    const fetchFeed = async () => {
        setLoading(true);
        try {
            const taskIds = tasks.map((t) => t.id);

            const activityPromise = supabase
                .from('task_activity')
                .select('*, profiles(full_name, email)')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });

            const commentsPromise = taskIds.length
                ? supabase
                    .from('task_comments')
                    .select('*, profiles(full_name, email)')
                    .in('task_id', taskIds)
                    .order('created_at', { ascending: false })
                : Promise.resolve({ data: [] });

            const [{ data: activity, error: aErr }, { data: comments, error: cErr }] =
                await Promise.all([activityPromise, commentsPromise]);

            if (aErr) console.warn('activity error', aErr);
            if (cErr) console.warn('comments error', cErr);

            const items = [
                ...(activity || []).map((a) => ({ kind: 'activity', ...a })),
                ...(comments || []).map((c) => ({ kind: 'comment', ...c })),
            ].sort((x, y) => new Date(y.created_at) - new Date(x.created_at));

            setFeed(items);
        } catch (error) {
            console.error('Error fetching traceability feed:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePost = async () => {
        if (!comment.trim() || !selectedTaskId) return;
        setPosting(true);
        try {
            const { error } = await supabase.from('task_comments').insert({
                task_id: selectedTaskId,
                user_id: userId,
                content: comment.trim(),
            });
            if (error) throw error;
            setComment('');
            await fetchFeed();
        } catch (error) {
            console.error('Error posting comment:', error);
            alert('Error al publicar el comentario: ' + error.message);
        } finally {
            setPosting(false);
        }
    };

    const renderActivity = (item) => {
        const who = personName(item.profiles);
        if (item.type === 'created') {
            return <>{who} creó la tarea <strong>{taskTitle(item.task_id)}</strong> ({statusLabel(item.new_value)})</>;
        }
        if (item.type === 'status_change') {
            return <>{who} cambió <strong>{taskTitle(item.task_id)}</strong> de {statusLabel(item.old_value)} a <strong>{statusLabel(item.new_value)}</strong></>;
        }
        if (item.type === 'health_change') {
            return <>{who} marcó el semáforo de <strong>{taskTitle(item.task_id)}</strong> como <strong>{healthLabel(item.new_value)}</strong></>;
        }
        return <>{who} actualizó <strong>{taskTitle(item.task_id)}</strong></>;
    };

    return (
        <div className="traceability">
            {canComment && (
                <div className="trace-composer card">
                    <h3><MessageSquare size={18} /> Agregar comentario</h3>
                    <div className="composer-row">
                        <select value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)}>
                            <option value="">Selecciona una tarea...</option>
                            {tasks.map((t) => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                    </div>
                    <textarea
                        rows="2"
                        placeholder="Escribe una nota o avance sobre esta tarea..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                    <div className="composer-actions">
                        <button
                            className="btn btn-primary"
                            onClick={handlePost}
                            disabled={posting || !comment.trim() || !selectedTaskId}
                        >
                            <Send size={16} /> {posting ? 'Publicando...' : 'Publicar'}
                        </button>
                    </div>
                </div>
            )}

            <div className="trace-timeline card">
                <h3><Activity size={18} /> Trazabilidad de la subcomisión</h3>
                {loading ? (
                    <div className="trace-empty">Cargando...</div>
                ) : feed.length === 0 ? (
                    <div className="trace-empty">Aún no hay actividad ni comentarios.</div>
                ) : (
                    <ul className="trace-list">
                        {feed.map((item) => (
                            <li key={`${item.kind}-${item.id}`} className={`trace-item ${item.kind}`}>
                                <span className="trace-icon">
                                    {item.kind === 'comment'
                                        ? <MessageSquare size={15} />
                                        : item.type === 'status_change'
                                            ? <Flag size={15} />
                                            : <CircleDot size={15} />}
                                </span>
                                <div className="trace-body">
                                    {item.kind === 'comment' ? (
                                        <>
                                            <div className="trace-text">
                                                <strong>{personName(item.profiles)}</strong> en <em>{taskTitle(item.task_id)}</em>
                                            </div>
                                            <div className="trace-comment">{item.content}</div>
                                        </>
                                    ) : (
                                        <div className="trace-text">{renderActivity(item)}</div>
                                    )}
                                    <div className="trace-when">{formatWhen(item.created_at)}</div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default Traceability;
