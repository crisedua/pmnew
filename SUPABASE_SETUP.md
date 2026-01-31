# Supabase Setup Instructions

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the database to be provisioned

## 2. Run the Database Schema

1. Go to the SQL Editor in your Supabase dashboard
2. Copy the contents of `supabase-schema.sql`
3. Paste and run the SQL to create all tables and sample data

## 3. Configure Environment Variables

1. Copy `.env.example` to `.env`
2. Get your project URL from Supabase Settings → API
3. Get your anon/public key from Supabase Settings → API
4. Update the `.env` file with your credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 4. Database Tables Created

- **projects**: Main project information
- **tasks**: Tasks associated with projects
- **documents**: Document metadata for projects
- **team_members**: Team member assignments

## 5. Sample Data

The schema includes sample data for "Proyecto Alpha" with:
- 4 tasks (2 In Progress, 2 To Do)
- 3 documents
- 4 team members

## 6. Enable Row Level Security (Optional)

For production, you should enable RLS policies. For development, you can use the anon key with full access.
