import React, { useEffect, useState } from 'react';

export default function DocumentPreviewModal({ isOpen, onClose, title, file, previewUrl, downloadUrl }) {
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    if (file && file instanceof Blob) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setObjectUrl(null);
      };
    } else {
      setObjectUrl(null);
    }
  }, [file]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const resolvedUrl = objectUrl || previewUrl;

  const isImage = (file && file.type && file.type.startsWith('image/')) ||
    (title && /\.(png|jpe?g|webp|gif|svg)$/i.test(title)) ||
    (resolvedUrl && /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(resolvedUrl));

  const handleDownload = () => {
    if (downloadUrl) {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${API_URL}${downloadUrl}`;
      window.location.href = fullUrl;
    } else if (resolvedUrl) {
      const a = document.createElement('a');
      a.href = resolvedUrl;
      a.download = title || 'document.pdf';
      a.click();
    }
  };

  const handleOpenInNewTab = () => {
    if (resolvedUrl) {
      window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="preview-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="preview-modal-dialog" role="dialog" aria-modal="true" aria-label="Document Preview">
        {/* Glass Header */}
        <div className="preview-modal-header">
          <div className="preview-modal-info">
            <span className="preview-badge">Live Preview</span>
            <span className="preview-title" title={title || 'Document'}>
              {title || 'Document Preview'}
            </span>
          </div>

          <div className="preview-modal-actions">
            <button 
              type="button" 
              className="preview-btn-action" 
              onClick={handleOpenInNewTab} 
              title="Open full page preview in new tab"
            >
              <span>↗</span> Full View
            </button>
            <button 
              type="button" 
              className="preview-btn-download" 
              onClick={handleDownload}
              title="Download this document"
            >
              <span>⬇</span> Download
            </button>
            <button 
              type="button" 
              className="preview-btn-close" 
              onClick={onClose} 
              aria-label="Close preview"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Preview Frame */}
        <div className="preview-frame-wrap">
          {resolvedUrl ? (
            isImage ? (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'repeating-conic-gradient(#80808018 0% 25%, transparent 0% 50%) 50% / 20px 20px, var(--bg2, #f8f9fa)',
                overflow: 'auto',
                padding: 24,
              }}>
                <img
                  src={resolvedUrl}
                  alt={title || 'Image Preview'}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    borderRadius: 8,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
                  }}
                />
              </div>
            ) : (
              <iframe
                src={resolvedUrl}
                title={title || 'Document Preview'}
                className="preview-iframe"
              />
            )
          ) : (
            <div className="preview-empty">
              <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
              <p>No preview stream available for this document.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
