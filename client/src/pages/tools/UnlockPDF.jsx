import React, { useState } from 'react';
import DocumentPreviewModal from '../../components/ui/DocumentPreviewModal';

export default function UnlockPDF({ navTo }) {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      if (dropped.name.toLowerCase().endsWith('.pdf')) {
        setFile(dropped);
        setError(null);
      } else {
        setError('Please drop a valid PDF file.');
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

  const previewUnlockedResult = () => {
    if (!result) return;
    const API_URL = import.meta.env.VITE_API_URL || '';
    const url = result.previewUrl || result.downloadUrl;
    const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
    setPreviewState({
      isOpen: true,
      title: result.originalName ? `unlocked_${result.originalName}` : 'unlocked.pdf',
      file: null,
      previewUrl: fullUrl,
      downloadUrl: result.downloadUrl,
    });
  };

  const handleUnlock = async () => {
    if (!file) {
      setError('Please select a PDF file to unlock.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);

    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/unlock-pdf`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to unlock PDF.');
      }
      setResult(data);
    } catch (err) {
      setError(err.message || 'Something went wrong while unlocking the PDF.');
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
        <h1 className="tool-title">Unlock PDF</h1>
        <p className="tool-subtitle">
          Remove password security and encryption from protected PDF files with safe and instant decryption.
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
                onClick={() => document.getElementById('unlockPdfInput').click()}
              >
                <div className="dropzone-icon">🔓</div>
                <div className="dropzone-text">Click or drag a password-protected PDF</div>
                <div className="dropzone-sub">Supports single .pdf files</div>
                <input 
                  id="unlockPdfInput"
                  aria-label="Browse PDF file"
                  type="file" 
                  accept=".pdf"
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
                  <div className="compress-file-icon">📄</div>
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
                    title="Preview this PDF file"
                  >
                    <span className="compress-btn-icon">👁️</span>
                    <span>Preview File</span>
                  </button>
                  <button 
                    type="button" 
                    className="compress-action-btn compress-btn-change"
                    onClick={() => { setFile(null); setResult(null); setPassword(''); }}
                    title="Remove and pick another file"
                  >
                    <span className="compress-btn-icon">🔄</span>
                    <span>Change File</span>
                  </button>
                </div>
              </div>
            )}

            {file && (
              <div className="field-group" style={{ marginTop: 20 }}>
                <label className="modal-label" htmlFor="pdf-pass-input">
                  Document Password (if known)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    id="pdf-pass-input"
                    type={showPassword ? 'text' : 'password'} 
                    className="field-input" 
                    placeholder="Enter document password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingRight: 45 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 16,
                      color: 'var(--text-muted, #888)',
                      padding: 4
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                <div className="card-sub" style={{ fontSize: 12, marginTop: 6, marginInline: 0 }}>
                  Enter the password used to encrypt this file to permanently decrypt and unlock it.
                </div>
              </div>
            )}

            {error && <div className="tool-error-msg" style={{ marginTop: 16 }}>{error}</div>}

            <button 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}
              onClick={handleUnlock}
              disabled={loading || !file}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, margin: 0, marginRight: 8 }} />
                  <span>Unlocking PDF document…</span>
                </>
              ) : 'Unlock & Decrypt PDF'}
            </button>
          </>
        ) : (
          <div className="status-center">
            <div className="status-icon">🎉</div>
            <h2 className="status-title">PDF Unlocked!</h2>
            <p className="status-sub">
              Your PDF has been successfully unlocked, decrypted, and is ready for download.
            </p>

            {/* Metrics Comparison Card */}
            <div className="compress-stats-box">
              <div className="compress-stat-col">
                <span className="compress-stat-label">Original Size</span>
                <span className="compress-stat-val val-orig">{formatFileSize(result.originalSize)}</span>
              </div>

              <div className="compress-stat-arrow">➔</div>

              <div className="compress-stat-col">
                <span className="compress-stat-label">Unlocked Size</span>
                <span className="compress-stat-val val-comp">{formatFileSize(result.outputSize)}</span>
              </div>
            </div>

            <div className="result-actions-row">
              <button 
                type="button"
                className="btn-secondary btn-preview-action"
                onClick={previewUnlockedResult}
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
                <span>⬇</span> Download Unlocked PDF
              </button>
            </div>

            <div style={{ marginTop: 24 }}>
              <button 
                className="btn-secondary" 
                onClick={() => { setResult(null); setFile(null); setPassword(''); }}
              >
                Unlock Another PDF
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
