import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Sparkles, Bot, FileText, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { callOpenAI } from '../lib/openai';
import './AIAssistant.css';

function AIAssistant({ areaId, projects = [], tasks = [], documents = [], onAction }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: 'Hola 👋 Soy tu asistente de proyecto con AI. Puedo ayudarte a crear tareas, analizar información y responder preguntas sobre tus proyectos. ¿Qué necesitas?'
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const messagesEndRef = useRef(null);
    const conversationHistory = useRef([]);

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
                description: 'Get list of pending/incomplete tasks',
                parameters: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'analyze_document',
                description: 'Analyze or get information about a document',
                parameters: {
                    type: 'object',
                    properties: {
                        document_name: {
                            type: 'string',
                            description: 'Name of the document to analyze'
                        }
                    },
                    required: ['document_name']
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
                    const pendingTasks = tasks.filter(t => t.status !== 'Complete');
                    return {
                        success: true,
                        tasks: pendingTasks.map(t => ({
                            title: t.title,
                            priority: t.priority,
                            status: t.status
                        }))
                    };
                }

                case 'analyze_document': {
                    const { document_name } = args;
                    const doc = documents.find(d =>
                        d.name.toLowerCase().includes(document_name.toLowerCase())
                    );

                    if (!doc) {
                        return { success: false, message: 'Documento no encontrado.' };
                    }

                    return {
                        success: true,
                        document: {
                            name: doc.name,
                            type: doc.file_type,
                            size: doc.file_size,
                            uploaded_by: doc.uploaded_by
                        }
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
            // Build context for the AI
            const systemMessage = {
                role: 'system',
                content: `Eres un asistente de gestión de proyectos. Tienes acceso a los siguientes datos del área actual:

PROYECTOS (${projects.length}):
${projects.map(p => `- ${p.name} (${p.status})`).join('\n')}

TAREAS (${tasks.length}):
${tasks.slice(0, 10).map(t => `- ${t.title} [${t.status}] (${t.priority})`).join('\n')}

DOCUMENTOS (${documents.length}):
${documents.map(d => `- ${d.name}`).join('\n')}

Responde en español de manera profesional y concisa. Usa las funciones disponibles cuando el usuario solicite crear tareas, ver pendientes, o analizar documentos.`
            };

            // Add to conversation history
            conversationHistory.current.push(userMsg);

            const aiMessages = [
                systemMessage,
                ...conversationHistory.current
            ];

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
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Lo siento, tuve un problema procesando tu mensaje. ¿Puedes intentar de nuevo?'
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

                {/* Suggested Actions */}
                {messages.length < 3 && (
                    <div className="ai-suggestions">
                        <button onClick={() => setInputValue('¿Qué tareas tengo pendientes?')}>
                            📋 ¿Qué está pendiente?
                        </button>
                        <button onClick={() => setInputValue('Crear tarea: Revisar presupuesto')}>
                            <Plus size={12} /> Crear tarea
                        </button>
                        {documents.length > 0 && (
                            <button onClick={() => setInputValue(`Analizar ${documents[0].name}`)}>
                                <FileText size={12} /> Analizar Doc
                            </button>
                        )}
                    </div>
                )}

                <form className="ai-input-area" onSubmit={handleSend}>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Escribe una pregunta o comando..."
                        autoFocus
                    />
                    <button type="submit" disabled={!inputValue.trim() || isProcessing}>
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </>
    );
}

export default AIAssistant;
