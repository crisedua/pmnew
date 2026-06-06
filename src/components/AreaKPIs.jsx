import React, { useState, useEffect } from 'react';
import { Target, Plus, Edit, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './AreaKPIs.css';

const EMPTY_FORM = {
    name: '',
    description: '',
    unit: 'número',
    baseline_value: 0,
    current_value: 0,
    target_value: 0,
    due_date: '',
};

function formatValue(value, unit) {
    const n = Number(value || 0);
    if (unit === '%') return `${n}%`;
    if (unit === 'moneda') return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
    return n.toLocaleString('es-CL');
}

function kpiProgress(kpi) {
    const base = Number(kpi.baseline_value || 0);
    const current = Number(kpi.current_value || 0);
    const target = Number(kpi.target_value || 0);
    const span = target - base;
    if (span === 0) return current >= target ? 100 : 0;
    const pct = ((current - base) / span) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
}

function AreaKPIs({ areaId, userId, canEdit }) {
    const [kpis, setKpis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (areaId) fetchKpis();
    }, [areaId]);

    const fetchKpis = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('area_kpis')
                .select('*')
                .eq('area_id', areaId)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: true });
            if (error) throw error;
            setKpis(data || []);
        } catch (error) {
            console.error('Error fetching KPIs:', error);
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
    };

    const openEdit = (kpi) => {
        setEditingId(kpi.id);
        setForm({
            name: kpi.name || '',
            description: kpi.description || '',
            unit: kpi.unit || 'número',
            baseline_value: kpi.baseline_value ?? 0,
            current_value: kpi.current_value ?? 0,
            target_value: kpi.target_value ?? 0,
            due_date: kpi.due_date || '',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setIsSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                description: form.description,
                unit: form.unit,
                baseline_value: Number(form.baseline_value) || 0,
                current_value: Number(form.current_value) || 0,
                target_value: Number(form.target_value) || 0,
                due_date: form.due_date || null,
            };

            if (editingId) {
                const { error } = await supabase
                    .from('area_kpis')
                    .update({ ...payload, updated_at: new Date().toISOString() })
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('area_kpis')
                    .insert({ ...payload, area_id: areaId, created_by: userId });
                if (error) throw error;
            }

            setShowModal(false);
            await fetchKpis();
        } catch (error) {
            console.error('Error saving KPI:', error);
            alert('Error al guardar el KPI: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este KPI?')) return;
        try {
            const { error } = await supabase.from('area_kpis').delete().eq('id', id);
            if (error) throw error;
            await fetchKpis();
        } catch (error) {
            console.error('Error deleting KPI:', error);
            alert('Error al eliminar el KPI: ' + error.message);
        }
    };

    return (
        <div className="area-kpis">
            <div className="kpis-header">
                <h3><Target size={18} /> KPIs de la Comisión</h3>
                {canEdit && (
                    <button className="btn btn-primary btn-sm" onClick={openCreate}>
                        <Plus size={16} /> Nuevo KPI
                    </button>
                )}
            </div>

            {loading ? (
                <div className="kpis-empty">Cargando KPIs...</div>
            ) : kpis.length === 0 ? (
                <div className="kpis-empty">
                    Aún no hay KPIs definidos para esta comisión.
                    {canEdit && ' Crea el primero para empezar a medir el avance.'}
                </div>
            ) : (
                <div className="kpis-grid">
                    {kpis.map((kpi) => {
                        const progress = kpiProgress(kpi);
                        return (
                            <div key={kpi.id} className="kpi-card card">
                                <div className="kpi-card-header">
                                    <h4>{kpi.name}</h4>
                                    {canEdit && (
                                        <div className="kpi-actions">
                                            <button className="btn-icon" onClick={() => openEdit(kpi)} title="Editar">
                                                <Edit size={16} />
                                            </button>
                                            <button className="btn-icon" onClick={() => handleDelete(kpi.id)} title="Eliminar">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {kpi.description && <p className="kpi-desc">{kpi.description}</p>}

                                <div className="kpi-values">
                                    <span className="kpi-current">{formatValue(kpi.current_value, kpi.unit)}</span>
                                    <span className="kpi-target">/ {formatValue(kpi.target_value, kpi.unit)}</span>
                                </div>

                                <div className="kpi-bar">
                                    <div className="kpi-bar-fill" style={{ width: `${progress}%` }} />
                                </div>
                                <div className="kpi-bar-meta">
                                    <span>{progress}%</span>
                                    {kpi.due_date && <span>Meta: {kpi.due_date}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => !isSaving && setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingId ? 'Editar KPI' : 'Nuevo KPI'}</h3>
                            <button className="btn-icon" onClick={() => setShowModal(false)} disabled={isSaving}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Nombre del KPI *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Ej: Participación, Iniciativas cerradas..."
                                />
                            </div>
                            <div className="form-group">
                                <label>Descripción</label>
                                <textarea
                                    rows="2"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Unidad</label>
                                    <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                                        <option value="número">Número</option>
                                        <option value="%">Porcentaje (%)</option>
                                        <option value="moneda">Moneda</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Fecha meta</label>
                                    <input
                                        type="date"
                                        value={form.due_date}
                                        onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Línea base</label>
                                    <input
                                        type="number"
                                        value={form.baseline_value}
                                        onChange={(e) => setForm({ ...form, baseline_value: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Valor actual</label>
                                    <input
                                        type="number"
                                        value={form.current_value}
                                        onChange={(e) => setForm({ ...form, current_value: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Meta</label>
                                    <input
                                        type="number"
                                        value={form.target_value}
                                        onChange={(e) => setForm({ ...form, target_value: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn" onClick={() => setShowModal(false)} disabled={isSaving}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || !form.name.trim()}>
                                {isSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AreaKPIs;
