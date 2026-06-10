import React, { useState } from 'react';

export default function ExcelToPDF({ navTo }) {
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
      const newFiles = Array.from(e.dataTransfer.files).filter(f => 
        f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls')
      );
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      setError('Please select at least one Excel file.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/excel-to-pdf`, {
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
        <h1 className="tool-title">Excel to PDF Converter</h1>
        <p className="tool-subtitle">Convert your Excel spreadsheets into professional PDF documents.</p>
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
              <div className="dropzone-icon">📊</div>
              <div className="dropzone-text">Click or drag Excel files here</div>
              <div className="dropzone-sub">Supports multiple .xlsx, .xls files</div>
              <input 
                id="fileInput"
                type="file" 
                accept=".xlsx,.xls"
                multiple
                style={{ display: 'none' }} 
                onChange={(e) => setFiles(prev => [...prev, ...Array.from(e.target.files)])}
              />
            </div>

            {files.length > 0 && (
              <div className="file-list" style={{ marginTop: 20, marginBottom: 20 }}>
                {files.map((file, idx) => (
                  <div key={idx} className="file-selected" style={{ marginBottom: 8 }}>
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                    <button className="file-remove" onClick={(e) => { e.stopPropagation(); removeFile(idx); }}>×</button>
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
              {loading ? <div className="spinner" style={{ width: 18, height: 18, margin: 0 }} /> : `Convert ${files.length} File${files.length > 1 ? 's' : ''} to PDF`}
            </button>
          </>
        ) : (
          <div className="status-center">
            <div className="status-icon">✅</div>
            <h2 className="status-title">Conversion Complete</h2>
            <p className="status-sub">Your Excel files have been converted to PDF successfully.</p>
            
            <div className="download-list" style={{ marginTop: 20, marginBottom: 20, width: '100%' }}>
              {result.files.map((resFile, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: '#f8fafc', borderRadius: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{resFile.originalName}</span>
                  <button 
                    onClick={() => {
                      const API_URL = import.meta.env.VITE_API_URL || '';
                      window.location.href = (resFile.downloadUrl.startsWith('http') ? '' : API_URL) + resFile.downloadUrl;
                    }} 
                    className="btn-download"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>

            <button 
              className="btn-secondary" 
              style={{ width: '100%', justifyContent: 'center' }} 
              onClick={() => { setResult(null); setFiles([]); }}
            >
              Convert More Files
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
