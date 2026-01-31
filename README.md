# Portal de Proyectos 📊

Una plataforma completa de gestión de proyectos con interfaz moderna, seguimiento de tareas tipo Kanban, gestión de documentos y colaboración en equipo.

## ✨ Características

- 🎨 **Diseño Moderno**: Interfaz dual con tema claro (landing) y oscuro (aplicación)
- 📋 **Gestión de Proyectos**: Visualización de proyectos con progreso y estadísticas
- 🎯 **Tablero Kanban**: Vista Kanban y Lista para gestión de tareas
- 📄 **Gestión de Documentos**: Almacenamiento y organización de archivos
- 👥 **Colaboración**: Gestión de equipos y asignación de tareas
- 🔄 **Tiempo Real**: Sincronización con Supabase para datos actualizados
- 📱 **Responsive**: Diseño adaptable a todos los dispositivos

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+ instalado
- Cuenta de Supabase (gratuita en [supabase.com](https://supabase.com))

### Instalación

1. **Clonar el repositorio** (si aplica)
   ```bash
   cd c:\Desarrollo\ Cursos\pm
   ```

2. **Las dependencias ya están instaladas**
   Si no, ejecuta:
   ```bash
   npm install
   ```

3. **Configurar Supabase**
   
   a. Crea un proyecto en [Supabase](https://supabase.com)
   
   b. Ve al SQL Editor y ejecuta el contenido de `supabase-schema.sql`
   
   c. Crea un archivo `.env` en la raíz del proyecto:
   ```bash
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anon
   ```
   
   Encuentra estos valores en: `Supabase Dashboard → Settings → API`

4. **Iniciar el servidor de desarrollo**
   ```bash
   npm run dev
   ```

5. **Abrir en el navegador**
   ```
   http://localhost:5173
   ```

## 📁 Estructura del Proyecto

```
pm/
├── src/
│   ├── components/          # Componentes React reutilizables
│   │   ├── ProjectSummary.jsx    # Tab de resumen del proyecto
│   │   ├── TasksView.jsx          # Vista Kanban y Lista de tareas
│   │   ├── DocumentsTab.jsx       # Tab de documentos
│   │   └── TeamTab.jsx            # Tab de equipo
│   ├── pages/              # Páginas principales
│   │   ├── Landing.jsx           # Página de aterrizaje
│   │   ├── Dashboard.jsx         # Dashboard de proyectos
│   │   └── ProjectDetail.jsx     # Detalle del proyecto
│   ├── lib/                # Utilidades y configuración
│   │   └── supabase.js          # Cliente de Supabase
│   ├── App.jsx             # Componente raíz con rutas
│   ├── main.jsx            # Punto de entrada
│   └── index.css           # Estilos globales y sistema de diseño
├── supabase-schema.sql     # Schema de base de datos
├── SUPABASE_SETUP.md       # Guía de configuración de Supabase
└── package.json
```

## 🗄️ Base de Datos

### Tablas Creadas

- **projects**: Información de proyectos
- **tasks**: Tareas con estado, prioridad y asignaciones
- **documents**: Metadatos de documentos
- **team_members**: Miembros del equipo por proyecto

Ver `supabase-schema.sql` para el schema completo.

## 🎨 Tecnologías

- **Frontend**: React 18 + Vite
- **Routing**: React Router DOM
- **Backend**: Supabase (PostgreSQL)
- **Estilos**: CSS personalizado con variables CSS
- **Iconos**: Lucide React
- **Fechas**: date-fns

## 📱 Páginas y Funcionalidades

### 1. Landing Page (`/`)
- Presentación del producto
- Sección de características
- CTA para acceder al portal

### 2. Dashboard (`/dashboard`)
- Lista de proyectos del usuario
- Progreso visual de cada proyecto
- Navegación a detalles del proyecto

### 3. Detalle del Proyecto (`/project/:id`)

**Tab Resumen:**
- Información del proyecto
- Estadísticas (tareas completadas, en progreso, pendientes, documentos)
- Barra de progreso general

**Tab Tareas:**
- Vista Kanban con columnas: To Do, In Progress, Complete
- Vista Lista con filtros y búsqueda
- Badges de prioridad (Alta, Media, Baja)
- Asignación de responsables y fechas

**Tab Documentos:**
- Lista de documentos adjuntos
- Información de archivos

**Tab Equipo:**
- Miembros del equipo
- Roles y contactos

## 🎯 Próximos Pasos

- [ ] Autenticación de usuarios
- [ ] Drag & drop en Kanban
- [ ] Subida real de archivos
- [ ] Notificaciones en tiempo real
- [ ] Exportar informes
- [ ] Modo offline con cache

## 🔧 Scripts Disponibles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run preview      # Preview del build
npm run lint         # Linter de código
```

## 📝 Notas de Desarrollo

- La aplicación usa **tema claro** en la landing page y **tema oscuro** en la aplicación
- Los datos de ejemplo están incluidos en `supabase-schema.sql`
- El proyecto está configurado para funcionar sin autenticación (útil para desarrollo)
- Las imágenes son emojis por simplicidad, se pueden reemplazar con logos reales

## 🤝 Contribuir

1. Haz fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 💬 Soporte

Si encuentras algún problema o tienes preguntas, por favor abre un issue en el repositorio.

---

**Desarrollado con ❤️ usando React + Vite + Supabase**
