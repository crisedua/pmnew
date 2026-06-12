// Helpers de avatar reutilizables (iniciales + color determinista).
const AVATAR_COLORS = ['#24528f', '#3f9c43', '#7c3aed', '#0891b2', '#d97706', '#db2777', '#0d9488'];

/** Color estable a partir de un nombre (mismo nombre -> mismo color). */
export function avatarColor(name = '') {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Iniciales (1-2 letras) a partir de un nombre o email. */
export function initials(name = '') {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
