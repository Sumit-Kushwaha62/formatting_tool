import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

const KRUTIDEV_FONTS = [
  { value: 'Krutidev010', label: 'Kruti Dev 010 (Recommended)' },
  { value: 'Krutidev011', label: 'Kruti Dev 011' },
];

export default function HindiToKrutidev({ navTo }) {
  const [file, setFile]       = useState(null);
  const [font, setFont]       = useState('Krutidev010');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) {
      setFile(accepted[0]);
      setResult(null);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    multiple: false,
  });

  const handleConvert = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('font', font);

    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res  = await fetch(`${API_URL}/api/convert-krutidev`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Conversion failed');
      setResult(data);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setFont('Krutidev010');
  };

  return (
    <div className="tool-page">
      <button className="back-btn" onClick={() => navTo('tool')}>← Back</button>

      <div className="tool-header">
        <h1 className="tool-title">Hindi → KrutiDev Converter</h1>
        <p className="tool-subtitle">
          Convert a Unicode Hindi (.docx) file to KrutiDev 010 legacy font encoding.
        </p>
      </div>

      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 10, padding: '12px 16px', marginBottom: 20,
        fontSize: 13, color: 'var(--navy)', lineHeight: 1.6,
      }}>
        <strong>ℹ️ How it works:</strong> Hindi text converts to KrutiDev encoding.
        English words and numbers keep Times New Roman font automatically.
      </div>

      <div className="card">
        {!result ? (
          <>
            <div className="card-title" style={{ marginBottom: 4 }}>Upload Document</div>
            <div className="card-sub" style={{ marginBottom: 16 }}>Only .docx files are supported</div>

            {!file ? (
              <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
                <input {...getInputProps()} />
                <div className="dropzone-icon">🔤</div>
                <div className="dropzone-text">
                  {isDragActive ? 'Drop your .docx file here...' : 'Click to select or drag & drop'}
                </div>
                <div className="dropzone-sub">.docx files only — Unicode Hindi document</div>
              </div>
            ) : (
              <div className="file-selected" style={{ marginBottom: 20 }}>
                <span>📄</span>
                <span className="file-name">{file.name}</span>
                <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                <button className="file-remove"
                  onClick={() => { setFile(null); setResult(null); setError(null); }}>✕</button>
              </div>
            )}

            <div className="form-section" style={{ marginTop: 20 }}>
              <div className="form-section-title">◈ KrutiDev Font Variant</div>
              <div className="form-grid-2" style={{ marginTop: 8 }}>
                {KRUTIDEV_FONTS.map(f => (
                  <div key={f.value}
                    className={`sel-card ${font === f.value ? 'selected' : ''}`}
                    onClick={() => setFont(f.value)}
                    style={{ cursor: 'pointer' }}>
                    <div className="sel-card-label">{f.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div style={{
                color: 'var(--red)', background: '#fff5f5',
                border: '1px solid #fecaca', borderRadius: 8,
                padding: '10px 14px', fontSize: 13, marginTop: 16,
              }}>
                ⚠️ {error}
              </div>
            )}

            <div className="divider" style={{ margin: '20px 0' }} />

            <button className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleConvert} disabled={loading || !file}>
              {loading
                ? <><div className="spinner" style={{ width: 18, height: 18, margin: '0 8px 0 0' }} /> Converting…</>
                : '🔤 Convert to KrutiDev'}
            </button>

            {loading && (
              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--gray)' }}>
                Converting Hindi text… this may take a few seconds for large files.
              </div>
            )}
          </>
        ) : (
          <div className="status-center">
            <div className="status-icon">✅</div>
            <div className="status-title">Conversion Complete</div>
            <div className="status-sub" style={{ marginBottom: 8 }}>
              Your document has been converted to KrutiDev encoding.
            </div>
            {result.had_hindi === false && (
              <div style={{
                color: '#92400e', background: '#fffbeb',
                border: '1px solid #fcd34d', borderRadius: 8,
                padding: '8px 14px', fontSize: 13, marginBottom: 16,
              }}>
                ⚠️ Note: No Unicode Hindi text was found in the document.
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-download" onClick={() => {
                const API_URL = import.meta.env.VITE_API_URL || '';
                window.location.href = (result.downloadUrl.startsWith('http') ? '' : API_URL) + result.downloadUrl;
              }}>
                ⬇ Download Converted File
              </button>
              <button className="btn-secondary" onClick={handleReset}>Convert Another</button>
            </div>
          </div>
        )}
      </div>

      {!result && (
        <div className="card" style={{ marginTop: 16, background: 'var(--bg2)' }}>
          <div className="card-title" style={{ fontSize: 14, marginBottom: 8 }}>💡 Tips</div>
          <ul style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
            <li>Document must use Unicode Hindi (Mangal, Nirmala UI, Kokila etc.)</li>
            <li>English words and numbers will stay in Times New Roman automatically</li>
            <li>After conversion, font in Word should show as Kruti Dev 010 throughout</li>
            <li>Best practice: convert first, then use Formatter for layout changes</li>
          </ul>
        </div>
      )}
    </div>
  );
}
