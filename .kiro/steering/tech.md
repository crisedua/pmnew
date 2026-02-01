# Technology Stack

## Frontend Framework
- **React 19.2.0** with JSX
- **Vite 7.2.4** as build tool and dev server
- **React Router DOM 7.13.0** for client-side routing

## Backend & Database
- **Supabase** (PostgreSQL) for backend services
- **@supabase/supabase-js 2.93.3** client library
- Real-time subscriptions and authentication

## UI & Styling
- **Custom CSS** with CSS variables for theming
- **Lucide React 0.563.0** for icons
- **@floating-ui/dom 1.7.5** for floating UI elements
- **TipTap** rich text editor with extensions

## Development Tools
- **ESLint 9.39.1** with React-specific plugins
- **TypeScript types** for React (dev dependency)
- **ES Modules** (type: "module" in package.json)

## Common Commands

### Development
```bash
npm run dev          # Start development server (http://localhost:5173)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Environment Setup
```bash
# Required environment variables in .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Build Configuration
- **Vite config**: Standard React plugin setup
- **ESLint config**: Flat config format with React hooks and refresh plugins
- **Module system**: ES modules throughout
- **Target**: Modern browsers (ES2020+)