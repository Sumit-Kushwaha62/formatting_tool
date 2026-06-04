import React, { useState } from 'react';

export default function PDFtoWord({ navTo }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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
      const f = e.dataTransfer.files[0];
      if (f.type === 'application/pdf') setFile(f);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Please select a PDF file.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/pdf-to-word`, {
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
        <h1 className="tool-title">PDF to Word Converter</h1>
        <p className="tool-subtitle">Convert your PDF documents into editable Word (.docx) files.</p>
      </div>

      <div className="card">
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
              <div className="dropzone-icon">🔄</div>
              <div className="dropzone-text">Click or drag PDF file here</div>
              <div className="dropzone-sub">Supports single .pdf file</div>
              <input 
                id="fileInput"
                type="file" 
                accept=".pdf"
                style={{ display: 'none' }} 
                onChange={(e) => e.target.files[0] && setFile(e.target.files[0])}
              />
            </div>

            {file && (
              <div className="file-selected">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                <button className="file-remove" onClick={() => setFile(null)}>×</button>
              </div>
            )}

            {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</div>}

            <button 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleSubmit}
              disabled={loading || !file}
            >
              {loading ? <div className="spinner" style={{ width: 18, height: 18, margin: 0 }} /> : 'Convert to Word'}
            </button>
          </>
        ) : (
          <div className="status-center">
            <div className="status-icon">✅</div>
            <h2 className="status-title">Conversion Complete</h2>
            <p className="status-sub">Your PDF has been converted to Word successfully.</p>
            <a href={result.downloadUrl} className="btn-download" download>
              Download Word File
            </a>
            <button 
              className="btn-secondary" 
              style={{ marginLeft: 12 }} 
              onClick={() => { setResult(null); setFile(null); }}
            >
              Convert Another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
