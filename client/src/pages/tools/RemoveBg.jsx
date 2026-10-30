import React, { useState } from 'react';
import DocumentPreviewModal from '../../components/ui/DocumentPreviewModal';

export default function RemoveBg({ navTo }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Preview modal state
  const [previewState, setPreviewState] = useState({
    isOpen: false,
    title: '',
    file: null,
    previewUrl: null,
    downloadUrl: null,
  });

  const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

  const isValidImage = (fileName) => {
    return ACCEPTED_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));
  };

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
      const dropped = e.dataTransfer.files[0];
      if (isValidImage(dropped.name)) {
        setFile(dropped);
        setError(null);
      } else {
        setError('Please drop a valid image file (JPG, PNG, or WebP).');
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return '0 KB';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const previewSelectedFile = () => {
    if (!file) return;
    setPreviewState({
      isOpen: true,
      title: file.name,
      file,
      previewUrl: null,
      downloadUrl: null,
    });
  };

  const previewResult = () => {
    if (!result) return;
    const API_URL = import.meta.env.VITE_API_URL || '';
    const url = result.previewUrl || result.downloadUrl;
    const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
    setPreviewState({
      isOpen: true,
      title: result.originalName ? `nobg_${result.originalName}` : 'nobg_output.png',
      file: null,
      previewUrl: fullUrl,
      downloadUrl: result.downloadUrl,
    });
  };

  const handleRemoveBg = async () => {
    if (!file) {
      setError('Please select an image file to process.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/remove-bg`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Background removal failed.');
      }
      setResult(data);
    } catch (err) {
      setError(err.message || 'Something went wrong during processing.');
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
        <h1 className="tool-title">Background Remover</h1>
        <p className="tool-subtitle">
          Remove backgrounds from images with high-precision AI and download transparent PNG.
        </p>
      </div>

      <div className="card glass-card">
        {!result ? (
          <>
            {!file ? (
              <div 
                className={`dropzone ${isDragging ? 'active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('removeBgInput').click()}
              >
                <div className="dropzone-icon">✂️</div>
                <div className="dropzone-text">Click or drag an image to remove background</div>
                <div className="dropzone-sub">Supports JPG, PNG, and WebP images</div>
                <input 
                  id="removeBgInput"
                  aria-label="Browse image file"
                  type="file" 
                  accept=".jpg,.jpeg,.png,.webp"
                  style={{ display: 'none' }} 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFile(e.target.files[0]);
                      setError(null);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="compress-file-card">
                <div className="compress-file-info">
                  <div className="compress-file-icon">🖼️</div>
                  <div className="compress-file-meta">
                    <span className="compress-file-name" title={file.name}>{file.name}</span>
                    <span className="compress-file-size">Original Size: {formatFileSize(file.size)}</span>
                  </div>
                </div>

                <div className="compress-file-actions">
                  <button 
                    type="button" 
                    className="compress-action-btn compress-btn-preview"
                    onClick={previewSelectedFile}
                    title="Preview this image file"
                  >
                    <span className="compress-btn-icon">👁️</span>
                    <span>Preview File</span>
                  </button>
                  <button 
                    type="button" 
                    className="compress-action-btn compress-btn-change"
                    onClick={() => { setFile(null); setResult(null); }}
                    title="Remove and pick another file"
                  >
                    <span className="compress-btn-icon">🔄</span>
                    <span>Change File</span>
                  </button>
                </div>
              </div>
            )}

            {error && <div className="tool-error-msg">{error}</div>}

            <button 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
              onClick={handleRemoveBg}
              disabled={loading || !file}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, margin: 0, marginRight: 8 }} />
                  <span>Processing image…</span>
                </>
              ) : 'Remove Background'}
            </button>
          </>
        ) : (
          <div className="status-center">
            <div className="status-icon">🎉</div>
            <h2 className="status-title">Background Removed!</h2>
            <p className="status-sub">
              Your image background has been removed successfully.
            </p>

            {/* Metrics Comparison Card */}
            <div className="compress-stats-box">
              <div className="compress-stat-col">
                <span className="compress-stat-label">Original Size</span>
                <span className="compress-stat-val val-orig">{formatFileSize(result.originalSize)}</span>
              </div>

              <div className="compress-stat-arrow">➔</div>

              <div className="compress-stat-col">
                <span className="compress-stat-label">Output Size</span>
                <span className="compress-stat-val val-comp">{formatFileSize(result.outputSize)}</span>
              </div>
            </div>

            <div className="result-actions-row">
              <button 
                type="button"
                className="btn-secondary btn-preview-action"
                onClick={previewResult}
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
                <span>⬇</span> Download Transparent PNG
              </button>
            </div>

            <div style={{ marginTop: 24 }}>
              <button 
                className="btn-secondary" 
                onClick={() => { setResult(null); setFile(null); }}
              >
                Process Another Image
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
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
