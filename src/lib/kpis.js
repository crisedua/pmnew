// Capa de KPIs calculados (vistas SQL: kpi_proyecto, kpi_comision,
// kpi_carga_responsable). Solo lectura: el front pinta, la lógica
// de negocio vive en las vistas de Supabase (supabase-kpis.sql).
import { supabase } from './supabase';

/** KPIs por proyecto de una comisión (área). */
export async function fetchProjectKpis(comisionId) {
    if (!comisionId) return [];
    const { data, error } = await supabase
        .from('kpi_proyecto')
        .select('*')
        .eq('comision_id', comisionId);
    if (error) {
        console.warn('Error fetching kpi_proyecto:', error.message);
        return [];
    }
    return data || [];
}

/** KPI agregado de una comisión (área). Devuelve una fila o null. */
export async function fetchComisionKpi(comisionId) {
    if (!comisionId) return null;
    const { data, error } = await supabase
        .from('kpi_comision')
        .select('*')
        .eq('comision_id', comisionId)
        .maybeSingle();
    if (error) {
        console.warn('Error fetching kpi_comision:', error.message);
        return null;
    }
    return data;
}

/** Todos los KPIs de proyecto visibles (todas las comisiones del usuario). */
export async function fetchAllProjectKpis() {
    const { data, error } = await supabase
        .from('kpi_proyecto')
        .select('*');
    if (error) {
        console.warn('Error fetching all kpi_proyecto:', error.message);
        return [];
    }
    return data || [];
}

/** KPI agregado de todas las comisiones del usuario. */
export async function fetchAllComisionKpis() {
    const { data, error } = await supabase
        .from('kpi_comision')
        .select('*');
    if (error) {
        console.warn('Error fetching all kpi_comision:', error.message);
        return [];
    }
    return data || [];
}

/** Carga de actividades abiertas por responsable en una comisión. */
export async function fetchResponsableLoad(comisionId) {
    if (!comisionId) return [];
    const { data, error } = await supabase
        .from('kpi_carga_responsable')
        .select('*')
        .eq('comision_id', comisionId)
        .order('actividades_abiertas', { ascending: false });
    if (error) {
        console.warn('Error fetching kpi_carga_responsable:', error.message);
        return [];
    }
    return data || [];
}

/** Etiqueta y color para el estado_salud de un proyecto. */
export const ESTADO_SALUD = {
    en_plan: { label: 'En plan', color: '#22c55e' },
    en_riesgo: { label: 'En riesgo', color: '#f59e0b' },
    atrasado: { label: 'Atrasado', color: '#ef4444' },
};
