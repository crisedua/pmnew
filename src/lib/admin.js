// Rol de administrador a nivel de plataforma.
// Solo los admins pueden crear proyectos, tareas e invitar equipo.
import { supabase } from './supabase';

/** ¿El usuario indicado es administrador de la plataforma? */
export async function fetchIsAdmin(userId) {
    if (!userId) return false;
    const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .maybeSingle();
    if (error) {
        console.warn('No se pudo verificar el rol de admin:', error.message);
        return false;
    }
    return !!data?.is_admin;
}
