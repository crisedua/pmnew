import React from 'react';
import { ArrowLeft } from 'lucide-react';
import './AppHeader.css';

const ASIVA_LOGO = 'https://www.asiva.cl/wp-content/uploads/2023/05/Asiva-Logo-blanco.png';

/**
 * Encabezado de marca ASIVA, reutilizable en todas las páginas.
 * props:
 *  - title: título de la página (opcional)
 *  - icon: icono junto al título (opcional)
 *  - onBack: si se entrega, muestra botón "volver"
 *  - children: acciones a la derecha (opcional)
 */
function AppHeader({ title, icon, onBack, children }) {
    return (
        <header className="app-header">
            <div className="app-header-left">
                {onBack && (
                    <button className="app-header-back" onClick={onBack} title="Volver">
                        <ArrowLeft size={20} />
                    </button>
                )}
                <img
                    src={ASIVA_LOGO}
                    alt="ASIVA"
                    className="app-header-logo"
                    onError={(e) => { e.currentTarget.src = '/asiva-logo.svg'; }}
                />
                {title && (
                    <>
                        <span className="app-header-divider" />
                        <h1 className="app-header-title">
                            {icon}
                            {title}
                        </h1>
                    </>
                )}
            </div>
            {children && <div className="app-header-right">{children}</div>}
        </header>
    );
}

export default AppHeader;
