# Project Structure

## Root Directory
```
pm/
├── src/                    # Source code
├── public/                 # Static assets
├── .kiro/                  # Kiro configuration and steering
├── node_modules/           # Dependencies
├── supabase-*.sql         # Database schema files
├── .env                   # Environment variables
└── package.json           # Project configuration
```

## Source Code Organization (`src/`)

### Pages (`src/pages/`)
Main application pages with routing:
- `Landing.jsx` - Marketing landing page (/)
- `Auth.jsx` - Login/Register pages (/login, /register)
- `Dashboard.jsx` - Project dashboard (/dashboard)
- `ProjectDetail.jsx` - Project detail view (/project/:id)
- `DocumentEditor.jsx` - Document editing (/document/:id)
- `JoinProject.jsx` - Project invitation handling (/join/:id)

### Components (`src/components/`)
Reusable UI components:
- `ProjectSummary.jsx` - Project overview tab
- `TasksView.jsx` - Kanban and list task views
- `DocumentsTab.jsx` - Document management tab
- `TeamTab.jsx` - Team member management
- `AIAssistant.jsx` - AI assistant integration

### Library (`src/lib/`)
Utility modules and configurations:
- `supabase.js` - Supabase client setup
- `openai.js` - OpenAI integration
- `knowledgeBase.js` - Knowledge base utilities

### Styling Convention
- Each component has a corresponding `.css` file
- Global styles in `src/index.css`
- CSS variables for theming
- Component-scoped styling

## Database Schema Files
- `supabase-schema.sql` - Main database schema
- `supabase-invitations.sql` - Invitation system
- `supabase-vectors.sql` - Vector/AI features
- `SUPABASE_SETUP.md` - Setup documentation

## Architecture Patterns

### Component Structure
- Functional components with hooks
- Protected routes with authentication
- Component + CSS file pairing

### Data Flow
- Supabase client for all backend operations
- React Router for navigation
- Environment variables for configuration

### File Naming
- PascalCase for React components
- kebab-case for CSS files
- camelCase for utility functions