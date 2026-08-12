import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, RefreshCw, Lock, Check, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getUserAreaRole, canEdit as roleCanEdit } from '../lib/health';
import './BitacoraView.css';

// La bitácora puede vivir a nivel de comisión (areaId) o de iniciativa
// (projectId). Se pasa exactamente uno de los dos como scope.

// Columnas fijas de la bitácora (coinciden con la planilla original).
const COLUMNS = [
    { key: 'universidad', label: 'Universidad', width: '130px' },
    { key: 'nombre', label: 'Nombre', width: '190px' },
    { key: 'modalidad', label: 'Modalidad', width: '120px' },
    { key: 'estudiantes', label: 'Estudiantes', width: '200px', multiline: true },
    { key: 'notas', label: 'Notas', width: 'auto', multiline: true },
];

const EMPTY = { universidad: '', nombre: '', modalidad: '', estado: '', estudiantes: '', notas: '' };

// Ajusta la altura de un textarea a su contenido (sin scrollbar interno).
const autoSize = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
};

function BitacoraView({ area, projectId, title, subtitle, isAdmin = false, canEdit: canEditProp, onlyUrgent = false, onRowsChange }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [canEdit, setCanEdit] = useState(canEditProp ?? isAdmin);
    const [savingId, setSavingId] = useState(null);
    const [savedId, setSavedId] = useState(null);
    const savedTimer = useRef(null);
    // Última versión persistida de cada fila, para saber qué celda cambió.
    const persisted = useRef({});

    const areaId = area?.id;
    // Columna y valor con que se filtra/inserta: por iniciativa o por comisión.
    const scopeCol = projectId ? 'project_id' : 'area_id';
    const scopeVal = projectId || areaId;

    const fetchRows = useCallback(async () => {
        if (!scopeVal) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('bitacora_entries')
            .select('*')
            .eq(scopeCol, scopeVal)
            .order('posicion', { ascending: true })
            .order('created_at', { ascending: true });
        if (error) {
            console.warn('Error cargando bitácora (¿tabla creada?):', error.message);
            setRows([]);
        } else {
            setRows(data || []);
            persisted.current = Object.fromEntries((data || []).map(r => [r.id, { ...r }]));
        }
        setLoading(false);
    }, [scopeCol, scopeVal]);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    // Permiso de edición: si el padre lo entrega, se respeta; si no, se
    // resuelve por el rol del usuario en la comisión.
    useEffect(() => {
        if (canEditProp !== undefined) { setCanEdit(canEditProp); return; }
        let active = true;
        (async () => {
            if (isAdmin) { setCanEdit(true); return; }
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !areaId) { if (active) setCanEdit(false); return; }
            const role = await getUserAreaRole(areaId, user.id);
            if (active) setCanEdit(roleCanEdit(role));
        })();
        return () => { active = false; };
    }, [areaId, isAdmin, canEditProp]);

    const flashSaved = (id) => {
        setSavedId(id);
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSavedId(null), 1500);
    };

    // Edición local inmediata.
    const editCell = (id, key, value) => {
        setRows(rs => rs.map(r => (r.id === id ? { ...r, [key]: value } : r)));
    };

    // Persiste una celda al perder el foco, sólo si cambió respecto a la BD.
    const saveCell = async (row, key) => {
        const prev = persisted.current[row.id]?.[key] ?? '';
        if ((row[key] || '') === (prev || '')) return;
        setSavingId(row.id);
        try {
            const { data, error } = await supabase
                .from('bitacora_entries')
                .update({ [key]: row[key] || null, updated_at: new Date().toISOString() })
                .eq('id', row.id)
                .select();
            if (error) throw error;
            if (!data || data.length === 0) {
                alert('No se guardó: no tienes permisos para editar la bitácora.');
                await fetchRows();
                return;
            }
            persisted.current[row.id] = { ...data[0] };
            flashSaved(row.id);
        } catch (err) {
            console.error('Error guardando bitácora:', err);
            alert('Error al guardar: ' + (err.message || JSON.stringify(err)));
        } finally {
            setSavingId(null);
        }
    };

    // Marca/desmarca una fila como urgente.
    const toggleUrgent = async (row) => {
        const next = !row.urgente;
        setRows(rs => rs.map(r => (r.id === row.id ? { ...r, urgente: next } : r)));
        try {
            const { data, error } = await supabase
                .from('bitacora_entries')
                .update({ urgente: next, updated_at: new Date().toISOString() })
                .eq('id', row.id)
                .select();
            if (error) throw error;
            if (!data || data.length === 0) {
                alert('No se pudo marcar: no tienes permisos para editar la bitácora.');
                setRows(rs => rs.map(r => (r.id === row.id ? { ...r, urgente: !next } : r)));
                return;
            }
            persisted.current[row.id] = { ...data[0] };
            onRowsChange?.();
        } catch (err) {
            console.error('Error marcando urgente:', err);
            setRows(rs => rs.map(r => (r.id === row.id ? { ...r, urgente: !next } : r)));
            alert('Error al marcar urgente: ' + (err.message || JSON.stringify(err)));
        }
    };

    const addRow = async () => {
        const posicion = rows.length ? Math.max(...rows.map(r => r.posicion || 0)) + 1 : 0;
        try {
            const { data, error } = await supabase
                .from('bitacora_entries')
                .insert({ [scopeCol]: scopeVal, posicion, ...EMPTY })
                .select();
            if (error) throw error;
            if (!data || data.length === 0) {
                alert('No se pudo agregar: no tienes permisos para editar la bitácora.');
                return;
            }
            persisted.current[data[0].id] = { ...data[0] };
            setRows(rs => [...rs, data[0]]);
            onRowsChange?.();
        } catch (err) {
            console.error('Error agregando fila:', err);
            alert('Error al agregar fila: ' + (err.message || JSON.stringify(err)));
        }
    };

    const deleteRow = async (id) => {
        if (!confirm('¿Eliminar esta fila de la bitácora?')) return;
        try {
            const { data, error } = await supabase
                .from('bitacora_entries')
                .delete()
                .eq('id', id)
                .select();
            if (error) throw error;
            if (!data || data.length === 0) {
                alert('No se eliminó: no tienes permisos para editar la bitácora.');
                return;
            }
            setRows(rs => rs.filter(r => r.id !== id));
            onRowsChange?.();
        } catch (err) {
            console.error('Error eliminando fila:', err);
            alert('Error al eliminar: ' + (err.message || JSON.stringify(err)));
        }
    };

    const shown = onlyUrgent ? rows.filter(r => r.urgente) : rows;
    const colCount = 1 + COLUMNS.length + (canEdit ? 1 : 0);

    return (
        <div className="bitacora-view">
            <div className="bit-bar">
                <div>
                    <h1 className="bit-title">{title || 'Bitácora'}</h1>
                    <p className="bit-sub">
                        {subtitle || area?.name || 'Comisión'} · {shown.length} {onlyUrgent ? 'urgente' : 'registro'}{shown.length !== 1 ? 's' : ''}
                        {!canEdit && <span className="bit-readonly"><Lock size={12} /> Solo lectura</span>}
                    </p>
                </div>
                <div className="bit-actions">
                    <button className="bit-btn ghost" onClick={fetchRows} title="Actualizar">
                        <RefreshCw size={15} className={loading ? 'spin' : ''} /> Actualizar
                    </button>
                    {canEdit && !onlyUrgent && (
                        <button className="bit-btn primary" onClick={addRow}>
                            <Plus size={16} /> Agregar fila
                        </button>
                    )}
                </div>
            </div>

            <div className="bit-table-wrap">
                <table className="bit-table">
                    <thead>
                        <tr>
                            <th className="bit-col-flag" title="Urgente"><Flag size={13} /></th>
                            {COLUMNS.map(c => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}
                            {canEdit && <th className="bit-col-actions" />}
                        </tr>
                    </thead>
                    <tbody>
                        {shown.length === 0 && !loading && (
                            <tr>
                                <td className="bit-empty" colSpan={colCount}>
                                    {onlyUrgent
                                        ? 'No hay elementos marcados como urgentes.'
                                        : canEdit
                                            ? 'Sin registros. Usa "Agregar fila" para empezar la bitácora.'
                                            : 'Esta comisión aún no tiene bitácora.'}
                                </td>
                            </tr>
                        )}
                        {shown.map(row => (
                            <tr key={row.id} className={`${savingId === row.id ? 'saving' : ''} ${row.urgente ? 'urgent' : ''}`}>
                                <td className="bit-col-flag">
                                    <button
                                        className={`bit-flag ${row.urgente ? 'on' : ''}`}
                                        onClick={() => canEdit ? toggleUrgent(row) : undefined}
                                        title={row.urgente ? 'Quitar urgente' : 'Marcar urgente'}
                                        disabled={!canEdit}
                                    >
                                        <Flag size={15} />
                                    </button>
                                </td>
                                {COLUMNS.map(c => (
                                    <td key={c.key} className={c.multiline ? 'bit-notes' : ''}>
                                        {canEdit ? (
                                            c.multiline ? (
                                                <textarea
                                                    ref={autoSize}
                                                    value={row[c.key] || ''}
                                                    rows={1}
                                                    onChange={e => { editCell(row.id, c.key, e.target.value); autoSize(e.target); }}
                                                    onBlur={() => saveCell(row, c.key)}
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={row[c.key] || ''}
                                                    onChange={e => editCell(row.id, c.key, e.target.value)}
                                                    onBlur={() => saveCell(row, c.key)}
                                                />
                                            )
                                        ) : (
                                            <span className={c.multiline ? 'bit-pre' : ''}>{row[c.key] || '—'}</span>
                                        )}
                                    </td>
                                ))}
                                {canEdit && (
                                    <td className="bit-col-actions">
                                        {savedId === row.id && <Check size={14} className="bit-saved" />}
                                        <button className="bit-del" onClick={() => deleteRow(row.id)} title="Eliminar fila">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default BitacoraView;
