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
            // 1. Analyze with OpenAI
            const systemPrompt = {
                role: 'system',
                content: `Eres un asistente experto en gestión de proyectos y análisis de comunicaciones.
                Tu objetivo es procesar registros de chat de WhatsApp (que pueden incluir timestamps y números de teléfono) y extraer información de alto valor para un Project Manager.

                INSTRUCCIONES CLAVE:
                1. **Identificación de Personas**: Si aparecen números de teléfono (ej. +56 9...), intenta inferir el nombre de la persona basándote en el contexto (ej. si alguien dice "Gracias Ricardo", y el mensaje anterior era del número X, asume que X es Ricardo). Usa los nombres reales en el reporte.
                2. **Resumen**: Provee un resumen ejecutivo completo (no breve) que explique el contexto, el conflicto o tema principal, y la resolución o estado actual.
                3. **Puntos Clave**: Lista los argumentos principales, preocupaciones o temas discutidos.
                4. **Acuerdos y Decisiones**: Separa claramente las decisiones tomadas o acuerdos de "palabra" (ej. "Coincidimos en que vale la pena...").
                5. **Tareas (Action Items)**: Lista tareas específicas, quién es el responsable (si se sabe) y el estado (pendiente, completado, etc.).
                6. **Sentimiento**: Analiza la dinámica emocional (ej. "Constructiva pero tensa", "Colaborativa", "Conflicto abierto").

                FORMATO DE SALIDA (JSON ESTRICTO):
                {
                    "summary": "Resumen detallado...",
                    "participants": ["Ricardo", "Alexis", ...],
                    "key_points": ["Punto 1", "Punto 2"],
                    "agreements": ["Acuerdo 1...", "Decisión tomada..."],
                    "action_items": [{"task": "Descripción de la tarea", "owner": "Nombre o 'Por definir'", "status": "Pendiente/En proceso"}],
                    "sentiment": "Descripción del sentimiento"
                }`
            };

            const userMessage = {
                role: 'user',
                content: inputText
            };

            // Call OpenAI
            const response = await callOpenAI([systemPrompt, userMessage]);

            // Parse JSON response
            let analysisData;
            try {
                const content = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
                analysisData = JSON.parse(content);
            } catch (e) {
                console.warn('Failed to parse JSON, saving raw content', e);
                analysisData = { raw_analysis: response.content };
            }

            // 2. Save to Database
            const { data, error } = await supabase
                .from('whatsapp_conversations')
                .insert({
                    area_id: areaId,
                    content: inputText,
                    analysis: analysisData
                })
                .select()
                .single();

            if (error) throw error;

            setConversations([data, ...conversations]);
            setInputText('');
            setExpandedIds(prev => [...prev, data.id]);

        } catch (error) {
            console.error('Error analyzing conversation:', error);
            alert('Error al analizar la conversación: ' + error.message);
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
                                            ) : (
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
