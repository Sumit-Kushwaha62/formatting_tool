import React, { useState } from 'react';
import DocumentPreviewModal from '../../components/ui/DocumentPreviewModal';

export default function MergePDF({ navTo }) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Drag and drop reordering states
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Preview modal state
  const [previewState, setPreviewState] = useState({
    isOpen: false,
    title: '',
    file: null,
    previewUrl: null,
    downloadUrl: null,
  });

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Reorder functions
  const moveFile = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= files.length) return;
    setFiles(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  // Drag reorder handlers
  const handleItemDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent or ghost image
    e.dataTransfer.setData('text/plain', index);
  };

  const handleItemDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleItemDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      moveFile(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleItemDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Preview file before merge
  const previewUploadedFile = (file) => {
    setPreviewState({
      isOpen: true,
      title: file.name,
      file,
      previewUrl: null,
      downloadUrl: null,
    });
  };

  // Preview merged result
  const previewMergedResult = () => {
    if (!result) return;
    const API_URL = import.meta.env.VITE_API_URL || '';
    const url = result.previewUrl || result.downloadUrl;
    const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
    setPreviewState({
      isOpen: true,
      title: 'merged_document.pdf',
      file: null,
      previewUrl: fullUrl,
      downloadUrl: result.downloadUrl,
    });
  };

  const handleSubmit = async () => {
    if (files.length < 2) {
      setError('Please select at least 2 PDF files to merge.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/merge-pdf`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tool-page">
      <button className="back-btn" onClick={() => navTo('home')}>
        ← Back to Home
      </button>

      <div className="tool-header">
        <h1 className="tool-title">Merge PDF Documents</h1>
        <p className="tool-subtitle">Combine multiple PDF files in any order with real-time preview.</p>
      </div>

      <div className="card glass-card">
        {!result ? (
          <>
            <div 
              className={`dropzone ${isDragging ? 'active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('fileInput').click()}
            >
              <div className="dropzone-icon">📑</div>
              <div className="dropzone-text">Click or drag PDF files here</div>
              <div className="dropzone-sub">Add 2 or more files — reorder them in the exact merge sequence</div>
              <input 
                id="fileInput"
                aria-label="Browse files"
                type="file" 
                multiple 
                accept=".pdf"
                style={{ display: 'none' }} 
                onChange={(e) => {
                  const newFiles = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
                  setFiles(prev => [...prev, ...newFiles]);
                }}
              />
            </div>

            {files.length > 0 && (
              <div className="reorder-files-container">
                <div className="reorder-header">
                  <div className="reorder-header-title">
                    <span>Document Sequence ({files.length} files)</span>
                  </div>
                  <div className="reorder-header-hint">
                    💡 Drag items to reorder, or use ▲ ▼
                  </div>
                </div>

                <div className="reorder-list">
                  {files.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      draggable
                      onDragStart={(e) => handleItemDragStart(e, i)}
                      onDragOver={(e) => handleItemDragOver(e, i)}
                      onDrop={(e) => handleItemDrop(e, i)}
                      onDragEnd={handleItemDragEnd}
                      className={`reorder-item ${draggedIndex === i ? 'dragging' : ''} ${dragOverIndex === i ? 'drag-over' : ''}`}
                    >
                      {/* Drag Handle */}
                      <div className="reorder-handle" title="Drag to reorder">
                        ⠿
                      </div>

                      {/* Number Badge */}
                      <div className="reorder-badge">#{i + 1}</div>

                      {/* File Details */}
                      <div className="reorder-details">
                        <span className="reorder-name" title={f.name}>{f.name}</span>
                        <span className="reorder-size">{(f.size / 1024).toFixed(1)} KB</span>
                      </div>

                      {/* Item Actions */}
                      <div className="reorder-actions">
                        <button
                          type="button"
                          className="reorder-btn preview-btn-icon"
                          onClick={() => previewUploadedFile(f)}
                          title={`Preview ${f.name}`}
                          aria-label={`Preview ${f.name}`}
                        >
                          👁️ Preview
                        </button>

                        <button
                          type="button"
                          className="reorder-arrow-btn"
                          onClick={() => moveFile(i, i - 1)}
                          disabled={i === 0}
                          title="Move up"
                          aria-label={`Move ${f.name} up`}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="reorder-arrow-btn"
                          onClick={() => moveFile(i, i + 1)}
                          disabled={i === files.length - 1}
                          title="Move down"
                          aria-label={`Move ${f.name} down`}
                        >
                          ▼
                        </button>

                        <button
                          type="button"
                          className="reorder-btn-remove"
                          onClick={() => removeFile(i)}
                          title="Remove file"
                          aria-label={`Remove ${f.name}`}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="tool-error-msg">{error}</div>}

            <button 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
              onClick={handleSubmit}
              disabled={loading || files.length < 2}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, margin: 0, marginRight: 8 }} />
                  <span>Merging {files.length} PDFs…</span>
                </>
              ) : `Merge ${files.length > 0 ? files.length : ''} PDF files`}
            </button>
          </>
        ) : (
          <div className="status-center">
            <div className="status-icon">✅</div>
            <h2 className="status-title">Merge Complete</h2>
            <p className="status-sub">
              Successfully combined {files.length} documents into one clean PDF.
            </p>

            <div className="result-actions-row">
              <button 
                type="button"
                className="btn-secondary btn-preview-action"
                onClick={previewMergedResult}
              >
                <span>👁️</span> Live Preview
              </button>

              <button 
                type="button"
                onClick={() => {
                  const API_URL = import.meta.env.VITE_API_URL || '';
                  window.location.href = (result.downloadUrl.startsWith('http') ? '' : API_URL) + result.downloadUrl;
                }} 
                className="btn-download"
              >
                <span>⬇</span> Download Merged PDF
              </button>
            </div>

            <div style={{ marginTop: 24 }}>
              <button 
                className="btn-secondary" 
                onClick={() => { setResult(null); setFiles([]); }}
              >
                Merge More Documents
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reusable Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewState.isOpen}
        onClose={() => setPreviewState(prev => ({ ...prev, isOpen: false }))}
        title={previewState.title}
        file={previewState.file}
        previewUrl={previewState.previewUrl}
        downloadUrl={previewState.downloadUrl}
      />
    </div>
  );
}
