import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, Trash2, Upload, X, File, Pencil, Plus, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { processDocumentForKnowledgeBase, generateEmbedding, chunkText } from '../lib/knowledgeBase';
import './DocumentsTab.css';

function DocumentsTab({ documents, projectId, onDocumentsUpdate }) {
    const navigate = useNavigate();
    const [isUploading, setIsUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [editingDoc, setEditingDoc] = useState(null);
    const [editName, setEditName] = useState('');

    // New states for document creation/editing
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [docTitle, setDocTitle] = useState('');
    const [docContent, setDocContent] = useState('');
    const [viewingDoc, setViewingDoc] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const [currentUser, setCurrentUser] = useState(null);

    React.useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
        };
        getUser();
    }, []);

    const formatFileSize = (bytes) => {
        if (!bytes) return 'N/A';
        const kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        return `${(kb / 1024).toFixed(1)} MB`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !currentUser) return;

        setIsUploading(true);
        setUploadProgress(0);

        try {
            // Create a unique file name
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${Date.now()}_${selectedFile.name}`;
            const filePath = `${projectId}/${fileName}`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('project-documents')
                .upload(filePath, selectedFile, {
                    onUploadProgress: (progress) => {
                        const percent = (progress.loaded / progress.total) * 100;
                        setUploadProgress(Math.round(percent));
                    }
                });

            if (uploadError) {
                // If bucket doesn't exist, we'll store metadata only
                console.warn('Storage upload failed, storing metadata only:', uploadError);
            }

            // Get public URL (if storage worked)
            let publicUrl = null;
            if (uploadData) {
                const { data: urlData } = supabase.storage
                    .from('project-documents')
                    .getPublicUrl(filePath);
                publicUrl = urlData.publicUrl;
            }

            // Insert document record and get the ID
            const { data: docData, error: dbError } = await supabase
                .from('documents')
                .insert({
                    project_id: projectId,
                    name: selectedFile.name,
                    file_url: publicUrl,
                    file_size: selectedFile.size,
                    file_type: selectedFile.type || 'application/octet-stream',
                    uploaded_by: currentUser.id
                })
                .select()
                .single();

            if (dbError) throw dbError;

            // Process document for AI Knowledge Base (async, don't wait)
            if (docData?.id) {
                processDocumentForKnowledgeBase(supabase, docData.id, selectedFile)
                    .then(result => {
                        if (result.success) {
                            console.log(`✅ Document indexed for AI: ${result.chunksProcessed} chunks`);
                        }
                    })
                    .catch(err => console.warn('Knowledge base indexing failed:', err));
            }

            // Refresh documents list
            if (onDocumentsUpdate) {
                await onDocumentsUpdate();
            }

            // Reset form
            setShowUploadModal(false);
            setSelectedFile(null);
            setUploadProgress(0);

        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Error al subir el documento: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownload = async (doc) => {
        if (doc.file_url) {
            // If we have a file URL, open it
            window.open(doc.file_url, '_blank');
        } else {
            alert('Este documento no tiene un archivo asociado');
        }
    };

    const handleDelete = async (docId) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este documento?')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('documents')
                .delete()
                .eq('id', docId);

            if (error) throw error;

            // Refresh documents list
            if (onDocumentsUpdate) {
                await onDocumentsUpdate();
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Error al eliminar el documento');
        }
    };

    const handleEdit = (doc) => {
        setEditingDoc(doc);
        setEditName(doc.name);
    };

    const handleSaveEdit = async () => {
        if (!editingDoc || !editName.trim()) return;

        try {
            const { error } = await supabase
                .from('documents')
                .update({ name: editName.trim() })
                .eq('id', editingDoc.id);

            if (error) throw error;

            setEditingDoc(null);
            setEditName('');
            if (onDocumentsUpdate) {
                await onDocumentsUpdate();
            }
        } catch (error) {
            console.error('Error updating document:', error);
            alert('Error al actualizar el documento: ' + error.message);
        }
    };

    // Create a new online document
    const handleCreateDocument = async () => {
        if (!docTitle.trim() || !docContent.trim() || !currentUser) return;

        setIsSaving(true);
        try {
            // Create document record
            const { data: docData, error: dbError } = await supabase
                .from('documents')
                .insert({
                    project_id: projectId,
                    name: docTitle.trim() + '.txt',
                    file_url: null,
                    file_size: new Blob([docContent]).size,
                    file_type: 'text/plain',
                    uploaded_by: currentUser.id,
                    content: docContent // Store content directly
                })
                .select()
                .single();

            if (dbError) throw dbError;

            // Index for AI knowledge base
            if (docData?.id) {
                const chunks = chunkText(docContent);
                for (let i = 0; i < chunks.length; i++) {
                    try {
                        const embedding = await generateEmbedding(chunks[i]);
                        await supabase.from('document_chunks').insert({
                            document_id: docData.id,
                            content: chunks[i],
                            embedding: embedding,
                            chunk_index: i,
                            metadata: { file_name: docTitle, chunk_of: chunks.length }
                        });
                    } catch (e) {
                        console.warn('Embedding error:', e);
                    }
                }
            }

            setShowCreateModal(false);
            setDocTitle('');
            setDocContent('');
            if (onDocumentsUpdate) {
                await onDocumentsUpdate();
            }
        } catch (error) {
            console.error('Error creating document:', error);
            alert('Error al crear documento: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    // View document content
    const handleViewDocument = async (doc) => {
        setViewingDoc(doc);
        setDocTitle(doc.name.replace(/\.[^/.]+$/, '')); // Remove extension
        setDocContent(doc.content || '');
        setShowViewModal(true);
    };

    // Save edited content
    const handleSaveContent = async () => {
        if (!viewingDoc) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('documents')
                .update({
                    name: docTitle.trim() + (docTitle.includes('.') ? '' : '.txt'),
                    content: docContent,
                    file_size: new Blob([docContent]).size
                })
                .eq('id', viewingDoc.id);

            if (error) throw error;

            // Re-index for AI
            // First delete old chunks
            await supabase.from('document_chunks').delete().eq('document_id', viewingDoc.id);

            // Then create new ones
            const chunks = chunkText(docContent);
            for (let i = 0; i < chunks.length; i++) {
                try {
                    const embedding = await generateEmbedding(chunks[i]);
                    await supabase.from('document_chunks').insert({
                        document_id: viewingDoc.id,
                        content: chunks[i],
                        embedding: embedding,
                        chunk_index: i,
                        metadata: { file_name: docTitle, chunk_of: chunks.length }
                    });
                } catch (e) {
                    console.warn('Embedding error:', e);
                }
            }

            setShowViewModal(false);
            setViewingDoc(null);
            if (onDocumentsUpdate) {
                await onDocumentsUpdate();
            }
        } catch (error) {
            console.error('Error saving document:', error);
            alert('Error al guardar: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const getFileIcon = (fileType) => {
        if (!fileType) return <File size={24} />;

        if (fileType.includes('pdf')) return <FileText size={24} />;
        if (fileType.includes('image')) return <File size={24} />;
        if (fileType.includes('excel') || fileType.includes('spreadsheet')) return <File size={24} />;
        if (fileType.includes('word') || fileType.includes('document')) return <FileText size={24} />;

        return <File size={24} />;
    };

    return (
        <div className="documents-tab">
            <div className="documents-header card">
                <div>
                    <h2>Documentos del Proyecto</h2>
                    <p className="text-secondary">
                        {documents.length} documento{documents.length !== 1 ? 's' : ''} adjunto{documents.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="header-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={() => navigate(`/document/new?projectId=${projectId}`)}
                    >
                        <Plus size={18} />
                        Crear Documento
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowUploadModal(true)}
                    >
                        <Upload size={18} />
                        Subir Archivo
                    </button>
                </div>
            </div>

            {documents.length === 0 ? (
                <div className="empty-state card">
                    <FileText size={48} className="empty-icon" />
                    <h3>No hay documentos</h3>
                    <p className="text-secondary">
                        Crea un documento nuevo o sube un archivo.
                    </p>
                    <div className="empty-actions">
                        <button
                            className="btn btn-secondary"
                            onClick={() => navigate(`/document/new?projectId=${projectId}`)}
                        >
                            <Plus size={18} />
                            Crear Documento
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowUploadModal(true)}
                        >
                            <Upload size={18} />
                            Subir Archivo
                        </button>
                    </div>
                </div>
            ) : (
                <div className="documents-list">
                    {documents.map(doc => (
                        <div key={doc.id} className="document-item card">
                            <div className="doc-icon">
                                {getFileIcon(doc.file_type)}
                            </div>

                            <div className="doc-content">
                                <h4 className="doc-name">{doc.name}</h4>
                                <div className="doc-meta text-secondary text-sm">
                                    <span>{doc.file_type || 'Documento'}</span>
                                    {doc.file_size && <span> • {formatFileSize(doc.file_size)}</span>}
                                    {doc.uploaded_by && <span> • Subido por {doc.uploaded_by}</span>}
                                    {doc.created_at && <span> • {formatDate(doc.created_at)}</span>}
                                </div>
                            </div>

                            <div className="doc-actions">
                                {doc.content && (
                                    <button
                                        className="btn-icon"
                                        title="Editar documento"
                                        onClick={() => navigate(`/document/${doc.id}`)}
                                    >
                                        <Eye size={18} />
                                    </button>
                                )}
                                <button
                                    className="btn-icon"
                                    title="Editar nombre"
                                    onClick={() => handleEdit(doc)}
                                >
                                    <Pencil size={18} />
                                </button>
                                <button
                                    className="btn-icon"
                                    title="Descargar"
                                    onClick={() => handleDownload(doc)}
                                >
                                    <Download size={18} />
                                </button>
                                <button
                                    className="btn-icon btn-delete"
                                    title="Eliminar"
                                    onClick={() => handleDelete(doc.id)}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="modal-overlay" onClick={() => !isUploading && setShowUploadModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Subir Documento</h3>
                            <button
                                className="btn-icon"
                                onClick={() => setShowUploadModal(false)}
                                disabled={isUploading}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="upload-area">
                                <input
                                    type="file"
                                    id="file-input"
                                    onChange={handleFileSelect}
                                    disabled={isUploading}
                                    style={{ display: 'none' }}
                                />
                                <label htmlFor="file-input" className="upload-label">
                                    <Upload size={48} className="upload-icon" />
                                    <p className="upload-text">
                                        {selectedFile ? selectedFile.name : 'Haz clic para seleccionar un archivo'}
                                    </p>
                                    {selectedFile && (
                                        <p className="text-secondary text-sm">
                                            {formatFileSize(selectedFile.size)}
                                        </p>
                                    )}
                                </label>
                            </div>

                            {isUploading && (
                                <div className="upload-progress">
                                    <div className="progress-bar-large">
                                        <div
                                            className="progress-fill"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-sm text-center mt-sm">
                                        Subiendo... {uploadProgress}%
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn"
                                onClick={() => setShowUploadModal(false)}
                                disabled={isUploading}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleUpload}
                                disabled={!selectedFile || isUploading}
                            >
                                {isUploading ? 'Subiendo...' : 'Subir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingDoc && (
                <div className="modal-overlay" onClick={() => setEditingDoc(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Editar Documento</h3>
                            <button
                                className="btn-icon"
                                onClick={() => setEditingDoc(null)}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="form-group">
                                <label>Nombre del documento</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="Nombre del documento"
                                />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn"
                                onClick={() => setEditingDoc(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSaveEdit}
                                disabled={!editName.trim()}
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Document Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => !isSaving && setShowCreateModal(false)}>
                    <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Crear Documento</h3>
                            <button
                                className="btn-icon"
                                onClick={() => setShowCreateModal(false)}
                                disabled={isSaving}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="form-group">
                                <label>Título del documento</label>
                                <input
                                    type="text"
                                    value={docTitle}
                                    onChange={(e) => setDocTitle(e.target.value)}
                                    placeholder="Ej: Notas de reunión, Especificaciones..."
                                />
                            </div>
                            <div className="form-group">
                                <label>Contenido</label>
                                <textarea
                                    className="document-editor"
                                    value={docContent}
                                    onChange={(e) => setDocContent(e.target.value)}
                                    placeholder="Escribe el contenido del documento aquí..."
                                    rows={15}
                                />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setDocTitle('');
                                    setDocContent('');
                                }}
                                disabled={isSaving}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCreateDocument}
                                disabled={!docTitle.trim() || !docContent.trim() || isSaving}
                            >
                                {isSaving ? 'Guardando...' : 'Crear Documento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View/Edit Document Modal */}
            {showViewModal && viewingDoc && (
                <div className="modal-overlay" onClick={() => !isSaving && setShowViewModal(false)}>
                    <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Editar Documento</h3>
                            <button
                                className="btn-icon"
                                onClick={() => {
                                    setShowViewModal(false);
                                    setViewingDoc(null);
                                }}
                                disabled={isSaving}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="form-group">
                                <label>Título</label>
                                <input
                                    type="text"
                                    value={docTitle}
                                    onChange={(e) => setDocTitle(e.target.value)}
                                    placeholder="Título del documento"
                                />
                            </div>
                            <div className="form-group">
                                <label>Contenido</label>
                                <textarea
                                    className="document-editor"
                                    value={docContent}
                                    onChange={(e) => setDocContent(e.target.value)}
                                    placeholder="Contenido del documento..."
                                    rows={15}
                                />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn"
                                onClick={() => {
                                    setShowViewModal(false);
                                    setViewingDoc(null);
                                }}
                                disabled={isSaving}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSaveContent}
                                disabled={!docTitle.trim() || isSaving}
                            >
                                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DocumentsTab;
