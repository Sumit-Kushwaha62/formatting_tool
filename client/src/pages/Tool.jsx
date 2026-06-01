import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { DOC_TYPES, ENGLISH_FONTS, HINDI_FONTS, FONT_SIZES, LINE_SPACINGS, PAGE_SIZES, PAGE_NUM_POSITIONS } from '../constants/data';
import TrialBanner from '../components/ui/TrialBanner';
import PaywallModal from '../components/ui/PaywallModal';

export default function Tool({ navTo }) {
  const { user, userPlan, docsCount, refreshPlanAndDocs } = useAuth();

  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [formData, setFormData] = useState({});
  const [file, setFile] = useState(null);
  const [downloadFileName, setDownloadFileName] = useState('formatted_document.docx');
  const [status, setStatus] = useState('idle'); // 'idle' | 'uploading' | 'done' | 'error'
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Fetch real document count on mount
  React.useEffect(() => {
    if (user?.id) {
      refreshPlanAndDocs();
    }
  }, [user?.id]);

  // If a free user has formatted 3 or more documents, we block them with the paywall modal
  const showPaywall = user && userPlan === 'free' && (docsCount >= 3 || paywallOpen);

  const currentType = DOC_TYPES.find(t => t.id === selectedType);
  const fontList = formData.font_script === 'hindi' ? HINDI_FONTS : formData.font_script === 'english' ? ENGLISH_FONTS : [];

  const withTimeout = (promise, ms, message) => (
    Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), ms);
      })
    ])
  );

  const refreshDocsWithRetry = async (userId) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await refreshPlanAndDocs(userId);
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }
  };

  const handleTypeSelect = (id) => {
    setSelectedType(id);
    setFormData({});
    setStep(2);
  };

  const handleFieldChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleToggle = (key) => {
    setFormData(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const onDrop = useCallback((files) => {
    const selectedFile = files[0];
    setFile(selectedFile);
    setDownloadFileName(selectedFile?.name || 'formatted_document.docx');
    if (downloadUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
  }, [downloadUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    multiple: false,
  });

  // const handleSubmit = async () => {
  //   if (!file) return;

  //   try {
  //     setStatus('uploading');

  //     // 1. Sync check for free plan limit
  //     const { docsCount: latestCount, plan: latestPlan } = await refreshPlanAndDocs(user?.id);
  //     if (latestPlan === 'free' && latestCount >= 3) {
  //       setStatus('idle');
  //       return;
  //     }


  //     // 2. Prepare data
  //     const fd = new FormData();
  //     fd.append('file', file);
  //     fd.append('docType', selectedType);
  //     fd.append('options', JSON.stringify(formData));
  //     if (user?.id) {
  //       fd.append('userId', user.id);
  //     }

  //     // 3. API call with exact working pattern
  //     const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  //     const res = await axios.post(`${API_URL}/format`, fd, { responseType: 'blob' });

  //     setDownloadUrl(URL.createObjectURL(new Blob([res.data])));
  //     setStatus('done');

  //     // 4. Update local document list/count
  //     if (user?.id) {
  //       refreshPlanAndDocs();
  //     }
  //   } catch (err) {
  //     console.error('Format Submit Error:', err);
  //     setStatus('error');
  //   }
  // };


const handleSubmit = async () => {
  if (!file) return;
  
  setStatus('uploading');

  try {
    let activeUserId = user?.id;
    if (!activeUserId) {
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          5000,
          'Session check timed out'
        );
        activeUserId = session?.user?.id;
      } catch (sessionErr) {
        console.warn('Continuing without session after session check failed:', sessionErr);
      }
    }

    if (activeUserId && userPlan === 'free') {
      let latestCount = docsCount;

      try {
        const { count, error } = await withTimeout(
          supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', activeUserId),
          15000,
          'Document count check timed out'
        );

        if (error) {
          throw error;
        }

        latestCount = count || 0;
      } catch (countErr) {
        console.warn('Using cached document count after count check failed:', countErr);
      }

      if (latestCount >= 3) {
        setPaywallOpen(true);
        setStatus('idle');
        return;
      }
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('docType', selectedType);
    fd.append('options', JSON.stringify(formData));
    if (activeUserId) fd.append('userId', activeUserId);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const res = await axios.post(`${API_URL}/format`, fd, {
      responseType: 'blob',
      timeout: 180000,
    });
    if (downloadUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(downloadUrl);
    }
    const contentType = res.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      const responseText = await res.data.text();
      const { downloadUrl: dlUrl, fileName } = JSON.parse(responseText);
      setDownloadFileName(fileName || file.name);
      setDownloadUrl(API_URL + dlUrl);
    } else {
      setDownloadFileName(file.name);
      setDownloadUrl(URL.createObjectURL(res.data));
    }
    setStatus('done');
    if (activeUserId) refreshDocsWithRetry(activeUserId);
  } catch (err) {
    console.error('Error:', err);
    setStatus('error');
  }
};



  const handleReset = () => {
    setStep(1);
    setSelectedType(null);
    setFormData({});
    setFile(null);
    setDownloadFileName('formatted_document.docx');
    setStatus('idle');
    if (downloadUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(downloadUrl);
    }
    setDownloadUrl(null);
  };

  return (
    <div className="tool-page">
      {/* Paywall Blocker Overlay */}
      {showPaywall && (
        <PaywallModal isOpen={true} onClose={() => navTo('dashboard')} />
      )}

      <div className="tool-header">
        <h1 className="tool-title">Format Your Document</h1>
        <p className="tool-subtitle">Select type → Configure → Upload → Download</p>
      </div>

      {/* Trial Countdown Banner */}
      <TrialBanner />

      <div className="steps-bar">
        {[{ n: 1, label: 'Select Type' }, { n: 2, label: 'Configure' }, { n: 3, label: 'Upload & Export' }].map(({ n, label }) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', flex: n < 3 ? 1 : 0 }}>
            <div className={`step-node ${step === n ? 'active' : step > n ? 'done' : ''}`}>
              <div className="step-circle">{step > n ? '✓' : n}</div>
              <span>{label}</span>
            </div>
            {n < 3 && <div className={`step-connector ${step > n ? 'done' : ''}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Type */}
      {step === 1 && (
        <div className="card">
          <div className="card-title">Select document type</div>
          <div className="card-sub">Choose the format that matches your document</div>
          <div className="type-grid">
            {DOC_TYPES.map(t => (
              <div className="type-card" key={t.id} onClick={() => handleTypeSelect(t.id)}>
                <div className="type-card-tag">{t.tag}</div>
                <div className="type-card-icon">{t.icon}</div>
                <div className="type-card-name">{t.label}</div>
                <div className="type-card-desc">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && currentType && (
        <div>
          <button className="back-btn" onClick={() => setStep(1)}>← Back</button>
          <div className="card">
            <div className="card-title">{currentType.icon} {currentType.label} — Options</div>
            <div className="card-sub">All fields optional — leave blank for defaults</div>

            {/* Font section */}
            <div className="form-section">
              <div className="form-section-title">◈ Font & Typography</div>
              <div className="form-grid-2">
                <div className="field-group">
                  <label className="field-label">Language <span className="field-opt">Optional</span></label>
                  <select
                    className="field-input"
                    value={formData.font_script || ''}
                    onChange={e => { handleFieldChange('font_script', e.target.value); handleFieldChange('font_style', ''); }}
                  >
                    <option value="">Select language...</option>
                    <option value="english">English</option>
                    <option value="hindi">Hindi — KrutiDev / Unicode</option>
                  </select>
                </div>
                <div className="field-group">
                  <label className="field-label">Font Family <span className="field-opt">Optional</span></label>
                  <select
                    className="field-input"
                    value={formData.font_style || ''}
                    onChange={e => handleFieldChange('font_style', e.target.value)}
                    disabled={!formData.font_script}
                  >
                    <option value="">{formData.font_script ? 'Select font...' : 'Select language first'}</option>
                    {fontList.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label className="field-label">Font Size <span className="field-opt">Default: 12</span></label>
                  <select className="field-input" value={formData.font_size || '12'} onChange={e => handleFieldChange('font_size', e.target.value)}>
                    {FONT_SIZES.map(sz => <option key={sz} value={sz}>{sz} pt</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label className="field-label">Line Spacing <span className="field-opt">Default: 1.15</span></label>
                  <select className="field-input" value={formData.line_spacing || '1.15'} onChange={e => handleFieldChange('line_spacing', e.target.value)}>
                    {LINE_SPACINGS.map(ls => <option key={ls.value} value={ls.value}>{ls.label}</option>)}
                  </select>
                </div>
              </div>
              {formData.font_style && (
                <div className="font-preview">
                  Preview: <span style={{ fontFamily: formData.font_style, fontSize: `${formData.font_size || 12}px`, color: 'var(--navy)', marginLeft: 8 }}>
                    {formData.font_script === 'hindi' ? 'यह एक नमूना पाठ है।' : 'The quick brown fox jumps over the lazy dog.'}
                  </span>
                </div>
              )}
            </div>

            {/* Page size */}
            <div className="form-section">
              <div className="form-section-title">◈ Page Size</div>
              <div className="form-grid-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                {PAGE_SIZES.map(ps => (
                  <div key={ps.value} className={`sel-card ${formData.page_size === ps.value ? 'selected' : ''}`} onClick={() => handleFieldChange('page_size', ps.value)}>
                    <div className="sel-card-label">{ps.label}</div>
                    <div className="sel-card-desc">{ps.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Page numbers and header/footers */}
            <div className="form-section">
              <div className="form-section-title">◈ Page Numbers & Header/Footer</div>
              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Auto Page Numbers</div>
                  <div className="toggle-sub">Add page X of Y automatically</div>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={!!formData.page_numbers} onChange={() => handleToggle('page_numbers')} />
                  <span className="toggle-slider" />
                </label>
              </div>
              {formData.page_numbers && (
                <div style={{ marginBottom: 16 }}>
                  <div className="field-label" style={{ marginBottom: 8 }}>Position</div>
                  <div className="form-grid-3">
                    {PAGE_NUM_POSITIONS.map(p => (
                      <div key={p.value} className={`sel-card ${formData.page_number_position === p.value ? 'selected' : ''}`}
                        onClick={() => handleFieldChange('page_number_position', p.value)}>
                        <div className="sel-card-label">{p.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, maxWidth: 200 }}>
                    <div className="field-label" style={{ marginBottom: 8 }}>Starting Page Number</div>
                    <input
                      className="field-input"
                      type="number"
                      min="1"
                      placeholder="e.g. 1"
                      value={formData.start_page_number || ''}
                      onChange={e => handleFieldChange('start_page_number', e.target.value)}
                    />
                  </div>
                </div>
              )}
              <div className="form-grid-2" style={{ marginTop: 12 }}>
                <div className="field-group">
                  <label className="field-label">Header Text <span className="field-opt">Optional</span></label>
                  <input className="field-input" type="text" placeholder="e.g. Chapter title" value={formData.header || ''} onChange={e => handleFieldChange('header', e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="field-label">Footer Text <span className="field-opt">Optional</span></label>
                  <input className="field-input" type="text" placeholder="e.g. © 2024 Publisher" value={formData.footer || ''} onChange={e => handleFieldChange('footer', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Document specific details */}
            <div className="form-section">
              <div className="form-section-title">◈ Document Details</div>
              <div className="form-grid-fields">
                {currentType.fields.filter(f => f.key !== 'header' && f.key !== 'footer').map(field => (
                  <div className="field-group" key={field.key}>
                    <label className="field-label">{field.label} <span className="field-opt">Optional</span></label>
                    <input className="field-input" type="text" placeholder={field.placeholder}
                      value={formData[field.key] || ''} onChange={e => handleFieldChange(field.key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="divider" />
            <div className="btn-row">
              <button className="btn-primary" onClick={() => setStep(3)}>Continue to Upload →</button>
              <button className="btn-secondary" onClick={() => setStep(1)}>Change Type</button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Upload & Export */}
      {step === 3 && status === 'idle' && (
        <div>
          <button className="back-btn" onClick={() => setStep(2)}>← Back to Options</button>
          <div className="card">
            <div className="card-title">Upload Your Document</div>
            <div className="card-sub">Upload a .docx file — all formatting preferences will be applied</div>

            {!file ? (
              <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
                <input {...getInputProps()} />
                <div className="dropzone-icon">📄</div>
                <div className="dropzone-text">{isDragActive ? 'Drop file here...' : 'Click to select or drag & drop'}</div>
                <div className="dropzone-sub">.docx files only</div>
              </div>
            ) : (
              <div className="file-selected">
                <span>📎</span>
                <span className="file-name">{file.name}</span>
                <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                <button className="file-remove" onClick={() => { setFile(null); setDownloadFileName('formatted_document.docx'); }}>✕</button>
              </div>
            )}

            {Object.keys(formData).filter(k => formData[k] !== undefined && formData[k] !== '' && formData[k] !== false).length > 0 && (
              <div className="config-summary">
                <div className="config-summary-title">Configuration Summary</div>
                {Object.entries(formData).filter(([, v]) => v !== undefined && v !== '' && v !== false).map(([k, v]) => (
                  <div key={k} className="config-row">
                    <span className="config-key">{k.replace(/_/g, ' ')}</span>
                    <span className="config-val">{v === true ? 'Yes' : String(v)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="divider" />
            <div className="btn-row">
              <button className="btn-primary" onClick={handleSubmit} disabled={!file}>Format Document</button>
              <button className="btn-secondary" onClick={handleReset}>Start Over</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Status */}
      {status === 'uploading' && (
        <div className="status-center">
          <div className="spinner" />
          <div className="status-title">Formatting your document…</div>
          <div className="status-sub">Applying all formatting rules. This takes a few seconds.</div>
        </div>
      )}

      {/* Success Status */}
      {status === 'done' && (
        <div className="status-center">
          <div className="status-icon">✅</div>
          <div className="status-title">Document Formatted</div>
          <div className="status-sub">Your document is ready to download.</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={downloadUrl} download={downloadFileName} className="btn-download">⬇ Download File</a>
            <button className="btn-secondary" onClick={handleReset}>Format Another</button>
          </div>
        </div>
      )}

      {/* Error Status */}
      {status === 'error' && (
        <div className="status-center">
          <div className="status-icon">⚠️</div>
          <div className="status-title" style={{ color: 'var(--red)' }}>Formatting Failed</div>
          <div className="status-sub">Check your file and try again.</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn-primary" onClick={() => setStatus('idle')}>Try Again</button>
            <button className="btn-secondary" onClick={handleReset}>Start Over</button>
          </div>
        </div>
      )}
    </div>
  );
}
