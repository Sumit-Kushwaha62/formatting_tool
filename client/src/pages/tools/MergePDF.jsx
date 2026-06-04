import React, { useState } from 'react';

export default function MergePDF({ navTo }) {
  const [files, setFiles] = useState([]);
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
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
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
      const res = await fetch('/api/merge-pdf', {
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
        <p className="tool-subtitle">Combine multiple PDF files into a single document.</p>
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
              <div className="dropzone-icon">📄</div>
              <div className="dropzone-text">Click or drag PDF files here</div>
              <div className="dropzone-sub">Supports multiple .pdf files</div>
              <input 
                id="fileInput"
                type="file" 
                multiple 
                accept=".pdf"
                style={{ display: 'none' }} 
                onChange={(e) => {
                  const newFiles = Array.from(e.target.files);
                  setFiles(prev => [...prev, ...newFiles]);
                }}
              />
            </div>

            {files.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {files.map((f, i) => (
                  <div key={i} className="file-selected">
                    <span className="file-name">{f.name}</span>
                    <span className="file-size">{(f.size / 1024).toFixed(1)} KB</span>
                    <button className="file-remove" onClick={() => removeFile(i)}>×</button>
                  </div>
                ))}
              </div>
            )}

            {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</div>}

            <button 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleSubmit}
              disabled={loading || files.length === 0}
            >
              {loading ? <div className="spinner" style={{ width: 18, height: 18, margin: 0 }} /> : 'Merge PDF Files'}
            </button>
          </>
        ) : (
          <div className="status-center">
            <div className="status-icon">✅</div>
            <h2 className="status-title">Merge Complete</h2>
            <p className="status-sub">Your PDF files have been combined successfully.</p>
            <a href={result.downloadUrl} className="btn-download" download>
              Download Merged PDF
            </a>
            <button 
              className="btn-secondary" 
              style={{ marginLeft: 12 }} 
              onClick={() => { setResult(null); setFiles([]); }}
            >
              Merge More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
