import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { callOpenAI } from '../lib/openai';
import { MessageSquare, Send, Trash2, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import './WhatsAppAnalyzer.css';

function WhatsAppAnalyzer({ areaId }) {
    const [conversations, setConversations] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [expandedIds, setExpandedIds] = useState([]);

    useEffect(() => {
        if (areaId) {
            fetchConversations();
        }
    }, [areaId]);

    const fetchConversations = async () => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_conversations')
                .select('*')
                .eq('area_id', areaId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setConversations(data || []);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        }
    };

    const handleAnalyze = async () => {
        if (!inputText.trim()) return;

        setIsAnalyzing(true);
        try {
            // 1. Analyze with OpenAI - Threaded Analysis Mode
            const systemPrompt = {
                role: 'system',
                content: `Eres un asistente experto en gestión de proyectos.
                Analiza el registro de WhatsApp y AGRÚPALO POR TEMAS DE DISCUSIÓN (HILOS).
                
                Instrucciones:
                1. Identifica los distintos "Topic Threads" o temas tratados.
                2. Para CADA tema, extrae: Título, Resumen, Participantes específicos de ese tema, Acuerdos y Tareas.
                3. Genera un "Global Overview" con el sentimiento general y un resumen meta.
                4. Identifica personas por contexto (ej. asocia números a nombres mencionados).

                FORMATO JSON ESTRICTO:
                {
                    "global_overview": {
                        "summary": "Resumen general de toda la conversación...",
                        "sentiment": "Sentimiento general...",
                        "main_participants": ["Nombre1", "Nombre2"]
                    },
                    "topics": [
                        {
                            "title": "Tema 1: Nombre del tema",
                            "summary": "Resumen específico de este hilo...",
                            "participants": ["Persona A", "Persona B"],
                            "agreements": ["Acuerdo 1", "Acuerdo 2"],
                            "action_items": [{"task": "Tarea...", "owner": "Responsable", "status": "Pendiente"}]
                        },
                         {
                            "title": "Tema 2: ...",
                            ...
                        }
                    ]
                }`
            };

            const userMessage = {
                role: 'user',
                content: inputText
            };

            const response = await callOpenAI([systemPrompt, userMessage]);

            let analysisData;
            try {
                const content = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
                analysisData = JSON.parse(content);
            } catch (e) {
                console.warn('Failed to parse JSON', e);
                // Fallback for flat structure or error
                analysisData = { raw_analysis: response.content };
            }

            // 2. Save to Database
            const { data, error } = await supabase
                .from('whatsapp_conversations')
                .insert({
                    area_id: areaId,
                    content: inputText,
                    analysis: analysisData // Can store nested JSONB
                })
                .select()
                .single();

            if (error) throw error;

            setConversations([data, ...conversations]);
            setInputText('');
            setExpandedIds(prev => [...prev, data.id]);

        } catch (error) {
            console.error('Error analyzing:', error);
            alert('Error: ' + error.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar esta conversación y su análisis?')) return;

        try {
            const { error } = await supabase
                .from('whatsapp_conversations')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setConversations(conversations.filter(c => c.id !== id));
        } catch (error) {
            console.error('Error deleting:', error);
        }
    };

    const toggleExpand = (id) => {
        setExpandedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <div className="whatsapp-analyzer">
            <div className="wa-input-section card">
                <h3>Analizar Nueva Conversación</h3>
                <p className="text-secondary text-sm mb-md">
                    Pega aquí el texto exportado de WhatsApp o los mensajes copiados. La IA extraerá tareas, acuerdos y resúmenes.
                </p>
                <textarea
                    className="wa-textarea"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="[10:30, 2/5/2024] Juan: Hola equipo, necesitamos revisar el presupuesto..."
                    rows={6}
                />
                <div className="wa-actions">
                    <button
                        className="btn btn-primary"
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !inputText.trim()}
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader className="spin" size={18} /> Analizando...
                            </>
                        ) : (
                            <>
                                <Send size={18} /> Analizar con IA
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="wa-history">
                <h3>Historial de Análisis</h3>
                {conversations.length === 0 ? (
                    <div className="empty-state">
                        <MessageSquare size={48} className="text-secondary opacity-50" />
                        <p>No hay conversaciones analizadas todavía.</p>
                    </div>
                ) : (
                    <div className="wa-list">
                        {conversations.map(conv => {
                            const isExpanded = expandedIds.includes(conv.id);
                            const analysis = conv.analysis || {};
                            const date = new Date(conv.created_at).toLocaleString();

                            return (
                                <div key={conv.id} className="wa-item card">
                                    <div className="wa-item-header" onClick={() => toggleExpand(conv.id)}>
                                        <div className="wa-header-info">
                                            <h4>{analysis.summary ? analysis.summary.substring(0, 80) + '...' : 'Conversación sin resumen'}</h4>
                                            <span className="text-secondary text-xs">{date}</span>
                                        </div>
                                        <div className="wa-header-actions">
                                            <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}>
                                                <Trash2 size={16} />
                                            </button>
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="wa-item-body">
                                            {analysis.raw_analysis ? (
                                                <div className="wa-raw-content">
                                                    <h5>Análisis:</h5>
                                                    <p>{analysis.raw_analysis}</p>
                                                </div>
                                            ) : analysis.topics ? (
                                                // NEW THREADED VIEW
                                                <div className="wa-threaded-content">
                                                    {/* Global Overview */}
                                                    <div className="wa-global-overview">
                                                        <h5>🌎 Visión General</h5>
                                                        <p>{analysis.global_overview?.summary}</p>
                                                        <div className="wa-meta-row">
                                                            <span className="wa-tag sentiment">{analysis.global_overview?.sentiment}</span>
                                                            <span className="wa-tag participants">
                                                                👥 {analysis.global_overview?.main_participants?.join(', ')}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Topics */}
                                                    <div className="wa-topics-grid">
                                                        {analysis.topics.map((topic, idx) => (
                                                            <div key={idx} className="wa-topic-card">
                                                                <div className="topic-header">
                                                                    <h6>📌 {topic.title}</h6>
                                                                </div>
                                                                <div className="topic-body">
                                                                    <p className="topic-summary">{topic.summary}</p>

                                                                    {topic.agreements && topic.agreements.length > 0 && (
                                                                        <div className="topic-section">
                                                                            <strong className="text-success">🤝 Acuerdos:</strong>
                                                                            <ul>
                                                                                {topic.agreements.map((a, i) => <li key={i}>{a}</li>)}
                                                                            </ul>
                                                                        </div>
                                                                    )}

                                                                    {topic.action_items && topic.action_items.length > 0 && (
                                                                        <div className="topic-section">
                                                                            <strong className="text-warning">✅ Tareas:</strong>
                                                                            <ul>
                                                                                {topic.action_items.map((task, i) => (
                                                                                    <li key={i}>
                                                                                        {task.owner ? <b>{task.owner}: </b> : ''}
                                                                                        {task.task}
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    )}

                                                                    <div className="topic-footer">
                                                                        <small>🗣 {topic.participants?.join(', ')}</small>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                // LEGACY FLAT VIEW
                                                <div className="wa-structured-content">
                                                    {analysis.summary && (
                                                        <div className="wa-section">
                                                            <h5>Resumen</h5>
                                                            <p>{analysis.summary}</p>
                                                        </div>
                                                    )}

                                                    {analysis.agreements && analysis.agreements.length > 0 && (
                                                        <div className="wa-section">
                                                            <h5>🤝 Acuerdos y Decisiones</h5>
                                                            <ul>
                                                                {analysis.agreements.map((agreement, idx) => (
                                                                    <li key={idx}>{agreement}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {analysis.action_items && analysis.action_items.length > 0 && (
                                                        <div className="wa-section">
                                                            <h5>✅ Tareas Detectadas</h5>
                                                            <ul className="wa-action-list">
                                                                {analysis.action_items.map((item, idx) => (
                                                                    <li key={idx}>
                                                                        <strong>{item.owner || 'General'}:</strong> {item.task}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {analysis.key_points && (
                                                        <div className="wa-section">
                                                            <h5>💡 Puntos Clave</h5>
                                                            <ul>
                                                                {analysis.key_points.map((pt, idx) => <li key={idx}>{pt}</li>)}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    <div className="wa-meta-grid">
                                                        {analysis.participants && (
                                                            <div className="wa-meta-item">
                                                                <strong>Participantes:</strong> {analysis.participants.join(', ')}
                                                            </div>
                                                        )}
                                                        {analysis.sentiment && (
                                                            <div className="wa-meta-item">
                                                                <strong>Sentimiento:</strong> {analysis.sentiment}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="wa-original-text">
                                                <details>
                                                    <summary>Ver texto original</summary>
                                                    <pre>{conv.content}</pre>
                                                </details>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default WhatsAppAnalyzer;
