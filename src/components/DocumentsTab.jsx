import React, { useState } from 'react';
import { FileText, Download, Trash2, Upload, X, File, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './DocumentsTab.css';

function DocumentsTab({ documents, projectId, onDocumentsUpdate }) {
    const [isUploading, setIsUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [editingDoc, setEditingDoc] = useState(null);
    const [editName, setEditName] = useState('');

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
        if (!selectedFile) return;

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

            // Insert document record
            const { error: dbError } = await supabase
                .from('documents')
                .insert({
                    project_id: projectId,
                    name: selectedFile.name,
                    file_url: publicUrl,
                    file_size: selectedFile.size,
                    file_type: selectedFile.type || 'application/octet-stream',
                    uploaded_by: 'Usuario Actual'
                });

            if (dbError) throw dbError;

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
                <button
                    className="btn btn-primary"
                    onClick={() => setShowUploadModal(true)}
                >
                    <Upload size={18} />
                    Subir Documento
                </button>
            </div>

            {documents.length === 0 ? (
                <div className="empty-state card">
                    <FileText size={48} className="empty-icon" />
                    <h3>No hay documentos</h3>
                    <p className="text-secondary">
                        Sube tu primer documento para comenzar.
                    </p>
                    <button
                        className="btn btn-primary mt-lg"
                        onClick={() => setShowUploadModal(true)}
                    >
                        <Upload size={18} />
                        Subir Documento
                    </button>
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
        </div>
    );
}

export default DocumentsTab;
