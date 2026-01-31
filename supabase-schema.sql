-- Portal de Proyectos - Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  institution VARCHAR(255),
  responsible_email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'En Progreso',
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'To Do', -- 'To Do', 'In Progress', 'Complete'
  priority VARCHAR(20) DEFAULT 'Media', -- 'Alta', 'Media', 'Baja'
  assignee_name VARCHAR(255),
  assignee_email VARCHAR(255),
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  file_type VARCHAR(100),
  uploaded_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team Members table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_team_members_project_id ON team_members(project_id);

-- Insert sample data for testing

-- Sample Project
INSERT INTO projects (id, name, description, institution, responsible_email, status, due_date)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 
   'Proyecto Alpha', 
   'Desarrollo de plataforma digital para optimizar procesos internos y mejorar la experiencia del cliente.',
   'Acme Corporation',
   'juan@acme.com',
   'En Progreso',
   '2026-03-15');

-- Sample Tasks
INSERT INTO tasks (project_id, title, description, status, priority, assignee_name, assignee_email, due_date)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Desarrollo de API REST', 'Crear endpoints para la API', 'In Progress', 'Alta', 'Ana', 'ana@acme.com', '2026-03-01'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Implementación de frontend', 'Desarrollar interfaz de usuario', 'In Progress', 'Alta', 'Carlos', 'carlos@acme.com', '2026-03-10'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Testing y QA', 'Pruebas de calidad', 'To Do', 'Media', 'Juan', 'juan@acme.com', '2026-03-12'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Documentación técnica', 'Crear documentación del proyecto', 'To Do', 'Baja', 'Ana', 'ana@acme.com', '2026-03-14');

-- Sample Documents
INSERT INTO documents (project_id, name, file_type, uploaded_by)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Especificaciones técnicas.pdf', 'application/pdf', 'Juan'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Diseño UI.fig', 'application/figma', 'Ana'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Plan de proyecto.xlsx', 'application/excel', 'Carlos');

-- Sample Team Members
INSERT INTO team_members (project_id, name, email, role)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Juan Pérez', 'juan@acme.com', 'Project Manager'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Ana García', 'ana@acme.com', 'Backend Developer'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Carlos López', 'carlos@acme.com', 'Frontend Developer'),
  ('550e8400-e29b-41d4-a716-446655440000', 'María Rodríguez', 'maria@acme.com', 'UX Designer');
