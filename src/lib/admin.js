// Rol de administrador a nivel de plataforma.
// - admin: crea/gestiona comisiones, proyectos, tareas y ve todo.
// - super admin: además gestiona usuarios (otorga/quita el rol admin).
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

/** ¿El usuario indicado es SUPER administrador (gestiona usuarios)? */
export async function fetchIsSuperAdmin(userId) {
    if (!userId) return false;
    const { data, error } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', userId)
        .maybeSingle();
    if (error) {
        console.warn('No se pudo verificar el rol de super admin:', error.message);
        return false;
    }
    return !!data?.is_super_admin;
}

