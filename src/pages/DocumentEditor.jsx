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
    Highlighter, Undo, Redo, FileText, Check, MessageSquare, Send, Trash2
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
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [user, setUser] = useState(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                strike: true,
            }),
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

    const [contentLoaded, setContentLoaded] = useState(false);

    useEffect(() => {
        checkUser();
        if (id === 'new') {
            setIsNewDoc(true);
            setTitle('Documento sin título');
            const urlParams = new URLSearchParams(window.location.search);
            setProjectId(urlParams.get('projectId'));
            setContentLoaded(true); // New docs are empty, so considered loaded
        } else {
            setContentLoaded(false); // Reset for new doc load
            loadDocument();
            loadComments();
        }

        return () => {
            if (autoSaveTimeout.current) {
                clearTimeout(autoSaveTimeout.current);
            }
        };
    }, [id]);

    // Sync document content to editor when both are ready
    useEffect(() => {
        if (editor && document && !contentLoaded) {
            if (document.content) {
                // Check if content is HTML or plain text
                if (document.content.startsWith('<')) {
                    editor.commands.setContent(document.content);
                } else {
                    editor.commands.setContent(`<p>${document.content.replace(/\n/g, '</p><p>')}</p>`);
                }
            }
            setContentLoaded(true);
        }
    }, [editor, document, contentLoaded]);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
    };

    const loadComments = async () => {
        try {
            const { data, error } = await supabase
                .from('document_comments')
                .select('*, profiles(full_name, email)')
                .eq('document_id', id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setComments(data || []);
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim() || !user) return;

        try {
            const { error } = await supabase
                .from('document_comments')
                .insert({
                    document_id: id,
                    user_id: user.id,
                    content: newComment.trim()
                });

            if (error) throw error;

            setNewComment('');
            loadComments();
        } catch (error) {
            console.error('Error adding comment:', error);
            alert('Error al agregar comentario: ' + error.message);
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!confirm('¿Eliminar este comentario?')) return;

        try {
            const { error } = await supabase
                .from('document_comments')
                .delete()
                .eq('id', commentId);

            if (error) throw error;
            loadComments();
        } catch (error) {
            console.error('Error deleting comment:', error);
            alert('Error al eliminar comentario');
        }
    };

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
            // Content setting moved to useEffect
        } catch (error) {
            console.error('Error loading document:', error);
            alert('Error al cargar el documento');
            navigate(-1);
        }
    };

    const handleSave = useCallback(async (showFeedback = true) => {
        if (!editor || !projectId) {
            console.log('Cannot save: editor or projectId missing', { editor: !!editor, projectId });
            return;
        }

        setIsSaving(true);
        const content = editor.getHTML();
        const textContent = editor.getText();

        console.log('Saving document...', {
            isNewDoc,
            projectId,
            title,
            contentLength: content.length,
            documentId: document?.id || id
        });

        try {
            const documentData = {
                project_id: projectId,
                name: title.trim() + '.html',
                content: content,
                file_size: new Blob([content]).size,
                file_type: 'text/html',
            };

            if (isNewDoc) {
                console.log('Creating new document...');
                const { data, error } = await supabase
                    .from('documents')
                    .insert(documentData)
                    .select()
                    .single();

                if (error) {
                    console.error('Insert error:', error);
                    throw error;
                }

                console.log('Document created:', data.id);
                setDocument(data);
                setIsNewDoc(false);
                // Update URL without page reload
                window.history.replaceState(null, '', `/document/${data.id}?projectId=${projectId}`);

                // Index in background without blocking
                indexDocument(data.id, textContent).catch(e =>
                    console.warn('Background indexing failed:', e)
                );
            } else {
                console.log('Updating existing document:', document?.id || id);
                const { error } = await supabase
                    .from('documents')
                    .update({
                        name: title.trim() + '.html',
                        content: content,
                        file_size: new Blob([content]).size
                    })
                    .eq('id', document?.id || id);

                if (error) {
                    console.error('Update error:', error);
                    throw error;
                }

                console.log('Document updated successfully');

                // Index in background without blocking
                indexDocument(document?.id || id, textContent).catch(e =>
                    console.warn('Background indexing failed:', e)
                );
            }

            setLastSaved(new Date());
            if (showFeedback) {
                console.log('Document saved successfully at', new Date().toLocaleTimeString());
            }
        } catch (error) {
            console.error('Error saving document:', error);
            if (showFeedback) {
                alert('Error al guardar: ' + error.message);
            }
        } finally {
            setIsSaving(false);
        }
    }, [editor, projectId, title, isNewDoc, id, document]);

    const indexDocument = async (docId, textContent) => {
        // Run indexing in background without blocking save
        if (!textContent || textContent.trim().length === 0) {
            console.log('No content to index');
            return;
        }

        try {
            // Delete old chunks
            await supabase.from('document_chunks').delete().eq('document_id', docId);

            // Create new chunks
            const chunks = chunkText(textContent);
            for (let i = 0; i < chunks.length; i++) {
                try {
                    const embedding = await generateEmbedding(chunks[i]);
                    if (embedding) {
                        await supabase.from('document_chunks').insert({
                            document_id: docId,
                            content: chunks[i],
                            embedding: embedding,
                            chunk_index: i,
                            metadata: { file_name: title, chunk_of: chunks.length }
                        });
                    }
                } catch (e) {
                    console.warn('Embedding error for chunk', i, ':', e.message);
                    // Continue with next chunk even if this one fails
                }
            }
        } catch (e) {
            console.warn('Indexing error:', e.message);
            // Don't throw - indexing is optional
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
                        className="btn btn-secondary"
                        onClick={() => setShowComments(!showComments)}
                        title="Comentarios"
                    >
                        <MessageSquare size={18} />
                        {comments.length > 0 && <span className="comment-badge">{comments.length}</span>}
                    </button>
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

                {/* Comments Sidebar */}
                {showComments && !isNewDoc && (
                    <div className="comments-sidebar">
                        <div className="comments-header">
                            <h3>Comentarios</h3>
                            <button className="btn-icon" onClick={() => setShowComments(false)}>
                                ×
                            </button>
                        </div>

                        <div className="comments-list">
                            {comments.map(comment => (
                                <div key={comment.id} className="comment-item">
                                    <div className="comment-header">
                                        <div className="comment-author">
                                            <div className="author-avatar">
                                                {(comment.profiles?.full_name || comment.profiles?.email || 'U')[0].toUpperCase()}
                                            </div>
                                            <div className="author-info">
                                                <strong>{comment.profiles?.full_name || comment.profiles?.email || 'Usuario'}</strong>
                                                <span className="comment-time">
                                                    {new Date(comment.created_at).toLocaleString('es', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                        {user && comment.user_id === user.id && (
                                            <button
                                                className="btn-icon-sm"
                                                onClick={() => handleDeleteComment(comment.id)}
                                                title="Eliminar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <p className="comment-content">{comment.content}</p>
                                </div>
                            ))}
                            {comments.length === 0 && (
                                <div className="empty-comments">
                                    <MessageSquare size={48} />
                                    <p>No hay comentarios aún</p>
                                </div>
                            )}
                        </div>

                        <div className="comment-input-area">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Escribe un comentario..."
                                rows="3"
                            />
                            <button
                                className="btn btn-primary"
                                onClick={handleAddComment}
                                disabled={!newComment.trim()}
                            >
                                <Send size={16} />
                                Comentar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DocumentEditor;
