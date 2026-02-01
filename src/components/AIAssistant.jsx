import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Sparkles, Bot, FileText, Plus, Search, Mic, MicOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { callOpenAI } from '../lib/openai';
import { searchKnowledgeBase } from '../lib/knowledgeBase';
import './AIAssistant.css';

function AIAssistant({ areaId, projects = [], tasks = [], documents = [], onAction, userId = null }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: 'Hola 👋 Soy tu asistente de proyecto con AI. Puedo ayudarte a crear tareas, analizar documentos, responder preguntas sobre tus proyectos y áreas, y mucho más. ¿Qué necesitas?'
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [userAreas, setUserAreas] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const messagesEndRef = useRef(null);
    const conversationHistory = useRef([]);
    const recognitionRef = useRef(null);

    // Fetch user's areas on mount
    useEffect(() => {
        if (userId) {
            fetchUserAreas();
        }
    }, [userId]);

    // Initialize speech recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'es-ES'; // Spanish

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInputValue(transcript);
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const fetchUserAreas = async () => {
        try {
            const { data, error } = await supabase
                .from('area_members')
                .select('area_id, areas(id, name, description)')
                .eq('user_id', userId);

            if (error) throw error;
            setUserAreas(data?.map(am => am.areas) || []);
        } catch (error) {
            console.error('Error fetching user areas:', error);
        }
    };

    const toggleVoiceInput = () => {
        if (!recognitionRef.current) {
            alert('Tu navegador no soporta reconocimiento de voz. Intenta con Chrome o Edge.');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (error) {
                console.error('Error starting speech recognition:', error);
            }
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Define available tools/functions for OpenAI
    const tools = [
        {
            type: 'function',
            function: {
                name: 'create_task',
                description: 'Create a new task in a project',
                parameters: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            description: 'The title of the task'
                        },
                        project_name: {
                            type: 'string',
                            description: 'Name of the project to add the task to'
                        },
                        priority: {
                            type: 'string',
                            enum: ['Alta', 'Media', 'Baja'],
                            description: 'Priority level of the task'
                        },
                        description: {
                            type: 'string',
                            description: 'Optional description of the task'
                        }
                    },
                    required: ['title']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_pending_tasks',
                description: 'Get list of pending/incomplete tasks across all projects or a specific project',
                parameters: {
                    type: 'object',
                    properties: {
                        project_name: {
                            type: 'string',
                            description: 'Optional: filter by project name'
                        }
                    },
                    required: []
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_project_summary',
                description: 'Get summary and statistics for a specific project or all projects',
                parameters: {
                    type: 'object',
                    properties: {
                        project_name: {
                            type: 'string',
                            description: 'Optional: specific project name to get details for'
                        }
                    },
                    required: []
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_area_info',
                description: 'Get information about user areas, including projects and members',
                parameters: {
                    type: 'object',
                    properties: {
                        area_name: {
                            type: 'string',
                            description: 'Optional: specific area name'
                        }
                    },
                    required: []
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'search_documents',
                description: 'Search through document contents using AI knowledge base across all areas the user has access to. Use this to answer questions about document content, find specific information, or analyze documents.',
                parameters: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'The search query or question about document contents'
                        },
                        area_name: {
                            type: 'string',
                            description: 'Optional: limit search to specific area'
                        }
                    },
                    required: ['query']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'list_documents',
                description: 'List all documents available in projects, optionally filtered by project or area',
                parameters: {
                    type: 'object',
                    properties: {
                        project_name: {
                            type: 'string',
                            description: 'Optional: filter by project name'
                        }
                    },
                    required: []
                }
            }
        }
    ];

    // Execute the function calls
    const executeFunction = async (functionName, args) => {
        try {
            switch (functionName) {
                case 'create_task': {
                    const { title, project_name, priority = 'Media', description = '' } = args;

                    // Find project
                    let projectId = projects.length > 0 ? projects[0].id : null;
                    if (project_name) {
                        const project = projects.find(p =>
                            p.name.toLowerCase().includes(project_name.toLowerCase())
                        );
                        if (project) projectId = project.id;
                    }

                    if (!projectId) {
                        return { success: false, message: 'No se encontró el proyecto especificado.' };
                    }

                    const { error } = await supabase.from('tasks').insert({
                        project_id: projectId,
                        title,
                        description,
                        status: 'To Do',
                        priority
                    });

                    if (error) throw error;

                    if (onAction) onAction();
                    return {
                        success: true,
                        message: `✅ Tarea creada: "${title}" con prioridad ${priority}`
                    };
                }

                case 'get_pending_tasks': {
                    const { project_name } = args;
                    let filteredTasks = tasks.filter(t => t.status !== 'Complete');

                    if (project_name) {
                        const project = projects.find(p =>
                            p.name.toLowerCase().includes(project_name.toLowerCase())
                        );
                        if (project) {
                            filteredTasks = filteredTasks.filter(t => t.project_id === project.id);
                        }
                    }

                    return {
                        success: true,
                        total: filteredTasks.length,
                        tasks: filteredTasks.map(t => ({
                            title: t.title,
                            priority: t.priority,
                            status: t.status,
                            project: projects.find(p => p.id === t.project_id)?.name || 'Unknown'
                        }))
                    };
                }

                case 'get_project_summary': {
                    const { project_name } = args;

                    if (project_name) {
                        const project = projects.find(p =>
                            p.name.toLowerCase().includes(project_name.toLowerCase())
                        );

                        if (!project) {
                            return { success: false, message: 'Proyecto no encontrado.' };
                        }

                        const projectTasks = tasks.filter(t => t.project_id === project.id);
                        const completed = projectTasks.filter(t => t.status === 'Complete').length;
                        const inProgress = projectTasks.filter(t => t.status === 'In Progress').length;
                        const todo = projectTasks.filter(t => t.status === 'To Do').length;

                        return {
                            success: true,
                            project: {
                                name: project.name,
                                status: project.status,
                                description: project.description,
                                tasks: {
                                    total: projectTasks.length,
                                    completed,
                                    inProgress,
                                    todo
                                },
                                progress: projectTasks.length > 0 
                                    ? Math.round((completed / projectTasks.length) * 100) 
                                    : 0
                            }
                        };
                    } else {
                        // Summary of all projects
                        const summary = projects.map(p => {
                            const projectTasks = tasks.filter(t => t.project_id === p.id);
                            const completed = projectTasks.filter(t => t.status === 'Complete').length;
                            return {
                                name: p.name,
                                status: p.status,
                                totalTasks: projectTasks.length,
                                completed,
                                progress: projectTasks.length > 0 
                                    ? Math.round((completed / projectTasks.length) * 100) 
                                    : 0
                            };
                        });

                        return {
                            success: true,
                            totalProjects: projects.length,
                            projects: summary
                        };
                    }
                }

                case 'get_area_info': {
                    const { area_name } = args;

                    if (area_name) {
                        const area = userAreas.find(a =>
                            a.name.toLowerCase().includes(area_name.toLowerCase())
                        );

                        if (!area) {
                            return { success: false, message: 'Área no encontrada.' };
                        }

                        // Get projects in this area
                        const areaProjects = projects.filter(p => p.area_id === area.id);

                        return {
                            success: true,
                            area: {
                                name: area.name,
                                description: area.description,
                                projectCount: areaProjects.length,
                                projects: areaProjects.map(p => p.name)
                            }
                        };
                    } else {
                        // List all areas
                        return {
                            success: true,
                            totalAreas: userAreas.length,
                            areas: userAreas.map(a => ({
                                name: a.name,
                                description: a.description
                            }))
                        };
                    }
                }

                case 'search_documents': {
                    const { query, area_name } = args;

                    // Determine which area to search
                    let searchAreaId = areaId;
                    if (area_name) {
                        const area = userAreas.find(a =>
                            a.name.toLowerCase().includes(area_name.toLowerCase())
                        );
                        if (area) searchAreaId = area.id;
                    }

                    // Search the knowledge base (searches across all user's areas if no area specified)
                    const results = await searchKnowledgeBase(supabase, query, searchAreaId, 5);

                    if (results.length === 0) {
                        return {
                            success: true,
                            message: 'No encontré información relevante en los documentos.',
                            results: []
                        };
                    }

                    // Return the relevant chunks
                    return {
                        success: true,
                        message: `Encontré ${results.length} fragmentos relevantes.`,
                        results: results.map(r => ({
                            document: r.document_name,
                            content: r.content,
                            relevance: Math.round(r.similarity * 100) + '%'
                        }))
                    };
                }

                case 'list_documents': {
                    const { project_name } = args;

                    // Fetch all documents from user's areas
                    let query = supabase
                        .from('documents')
                        .select('*, projects(name, area_id)')
                        .in('projects.area_id', userAreas.map(a => a.id));

                    if (project_name) {
                        const project = projects.find(p =>
                            p.name.toLowerCase().includes(project_name.toLowerCase())
                        );
                        if (project) {
                            query = query.eq('project_id', project.id);
                        }
                    }

                    const { data: docs, error } = await query;

                    if (error) throw error;

                    return {
                        success: true,
                        total: docs?.length || 0,
                        documents: docs?.map(d => ({
                            name: d.name,
                            type: d.file_type,
                            project: d.projects?.name,
                            size: d.file_size ? `${Math.round(d.file_size / 1024)} KB` : 'N/A'
                        })) || []
                    };
                }

                default:
                    return { success: false, message: 'Función no reconocida.' };
            }
        } catch (error) {
            console.error('Error executing function:', error);
            return { success: false, message: 'Error al ejecutar la acción.' };
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const userMsg = { role: 'user', content: inputValue };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsProcessing(true);

        try {
            // Build context for the AI - handle empty arrays safely
            const areasText = userAreas.length > 0 
                ? userAreas.map(a => `- ${a?.name || 'Sin nombre'}: ${a?.description || 'Sin descripción'}`).join('\n')
                : '- Ninguna área disponible';
            
            const projectsText = projects.length > 0
                ? projects.map(p => `- ${p?.name || 'Sin nombre'} (${p?.status || 'Sin estado'})`).join('\n')
                : '- Ningún proyecto disponible';
            
            const tasksText = tasks.length > 0
                ? tasks.slice(0, 10).map(t => `- ${t?.title || 'Sin título'} [${t?.status || 'Sin estado'}] (${t?.priority || 'Sin prioridad'})`).join('\n')
                : '- Ninguna tarea disponible';

            // Build context for the AI
            const systemMessage = {
                role: 'system',
                content: `Eres un asistente de gestión de proyectos con acceso a una base de conocimiento de documentos. Tienes acceso a:

ÁREAS DEL USUARIO (${userAreas.length}):
${areasText}

PROYECTOS (${projects.length}):
${projectsText}

TAREAS (${tasks.length}):
${tasksText}
${tasks.length > 10 ? `... y ${tasks.length - 10} tareas más` : ''}

CAPACIDADES:
- Crear tareas con prioridades en cualquier proyecto
- Ver tareas pendientes por proyecto o en general
- Obtener resúmenes de proyectos con estadísticas
- Ver información de áreas y sus proyectos
- BUSCAR EN DOCUMENTOS: Usa search_documents para buscar información dentro del contenido de los documentos subidos en todas las áreas del usuario
- Listar documentos disponibles por proyecto o área

Cuando el usuario pregunte sobre el contenido de documentos, usa search_documents para buscar en la base de conocimiento.
Puedes buscar en documentos de todas las áreas a las que el usuario tiene acceso.
Responde en español de manera profesional y concisa.`
            };

            // Add to conversation history
            conversationHistory.current.push(userMsg);

            const aiMessages = [
                systemMessage,
                ...conversationHistory.current
            ];

            console.log('Sending to OpenAI:', { 
                messageCount: aiMessages.length,
                hasTools: !!tools,
                systemMessageLength: systemMessage.content.length 
            });

            // Call OpenAI
            const response = await callOpenAI(aiMessages, tools);

            // Check if AI wants to call a function
            if (response.tool_calls && response.tool_calls.length > 0) {
                const toolCall = response.tool_calls[0];
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                // Execute the function
                const functionResult = await executeFunction(functionName, functionArgs);

                // Send function result back to AI for a natural response
                const functionMessage = {
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(functionResult)
                };

                const finalResponse = await callOpenAI([
                    systemMessage,
                    ...conversationHistory.current,
                    response,
                    functionMessage
                ]);

                const assistantMsg = {
                    role: 'assistant',
                    content: finalResponse.content
                };

                conversationHistory.current.push(assistantMsg);
                setMessages(prev => [...prev, assistantMsg]);
            } else {
                // Direct response without function call
                const assistantMsg = {
                    role: 'assistant',
                    content: response.content
                };

                conversationHistory.current.push(assistantMsg);
                setMessages(prev => [...prev, assistantMsg]);
            }

        } catch (error) {
            console.error('Error processing message:', error);
            
            let errorMessage = 'Lo siento, tuve un problema procesando tu mensaje.';
            
            // Check for specific error types
            if (error.message.includes('API key not configured')) {
                errorMessage = '⚠️ La clave de OpenAI no está configurada. Por favor, agrega VITE_OPENAI_API_KEY a tu archivo .env';
            } else if (error.message.includes('401')) {
                errorMessage = '⚠️ Clave de API de OpenAI inválida. Verifica tu VITE_OPENAI_API_KEY en el archivo .env';
            } else if (error.message.includes('400')) {
                errorMessage = '⚠️ Error en la solicitud a OpenAI. Verifica que tu clave API sea válida y tenga los permisos necesarios.';
            } else if (error.message.includes('429')) {
                errorMessage = '⚠️ Has excedido el límite de solicitudes. Intenta de nuevo en unos momentos.';
            } else if (error.message.includes('500') || error.message.includes('503')) {
                errorMessage = '⚠️ OpenAI está experimentando problemas. Intenta de nuevo en unos momentos.';
            }
            
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errorMessage + '\n\n¿Puedes intentar de nuevo?'
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <>
            {/* Floating Button */}
            <button
                className={`ai-trigger-btn ${isOpen ? 'hidden' : ''}`}
                onClick={() => setIsOpen(true)}
            >
                <Sparkles size={24} />
            </button>

            {/* Chat Panel */}
            <div className={`ai-panel ${isOpen ? 'open' : ''}`}>
                <div className="ai-header">
                    <div className="flex gap-sm items-center">
                        <Bot size={20} className="text-primary" />
                        <h3>AI Assistant</h3>
                    </div>
                    <button className="btn-icon" onClick={() => setIsOpen(false)}>
                        <X size={18} />
                    </button>
                </div>

                <div className="ai-messages">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`ai-message ${msg.role}`}>
                            <div className="message-content">
                                {msg.content.split('\n').map((line, i) => (
                                    <p key={i}>{line}</p>
                                ))}
                            </div>
                        </div>
                    ))}
                    {isProcessing && (
                        <div className="ai-message assistant">
                            <div className="typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Suggested Actions - Always visible when assistant is open */}
                <div className="ai-suggestions">
                    <button onClick={() => setInputValue('¿Qué tareas tengo pendientes?')}>
                        📋 ¿Qué está pendiente?
                    </button>
                    <button onClick={() => setInputValue('Dame un resumen de todos mis proyectos')}>
                        📊 Resumen de proyectos
                    </button>
                    <button onClick={() => setInputValue('¿En qué áreas estoy trabajando?')}>
                        🏢 Mis áreas
                    </button>
                    <button onClick={() => setInputValue('Busca información sobre presupuesto en los documentos')}>
                        <Search size={12} /> Buscar en docs
                    </button>
                </div>

                <form className="ai-input-area" onSubmit={handleSend}>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={isListening ? "Escuchando..." : "Escribe o habla tu pregunta..."}
                        autoFocus
                        disabled={isListening}
                    />
                    <button 
                        type="button"
                        className={`btn-voice ${isListening ? 'listening' : ''}`}
                        onClick={toggleVoiceInput}
                        title={isListening ? "Detener grabación" : "Usar voz"}
                    >
                        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                    <button type="submit" disabled={!inputValue.trim() || isProcessing}>
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </>
    );
}

export default AIAssistant;
