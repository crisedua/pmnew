import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, Clock, CheckCircle2, FolderKanban } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchAllProjectKpis, fetchAllComisionKpis, ESTADO_SALUD } from '../lib/kpis';
import AppHeader from '../components/AppHeader';
import './Board.css';

function Board() {
    const navigate = useNavigate();
    const [comisiones, setComisiones] = useState([]);
    const [projectKpis, setProjectKpis] = useState([]);
    const [comisionKpis, setComisionKpis] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/login');
            return;
        }

        const { data: ams } = await supabase
            .from('area_members')
            .select('areas ( id, name )')
            .eq('user_id', user.id);
        const coms = (ams || []).map(a => a.areas).filter(Boolean);

        const [pk, ck] = await Promise.all([
            fetchAllProjectKpis(),
            fetchAllComisionKpis(),
        ]);

        setComisiones(coms);
        setProjectKpis(pk);
        setComisionKpis(ck);
        setLoading(false);
    };

    if (loading) return <div className="loading">Cargando tablero...</div>;

    // KPIs agregados de TODOS los proyectos
    const total = projectKpis.length;
    const completados = projectKpis.filter(p => p.avance_pct === 100).length;
    const enRiesgo = projectKpis.filter(p => p.estado_salud === 'en_riesgo').length;
    const atrasados = projectKpis.filter(p => p.estado_salud === 'atrasado').length;
    const actVencidas = projectKpis.reduce((s, p) => s + (p.actividades_vencidas || 0), 0);
    const sumPeso = projectKpis.reduce((s, p) => s + (p.peso || 0), 0);
    const avanceGlobal = sumPeso > 0
        ? Math.round(projectKpis.reduce((s, p) => s + p.avance_pct * (p.peso || 0), 0) / sumPeso)
        : 0;

    // Proyectos agrupados por comisión
    const byComision = {};
    projectKpis.forEach(p => {
        (byComision[p.comision_id] = byComision[p.comision_id] || []).push(p);
    });
    // Asegura una columna por cada comisión del usuario (aunque no tenga proyectos)
    const columns = comisiones.map(c => ({
        id: c.id,
        name: c.name,
        projects: (byComision[c.id] || []).sort((a, b) => a.avance_pct - b.avance_pct),
    }));

    return (
        <div className="board-page">
            <AppHeader
                title="Tablero de Subcomisiones"
                icon={<FolderKanban size={20} />}
                onBack={() => navigate('/dashboard')}
            />

            <div className="board-body">
            {/* KPIs globales */}
            <div className="board-kpis">
                <div className="board-kpi big">
                    <span className="board-kpi-label">Avance global</span>
                    <span className="board-kpi-value">{avanceGlobal}%</span>
                    <div className="board-kpi-bar">
                        <div className="board-kpi-fill" style={{ width: `${avanceGlobal}%` }} />
                    </div>
                </div>
                <div className="board-kpi">
                    <LayoutDashboard size={20} className="kpi-ic" />
                    <span className="board-kpi-value">{total}</span>
                    <span className="board-kpi-label">Subcomisiones</span>
                </div>
                <div className="board-kpi ok">
                    <CheckCircle2 size={20} className="kpi-ic" />
                    <span className="board-kpi-value">{completados}</span>
                    <span className="board-kpi-label">Completados</span>
                </div>
                <div className="board-kpi warn">
                    <AlertTriangle size={20} className="kpi-ic" />
                    <span className="board-kpi-value">{enRiesgo}</span>
                    <span className="board-kpi-label">En riesgo</span>
                </div>
                <div className="board-kpi danger">
                    <AlertTriangle size={20} className="kpi-ic" />
                    <span className="board-kpi-value">{atrasados}</span>
                    <span className="board-kpi-label">Atrasados</span>
                </div>
                <div className="board-kpi danger">
                    <Clock size={20} className="kpi-ic" />
                    <span className="board-kpi-value">{actVencidas}</span>
                    <span className="board-kpi-label">Act. vencidas</span>
                </div>
            </div>

            {/* Board por comisión */}
            {total === 0 && (
                <div className="board-empty">
                    No hay datos de subcomisiones. ¿Ya ejecutaste <code>supabase-kpis.sql</code> en Supabase?
                </div>
            )}

            <div className="board-columns">
                {columns.map(col => {
                    const comK = comisionKpis.find(c => c.comision_id === col.id);
                    return (
                        <div key={col.id} className="board-column">
                            <div className="board-column-header">
                                <span className="board-column-name">{col.name}</span>
                                <span className="board-column-count">{col.projects.length}</span>
                                {comK && (
                                    <span className="board-column-avance">{comK.avance_global_pct}%</span>
                                )}
                            </div>
                            <div className="board-column-cards">
                                {col.projects.length === 0 ? (
                                    <div className="board-card-empty">Sin subcomisiones</div>
                                ) : (
                                    col.projects.map(p => {
                                        const estado = ESTADO_SALUD[p.estado_salud];
                                        return (
                                            <div
                                                key={p.proyecto_id}
                                                className="board-card"
                                                onClick={() => navigate(`/project/${p.proyecto_id}`)}
                                            >
                                                <div className="board-card-top">
                                                    <span className="board-card-name">{p.proyecto_nombre}</span>
                                                    {estado && (
                                                        <span
                                                            className="board-card-estado"
                                                            style={{ color: estado.color, borderColor: estado.color }}
                                                        >
                                                            {estado.label}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="board-card-bar">
                                                    <div className="board-card-fill" style={{ width: `${p.avance_pct}%` }} />
                                                </div>
                                                <div className="board-card-meta">
                                                    <span>{p.avance_pct}%</span>
                                                    <span>{p.actividades_completadas}/{p.actividades_total} act.</span>
                                                    {p.actividades_vencidas > 0 && (
                                                        <span className="meta-overdue">⏰ {p.actividades_vencidas}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            </div>
        </div>
    );
}

export default Board;
