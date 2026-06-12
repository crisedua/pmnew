import React from 'react';
import { Hammer } from 'lucide-react';
import './Placeholder.css';

/**
 * Vista de marcador de posición para secciones aún no construidas.
 * props: title, subtitle (opcional)
 */
function Placeholder({ title, subtitle }) {
    return (
        <div className="ph-view">
            <h1 className="ph-title">{title}</h1>
            <div className="ph-card">
                <div className="ph-icon"><Hammer size={26} /></div>
                <h2 className="ph-heading">En construcción</h2>
                <p className="ph-text">
                    {subtitle || `La sección "${title}" estará disponible pronto.`}
                </p>
            </div>
        </div>
    );
}

export default Placeholder;
