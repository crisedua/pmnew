// Subcomisiones: nivel intermedio entre Comisión (area) y Proyecto.
import { supabase } from './supabase';

/** Subcomisiones de una comisión (área), ordenadas. */
export async function fetchSubcomisiones(areaId) {
    if (!areaId) return [];
    const { data, error } = await supabase
        .from('subcomisiones')
        .select('*')
        .eq('area_id', areaId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    if (error) {
        console.warn('Error fetching subcomisiones:', error.message);
        return [];
    }
    return data || [];
}

/** Subcomisiones de varias comisiones, agrupadas por area_id. */
export async function fetchSubcomisionesByAreas(areaIds = []) {
    if (areaIds.length === 0) return {};
    const { data, error } = await supabase
        .from('subcomisiones')
        .select('*')
        .in('area_id', areaIds)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    if (error) {
        console.warn('Error fetching subcomisiones by areas:', error.message);
        return {};
    }
    const map = {};
    (data || []).forEach((s) => {
        (map[s.area_id] = map[s.area_id] || []).push(s);
    });
    return map;
}

/** Crea una subcomisión. Devuelve la fila creada o null. */
export async function createSubcomision(areaId, name, userId) {
    const { data, error } = await supabase
        .from('subcomisiones')
        .insert({ area_id: areaId, name: name.trim(), created_by: userId })
        .select()
        .single();
    if (error) {
        console.error('Error creating subcomision:', error);
        throw error;
    }
    return data;
}

/** Elimina una subcomisión (sus proyectos quedan sin subcomisión). */
export async function deleteSubcomision(id) {
    const { error } = await supabase.from('subcomisiones').delete().eq('id', id);
    if (error) {
        console.error('Error deleting subcomision:', error);
        throw error;
    }
}
