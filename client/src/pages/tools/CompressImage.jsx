import React, { useState } from 'react';
import DocumentPreviewModal from '../../components/ui/DocumentPreviewModal';

export default function CompressImage({ navTo }) {
  const [file, setFile] = useState(null);
  const [level, setLevel] = useState('recommended');
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
      const ext = dropped.name.toLowerCase().substring(dropped.name.lastIndexOf('.'));
      if (ACCEPTED_EXTENSIONS.includes(ext)) {
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

  const previewCompressedResult = () => {
    if (!result) return;
    const API_URL = import.meta.env.VITE_API_URL || '';
    const url = result.previewUrl || result.downloadUrl;
    const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
    setPreviewState({
      isOpen: true,
      title: result.originalName ? `compressed_${result.originalName}` : 'compressed_image',
      file: null,
      previewUrl: fullUrl,
      downloadUrl: result.downloadUrl,
    });
  };

  const handleCompress = async () => {
    if (!file) {
      setError('Please select an image file to compress.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('level', level);

    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/compress-image`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Compression failed.');
      }
      setResult(data);
    } catch (err) {
      setError(err.message || 'Something went wrong during compression.');
    } finally {
      setLoading(false);
    }
  };

  const compressionLevels = [
    {
      id: 'recommended',
      title: 'Recommended (Balanced)',
      desc: 'Smart balance of quality & size reduction (~40–60% smaller). Perfect for web uploads and social media.',
      badge: 'Popular',
    },
    {
      id: 'extreme',
      title: 'Extreme (Max Compression)',
      desc: 'Maximum compression (~60–80% smaller). Best for thumbnails and bandwidth-critical uses.',
      badge: 'Smallest Size',
    },
    {
      id: 'low',
      title: 'Low (High Quality)',
      desc: 'Light compression preserving high visual quality. Best for photography and print materials.',
      badge: 'High Quality',
    },
  ];

  return (
    <div className="tool-page">
      <button className="back-btn" onClick={() => navTo('home')}>
        ← Back to Home
      </button>

      <div className="tool-header">
        <h1 className="tool-title">Image Compressor</h1>
        <p className="tool-subtitle">
          Reduce image file sizes with smart quality optimization while preserving visual clarity.
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
                onClick={() => document.getElementById('compressImageInput').click()}
              >
                <div className="dropzone-icon">🖼️</div>
                <div className="dropzone-text">Click or drag an image to compress</div>
                <div className="dropzone-sub">Supports JPG, PNG, and WebP images</div>
                <input 
                  id="compressImageInput"
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

            {/* Compression Level Selector */}
            <div className="compress-levels-section">
              <label className="modal-label" style={{ marginBottom: 12, display: 'block' }}>
                Select Compression Strength
              </label>

              <div className="compress-levels-grid">
                {compressionLevels.map((lvl) => (
                  <div
                    key={lvl.id}
                    className={`compress-level-card ${level === lvl.id ? 'active' : ''}`}
                    onClick={() => setLevel(lvl.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setLevel(lvl.id); }}
                  >
                    <div className="compress-level-header">
                      <span className="compress-level-radio">
                        {level === lvl.id ? '●' : '○'}
                      </span>
                      <span className="compress-level-title">{lvl.title}</span>
                      {lvl.badge && <span className="compress-level-badge">{lvl.badge}</span>}
                    </div>
                    <p className="compress-level-desc">{lvl.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {error && <div className="tool-error-msg">{error}</div>}

            <button 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
              onClick={handleCompress}
              disabled={loading || !file}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, margin: 0, marginRight: 8 }} />
                  <span>Compressing image…</span>
                </>
              ) : 'Compress Image'}
            </button>
          </>
        ) : (
          <div className="status-center">
            <div className="status-icon">🎉</div>
            <h2 className="status-title">
              {result.percentSaved > 0 ? 'Compression Successful!' : 'Optimization Complete!'}
            </h2>
            <p className="status-sub">
              {result.percentSaved > 0
                ? 'Your image has been optimized and reduced in file size.'
                : 'Your image is already maximally compressed and cannot be reduced further.'}
            </p>

            {/* Metrics Comparison Card */}
            <div className="compress-stats-box">
              <div className="compress-stat-col">
                <span className="compress-stat-label">Original Size</span>
                <span className="compress-stat-val val-orig">{formatFileSize(result.originalSize)}</span>
              </div>

              <div className="compress-stat-arrow">➔</div>

              <div className="compress-stat-col">
                <span className="compress-stat-label">Compressed Size</span>
                <span className="compress-stat-val val-comp">{formatFileSize(result.compressedSize)}</span>
              </div>

              <div className="compress-stat-col">
                <span className="compress-stat-label">Space Saved</span>
                <span className={`compress-saved-badge ${result.percentSaved > 0 ? 'saved-positive' : 'saved-optimal'}`}>
                  {result.percentSaved > 0 ? `-${result.percentSaved}% Saved` : 'Optimal (0% Saved)'}
                </span>
              </div>
            </div>

            <div className="result-actions-row">
              <button 
                type="button"
                className="btn-secondary btn-preview-action"
                onClick={previewCompressedResult}
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
                <span>⬇</span> Download Compressed Image
              </button>
            </div>

            <div style={{ marginTop: 24 }}>
              <button 
                className="btn-secondary" 
                onClick={() => { setResult(null); setFile(null); }}
              >
                Compress Another Image
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
