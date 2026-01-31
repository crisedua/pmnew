-- Portal de Proyectos - Final Database Schema
-- Includes Users, Areas, Projects, Tasks, and Documents

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Users)
-- Automatically created when a user signs up via Supabase Auth
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. AREAS (The main container, e.g., "Marketing", "Engineering")
CREATE TABLE areas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id), -- The owner/creator
  share_token UUID DEFAULT uuid_generate_v4(), -- Permanent link for sharing this area
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AREA MEMBERS (Who has access to an Area)
-- A user can be in multiple areas. 
CREATE TABLE area_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner', 'editor', 'viewer'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(area_id, user_id)
);

-- 4. PROJECTS (Exist INSIDE an Area)
CREATE TABLE projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE NOT NULL, -- Linked to Area
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'En Progreso',
  due_date DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TASKS
CREATE TABLE tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'To Do',
  priority VARCHAR(20) DEFAULT 'Media',
  assignee_id UUID REFERENCES profiles(id),
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. DOCUMENTS
CREATE TABLE documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  file_type VARCHAR(100),
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auto-profile creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger: When a user Creates an Area, automatically add them as a 'owner' member
CREATE OR REPLACE FUNCTION public.add_creator_to_area()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.area_members (area_id, user_id, role)
  VALUES (new.id, new.created_by, 'owner');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_area_created
  AFTER INSERT ON areas
  FOR EACH ROW EXECUTE PROCEDURE public.add_creator_to_area();
