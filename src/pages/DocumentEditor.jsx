import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import {
    ArrowLeft, Save, Bold, Italic, Underline as UnderlineIcon,
    Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, Quote, Heading1, Heading2, Heading3,
    Highlighter, Undo, Redo, FileText, Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateEmbedding, chunkText } from '../lib/knowledgeBase';
import './DocumentEditor.css';

function DocumentEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [document, setDocument] = useState(null);
    const [title, setTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [isNewDoc, setIsNewDoc] = useState(false);
    const [projectId, setProjectId] = useState(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: 'Comienza a escribir tu documento...',
            }),
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Highlight.configure({
                multicolor: true,
            }),
        ],
        content: '',
        onUpdate: ({ editor }) => {
            // Auto-save after 2 seconds of no typing
            if (autoSaveTimeout.current) {
                clearTimeout(autoSaveTimeout.current);
            }
            autoSaveTimeout.current = setTimeout(() => {
                handleSave(false);
            }, 2000);
        },
    });

    const autoSaveTimeout = React.useRef(null);

    useEffect(() => {
        if (id === 'new') {
            setIsNewDoc(true);
            setTitle('Documento sin título');
            // Get project ID from URL params
            const urlParams = new URLSearchParams(window.location.search);
            setProjectId(urlParams.get('projectId'));
        } else {
            loadDocument();
        }

        return () => {
            if (autoSaveTimeout.current) {
                clearTimeout(autoSaveTimeout.current);
            }
        };
    }, [id]);

    const loadDocument = async () => {
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            setDocument(data);
            setTitle(data.name.replace(/\.[^/.]+$/, ''));
            setProjectId(data.project_id);

            if (editor && data.content) {
                // Check if content is HTML or plain text
                if (data.content.startsWith('<')) {
                    editor.commands.setContent(data.content);
                } else {
                    editor.commands.setContent(`<p>${data.content.replace(/\n/g, '</p><p>')}</p>`);
                }
            }
        } catch (error) {
            console.error('Error loading document:', error);
            alert('Error al cargar el documento');
            navigate(-1);
        }
    };

    const handleSave = useCallback(async (showFeedback = true) => {
        if (!editor || !projectId) return;

        setIsSaving(true);
        const content = editor.getHTML();
        const textContent = editor.getText();

        try {
            if (isNewDoc) {
                // Create new document
                const { data, error } = await supabase
                    .from('documents')
                    .insert({
                        project_id: projectId,
                        name: title.trim() + '.html',
                        file_url: null,
                        file_size: new Blob([content]).size,
                        file_type: 'text/html',
                        uploaded_by: 'Usuario Actual',
                        content: content
                    })
                    .select()
                    .single();

                if (error) throw error;

                setDocument(data);
                setIsNewDoc(false);

                // Update URL without reload
                window.history.replaceState(null, '', `/document/${data.id}`);

                // Index for AI
                await indexDocument(data.id, textContent);
            } else {
                // Update existing document
                const { error } = await supabase
                    .from('documents')
                    .update({
                        name: title.trim() + '.html',
                        content: content,
                        file_size: new Blob([content]).size
                    })
                    .eq('id', id);

                if (error) throw error;

                // Re-index for AI
                await indexDocument(id, textContent);
            }

            setLastSaved(new Date());
        } catch (error) {
            console.error('Error saving document:', error);
            if (showFeedback) {
                alert('Error al guardar: ' + error.message);
            }
        } finally {
            setIsSaving(false);
        }
    }, [editor, projectId, title, isNewDoc, id]);

    const indexDocument = async (docId, textContent) => {
        try {
            // Delete old chunks
            await supabase.from('document_chunks').delete().eq('document_id', docId);

            // Create new chunks
            const chunks = chunkText(textContent);
            for (let i = 0; i < chunks.length; i++) {
                try {
                    const embedding = await generateEmbedding(chunks[i]);
                    await supabase.from('document_chunks').insert({
                        document_id: docId,
                        content: chunks[i],
                        embedding: embedding,
                        chunk_index: i,
                        metadata: { file_name: title, chunk_of: chunks.length }
                    });
                } catch (e) {
                    console.warn('Embedding error:', e);
                }
            }
        } catch (e) {
            console.warn('Indexing error:', e);
        }
    };

    const handleBack = () => {
        if (autoSaveTimeout.current) {
            clearTimeout(autoSaveTimeout.current);
        }
        handleSave(false);
        setTimeout(() => navigate(-1), 500);
    };

    if (!editor) {
        return <div className="loading-screen">Cargando editor...</div>;
    }

    return (
        <div className="document-editor-page">
            {/* Header */}
            <header className="editor-header">
                <div className="header-left">
                    <button className="btn-icon" onClick={handleBack} title="Volver">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="doc-icon-small">
                        <FileText size={20} />
                    </div>
                    <input
                        type="text"
                        className="title-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Título del documento"
                    />
                </div>
                <div className="header-right">
                    {lastSaved && (
                        <span className="save-status">
                            <Check size={14} />
                            Guardado {lastSaved.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        className="btn btn-primary"
                        onClick={() => handleSave(true)}
                        disabled={isSaving}
                    >
                        <Save size={18} />
                        {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </header>

            {/* Toolbar */}
            <div className="editor-toolbar">
                <div className="toolbar-group">
                    <button
                        className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        title="Negrita"
                    >
                        <Bold size={18} />
                    </button>
                    <button
                        className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        title="Cursiva"
                    >
                        <Italic size={18} />
                    </button>
                    <button
                        className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        title="Subrayado"
                    >
                        <UnderlineIcon size={18} />
                    </button>
                    <button
                        className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        title="Tachado"
                    >
                        <Strikethrough size={18} />
                    </button>
                    <button
                        className={`toolbar-btn ${editor.isActive('highlight') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleHighlight().run()}
                        title="Resaltar"
                    >
                        <Highlighter size={18} />
                    </button>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-group">
                    <button
                        className={`toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        title="Título 1"
                    >
                        <Heading1 size={18} />
                    </button>
                    <button
                        className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        title="Título 2"
                    >
                        <Heading2 size={18} />
                    </button>
                    <button
                        className={`toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        title="Título 3"
                    >
                        <Heading3 size={18} />
                    </button>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-group">
                    <button
                        className={`toolbar-btn ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        title="Alinear izquierda"
                    >
                        <AlignLeft size={18} />
                    </button>
                    <button
                        className={`toolbar-btn ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        title="Centrar"
                    >
                        <AlignCenter size={18} />
                    </button>
                    <button
                        className={`toolbar-btn ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        title="Alinear derecha"
                    >
                        <AlignRight size={18} />
                    </button>
                    <button
                        className={`toolbar-btn ${editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                        title="Justificar"
                    >
                        <AlignJustify size={18} />
                    </button>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-group">
                    <button
                        className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        title="Lista con viñetas"
                    >
                        <List size={18} />
                    </button>
                    <button
                        className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        title="Lista numerada"
                    >
                        <ListOrdered size={18} />
                    </button>
                    <button
                        className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        title="Cita"
                    >
                        <Quote size={18} />
                    </button>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-group">
                    <button
                        className="toolbar-btn"
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        title="Deshacer"
                    >
                        <Undo size={18} />
                    </button>
                    <button
                        className="toolbar-btn"
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        title="Rehacer"
                    >
                        <Redo size={18} />
                    </button>
                </div>
            </div>

            {/* Editor Content */}
            <div className="editor-container">
                <div className="editor-paper">
                    <EditorContent editor={editor} />
                </div>
            </div>
        </div>
    );
}

export default DocumentEditor;
