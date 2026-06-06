import React from 'react';
import { getTaskHealth, isAutoHealth, HEALTH } from '../lib/health';
import './TaskHealthBadge.css';

/**
 * Punto de semáforo de una tarea.
 * props:
 *  - task: la tarea
 *  - showLabel: muestra el texto del estado junto al punto
 *  - onClick: si se entrega, el badge es clickeable (para editar)
 */
function TaskHealthBadge({ task, showLabel = false, onClick }) {
    const key = getTaskHealth(task);
    const info = HEALTH[key];
    const auto = isAutoHealth(task);

    const title = `${info.label}${auto ? ' (automático)' : ' (manual)'}` +
        (task?.health_note ? ` — ${task.health_note}` : '');

    return (
        <span
            className={`health-badge ${onClick ? 'clickable' : ''}`}
            title={title}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
        >
            <span className="health-dot" style={{ backgroundColor: info.color }} />
            {showLabel && <span className="health-label">{info.label}</span>}
        </span>
    );
}

export default TaskHealthBadge;
