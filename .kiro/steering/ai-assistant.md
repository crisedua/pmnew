---
inclusion: manual
---

# AI Assistant Feature

## Overview

The AI Assistant is an intelligent chatbot integrated throughout the application that helps users manage projects, search documents, and get insights about their work.

## Capabilities

### Voice Input
- **Speech-to-Text**: Users can speak their questions instead of typing
- **Browser Support**: Works in Chrome, Edge, and other browsers supporting Web Speech API
- **Spanish Language**: Configured for Spanish (es-ES) by default
- **Visual Feedback**: Microphone button pulses red while listening

### Document Search
- **Semantic Search**: Uses OpenAI embeddings to search document content
- **Cross-Area Access**: Can search documents across all areas the user has access to
- **Context-Aware**: Returns relevant document chunks with similarity scores

### Project Management
- **Task Creation**: Create tasks with priorities in any project
- **Task Queries**: Get pending tasks filtered by project or across all projects
- **Project Summaries**: Get statistics and progress for specific projects or all projects
- **Area Information**: View all areas the user is part of with project counts

### Document Management
- **List Documents**: View all documents across projects and areas
- **Filter by Project**: Narrow document lists to specific projects

## Technical Implementation

### Components
- **AIAssistant.jsx**: Main chat interface component
- **openai.js**: OpenAI API integration for chat and embeddings
- **knowledgeBase.js**: Document processing and vector search utilities

### Database Tables
- **document_chunks**: Stores document text chunks with embeddings (vector(1536))
- **documents**: Document metadata and references
- Uses pgvector extension for similarity search

### Key Functions

#### Document Processing
```javascript
processDocumentForKnowledgeBase(supabase, documentId, file)
```
- Extracts text from uploaded files
- Chunks text into manageable pieces (1000 chars with 200 char overlap)
- Generates embeddings using OpenAI text-embedding-3-small
- Stores chunks in document_chunks table

#### Semantic Search
```javascript
searchKnowledgeBase(supabase, query, areaId, limit)
```
- Generates embedding for user query
- Calls match_document_chunks RPC function
- Returns relevant chunks with similarity scores
- Filters by area if specified

### OpenAI Function Calling

The assistant uses OpenAI's function calling feature with these tools:
- `create_task`: Create new tasks
- `get_pending_tasks`: Query incomplete tasks
- `get_project_summary`: Get project statistics
- `get_area_info`: View area information
- `search_documents`: Semantic document search
- `list_documents`: List available documents

## Usage Patterns

### In Dashboard
```jsx
<AIAssistant
    areaId={selectedArea.id}
    userId={user.id}
    projects={projects}
    tasks={allTasks}
    documents={[]}
    onAction={() => {
        fetchProjects(selectedArea.id);
        fetchAllTasks();
    }}
/>
```

### In ProjectDetail
```jsx
<AIAssistant
    areaId={project.area_id}
    userId={user.id}
    projects={[project]}
    tasks={tasks}
    documents={documents}
    onAction={fetchProjectData}
/>
```

## Environment Variables

Required in `.env`:
```bash
VITE_OPENAI_API_KEY=sk-...
```

## Database Setup

Run `supabase-vectors.sql` to set up:
- pgvector extension
- document_chunks table
- Similarity search function
- Row-level security policies

## User Experience

### Voice Input
Users can click the microphone button to speak their question:
1. Click microphone icon
2. Speak the question in Spanish
3. Text appears in input field automatically
4. Click send or press Enter to submit

### Suggested Actions
The assistant shows contextual quick actions:
- "¿Qué está pendiente?" - View pending tasks
- "Resumen de proyectos" - Get project summaries
- "Mis áreas" - View user's areas
- "Buscar en docs" - Search document content

### Conversation Flow
1. User sends message
2. System builds context with current projects, tasks, areas
3. OpenAI determines if function call is needed
4. Function executes and returns data
5. OpenAI generates natural language response
6. Response displayed to user

## Best Practices

### When Adding Document Upload
Always process documents for the knowledge base:
```javascript
await processDocumentForKnowledgeBase(supabase, documentId, file);
```

### When Querying Documents
Use semantic search for content questions:
```javascript
const results = await searchKnowledgeBase(supabase, query, areaId, 5);
```

### Error Handling
- Gracefully handle missing OpenAI API key
- Provide fallback responses if API fails
- Log errors without breaking user experience

## Future Enhancements

- PDF text extraction (currently placeholder)
- Real-time document updates
- Multi-language support
- Voice input/output
- Document summarization
- Task recommendations based on document content