import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const DOC_TYPES = [
  {
    id: 'book', label: 'Book', icon: '📖',
    desc: 'Full book formatting with chapters, headers & print layout',
    fields: [
      { key: 'title', label: 'Book Title', placeholder: 'e.g. The Art of Science' },
      { key: 'author', label: 'Author Name', placeholder: 'e.g. Dr. Ramesh Kumar' },
      { key: 'volume', label: 'Volume / Edition', placeholder: 'e.g. Vol. 2, 3rd Edition' },
      { key: 'header', label: 'Header Text', placeholder: 'e.g. Chapter name or Publisher name' },
      { key: 'footer', label: 'Footer Text', placeholder: 'e.g. © 2024 Publisher Name' },
      { key: 'logo_url', label: 'Logo URL', placeholder: 'https://yourpublisher.com/logo.png' },
      { key: 'website_url', label: 'Publisher Website', placeholder: 'https://yourpublisher.com' },
      { key: 'isbn', label: 'ISBN', placeholder: 'e.g. 978-3-16-148410-0' },
    ],
  },
  {
    id: 'thesis', label: 'Thesis', icon: '🎓',
    desc: 'Academic thesis with university formatting standards',
    fields: [
      { key: 'title', label: 'Thesis Title', placeholder: 'e.g. Impact of AI on Education' },
      { key: 'author', label: 'Student Name', placeholder: 'e.g. Priya Sharma' },
      { key: 'university', label: 'University Name', placeholder: 'e.g. IIT Delhi' },
      { key: 'department', label: 'Department', placeholder: 'e.g. Computer Science & Engineering' },
      { key: 'supervisor', label: 'Supervisor Name', placeholder: 'e.g. Prof. A.K. Singh' },
      { key: 'year', label: 'Submission Year', placeholder: 'e.g. 2024' },
      { key: 'header', label: 'Header Text', placeholder: 'e.g. University name or thesis title' },
      { key: 'footer', label: 'Footer Text', placeholder: 'e.g. Confidential / Department name' },
    ],
  },
  {
    id: 'research', label: 'Research Paper', icon: '🔬',
    desc: 'Journal-ready research paper with citations & abstract layout',
    fields: [
      { key: 'title', label: 'Paper Title', placeholder: 'e.g. Neural Networks in Climate Modeling' },
      { key: 'author', label: 'Author(s)', placeholder: 'e.g. Kumar A., Singh B., Patel C.' },
      { key: 'journal', label: 'Journal / Conference Name', placeholder: 'e.g. IEEE Transactions on AI' },
      { key: 'volume', label: 'Volume & Issue', placeholder: 'e.g. Vol. 12, Issue 3' },
      { key: 'doi', label: 'DOI / URL', placeholder: 'e.g. 10.1109/tai.2024.001' },
      { key: 'keywords', label: 'Keywords', placeholder: 'e.g. AI, Machine Learning, Climate' },
      { key: 'header', label: 'Header Text', placeholder: 'e.g. Journal name' },
      { key: 'footer', label: 'Footer Text', placeholder: 'e.g. Page number style or copyright' },
    ],
  },
  {
    id: 'letter', label: 'Letter / Notice', icon: '✉️',
    desc: 'Formal letters, office memos and official notices',
    fields: [
      { key: 'org_name', label: 'Organization Name', placeholder: 'e.g. Ministry of Education' },
      { key: 'ref_no', label: 'Reference Number', placeholder: 'e.g. MOE/2024/001' },
      { key: 'date', label: 'Date', placeholder: 'e.g. 28 April 2024' },
      { key: 'subject', label: 'Subject', placeholder: 'e.g. Regarding Annual Report Submission' },
      { key: 'logo_url', label: 'Logo URL', placeholder: 'https://yourorg.com/logo.png' },
      { key: 'header', label: 'Header Text', placeholder: 'e.g. Government of India' },
      { key: 'footer', label: 'Footer Text', placeholder: 'e.g. Address, Phone, Website' },
      { key: 'website_url', label: 'Website URL', placeholder: 'https://yourorg.gov.in' },
    ],
  },
];

const ENGLISH_FONTS = [
  { value: 'Calibri', label: 'Calibri — Modern & Clean' },
  { value: 'Times New Roman', label: 'Times New Roman — Classic' },
  { value: 'Arial', label: 'Arial — Simple & Clear' },
  { value: 'Georgia', label: 'Georgia — Editorial' },
  { value: 'Garamond', label: 'Garamond — Publishing' },
  { value: 'Cambria', label: 'Cambria — Academic' },
];

const HINDI_FONTS = [
  { value: 'Mangal', label: 'Mangal — Standard Hindi' },
  { value: 'Kokila', label: 'Kokila — Elegant' },
  { value: 'Utsaah', label: 'Utsaah — Modern' },
  { value: 'Aparajita', label: 'Aparajita — Traditional' },
  { value: 'Nirmala UI', label: 'Nirmala UI — Clean UI' },
];

const PAGE_SIZES = [
  { value: 'A4',     label: 'A4', desc: '210 × 297 mm — International standard' },
  { value: 'A5',     label: 'A5', desc: '148 × 210 mm — Pocket books' },
  { value: 'A3',     label: 'A3', desc: '297 × 420 mm — Large format' },
  { value: 'Letter', label: 'Letter', desc: '216 × 279 mm — US standard' },
  { value: 'Legal',  label: 'Legal', desc: '216 × 356 mm — US legal' },
];

export default function App() {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [formData, setFormData] = useState({});
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [downloadUrl, setDownloadUrl] = useState(null);

  const currentType = DOC_TYPES.find(t => t.id === selectedType);

  const handleTypeSelect = (typeId) => {
    setSelectedType(typeId);
    setFormData({});
    setStep(2);
  };

  const handleFieldChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const onDrop = useCallback((acceptedFiles) => {
    setFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    multiple: false,
  });

  const handleSubmit = async () => {
    if (!file) return;
    setStatus('uploading');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('docType', selectedType);
    fd.append('options', JSON.stringify(formData));
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.post(`${API_URL}/format`, fd, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      setDownloadUrl(url);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  const handleReset = () => {
    setStep(1); setSelectedType(null); setFormData({});
    setFile(null); setStatus('idle'); setDownloadUrl(null);
  };

  const fontList = formData['font_script'] === 'hindi' ? HINDI_FONTS
    : formData['font_script'] === 'english' ? ENGLISH_FONTS : [];

  const selectedPageSize = PAGE_SIZES.find(p => p.value === formData['page_size']);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: '100vh', width: '100%', background: '#F7F8FA', color: '#1A1D23', margin: 0, padding: 0, overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; min-height: 100vh; background: #F7F8FA; margin: 0; padding: 0; overflow-x: hidden; }
        .app-shell { width: 100%; display: flex; flex-direction: column; min-height: 100vh; }

        .topnav { width: 100%; background: #ffffff; border-bottom: 1px solid #E8EAF0; padding: 0 40px; height: 60px; display: flex; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 100; }
        .nav-logo { width: 28px; height: 28px; background: linear-gradient(135deg, #2563EB, #1d4ed8); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
        .nav-brand { font-family: 'DM Serif Display', serif; font-size: 1.05rem; color: #1A1D23; letter-spacing: -0.01em; }
        .nav-badge { margin-left: 4px; background: #EFF3FF; color: #2563EB; font-size: 0.65rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 7px; border-radius: 20px; }

        .main-content { flex: 1; width: 100%; padding: 48px 60px 80px; max-width: 1100px; margin: 0 auto; }

        .page-header { margin-bottom: 40px; }
        .page-header h1 { font-family: 'DM Serif Display', serif; font-size: 2.2rem; font-weight: 400; color: #0F1117; letter-spacing: -0.02em; line-height: 1.2; margin-bottom: 8px; }
        .page-header h1 em { font-style: italic; color: #2563EB; }
        .page-header p { font-size: 0.95rem; color: #6B7280; font-weight: 400; }

        .steps-bar { display: flex; align-items: center; gap: 0; margin: 0 auto 40px auto; background: #ffffff; border: 1px solid #E8EAF0; border-radius: 12px; padding: 16px 24px; width: fit-content; }
        .step-node { display: flex; align-items: center; gap: 10px; font-size: 0.82rem; font-weight: 500; color: #9CA3AF; letter-spacing: 0.01em; }
        .step-node.active { color: #2563EB; }
        .step-node.done { color: #10B981; }
        .step-circle { width: 26px; height: 26px; border-radius: 50%; border: 2px solid #D1D5DB; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 600; flex-shrink: 0; transition: all 0.2s; background: #fff; }
        .step-node.active .step-circle { border-color: #2563EB; background: #2563EB; color: #fff; }
        .step-node.done .step-circle { border-color: #10B981; background: #10B981; color: #fff; }
        .step-connector { width: 48px; height: 2px; background: #E5E7EB; margin: 0 12px; border-radius: 1px; }
        .step-connector.done-line { background: #10B981; }

        .section-label { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin-bottom: 16px; }

        .type-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 8px; }
        .type-card { background: #ffffff; border: 1.5px solid #E8EAF0; border-radius: 12px; padding: 24px; cursor: pointer; transition: all 0.18s ease; position: relative; display: flex; flex-direction: column; gap: 8px; }
        .type-card:hover { border-color: #2563EB; box-shadow: 0 4px 20px rgba(37,99,235,0.1); transform: translateY(-2px); }
        .type-card-top { display: flex; align-items: center; gap: 12px; }
        .type-icon-wrap { width: 42px; height: 42px; background: #F0F5FF; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0; }
        .type-label { font-size: 1rem; font-weight: 600; color: #111827; letter-spacing: -0.01em; }
        .type-desc { font-size: 0.85rem; color: #6B7280; line-height: 1.55; }
        .type-arrow { position: absolute; right: 20px; top: 50%; transform: translateY(-50%); color: #D1D5DB; font-size: 1.1rem; transition: all 0.18s; }
        .type-card:hover .type-arrow { color: #2563EB; transform: translateY(-50%) translateX(3px); }

        .back-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; font-weight: 500; color: #6B7280; background: none; border: none; cursor: pointer; padding: 0; margin-bottom: 28px; transition: color 0.15s; }
        .back-btn:hover { color: #1A1D23; }

        .content-card { background: #ffffff; border: 1px solid #E8EAF0; border-radius: 16px; padding: 32px; }
        .content-card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .card-icon-wrap { width: 38px; height: 38px; background: #F0F5FF; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
        .card-title { font-family: 'DM Serif Display', serif; font-size: 1.35rem; font-weight: 400; color: #111827; letter-spacing: -0.02em; }
        .card-subtitle { font-size: 0.875rem; color: #6B7280; margin-bottom: 28px; margin-left: 50px; }

        /* ── Format Sections ── */
        .format-section { border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; }
        .format-section.blue { background: #F8FAFF; border: 1.5px solid #E0E8FF; }
        .format-section.purple { background: #FBF8FF; border: 1.5px solid #E8DEFF; }

        .format-section-title { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .format-section.blue .format-section-title { color: #2563EB; }
        .format-section.purple .format-section-title { color: #7C3AED; }

        .two-col { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }

        /* Font preview */
        .font-preview { margin-top: 12px; padding: 10px 14px; background: #fff; border: 1px solid #E5E7EB; border-radius: 8px; font-size: 0.85rem; color: #374151; display: flex; align-items: center; gap: 8px; }
        .font-preview-text { font-size: 0.95rem; color: #111827; }

        /* Page size cards */
        .page-size-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
        .page-size-card { border: 1.5px solid #E5E7EB; border-radius: 10px; padding: 12px 10px; cursor: pointer; text-align: center; transition: all 0.15s; background: #fff; }
        .page-size-card:hover { border-color: #7C3AED; background: #FBF8FF; }
        .page-size-card.selected { border-color: #7C3AED; background: #F5F0FF; }
        .page-size-label { font-size: 0.9rem; font-weight: 700; color: #111827; margin-bottom: 3px; }
        .page-size-card.selected .page-size-label { color: #7C3AED; }
        .page-size-desc { font-size: 0.68rem; color: #9CA3AF; line-height: 1.4; }

        /* Page size visual */
        .page-size-visual { display: flex; align-items: center; gap: 6px; margin-top: 4px; justify-content: center; }
        .page-rect { background: #E0D9FF; border-radius: 2px; border: 1.5px solid #7C3AED; }

        select.field-input { cursor: pointer; appearance: auto; }
        select.field-input:disabled { opacity: 0.45; cursor: not-allowed; background: #F3F4F6; }

        .fields-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-bottom: 28px; }
        .field-group { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 0.78rem; font-weight: 600; color: #374151; letter-spacing: 0.01em; display: flex; align-items: center; gap: 6px; }
        .optional-tag { font-size: 0.7rem; font-weight: 400; color: #9CA3AF; text-transform: none; letter-spacing: 0; }
        .field-input { background: #F9FAFB; border: 1.5px solid #E5E7EB; border-radius: 8px; padding: 10px 13px; color: #111827; font-family: 'DM Sans', sans-serif; font-size: 0.9rem; outline: none; transition: border-color 0.15s, box-shadow 0.15s; width: 100%; }
        .field-input:focus { border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.08); background: #fff; }
        .field-input::placeholder { color: #C4C9D4; }

        .divider { height: 1px; background: #F0F2F5; margin: 24px 0; }

        .btn-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .btn-primary { background: #2563EB; color: #ffffff; border: none; padding: 11px 28px; font-family: 'DM Sans', sans-serif; font-size: 0.875rem; font-weight: 600; cursor: pointer; border-radius: 8px; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; letter-spacing: 0.01em; }
        .btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(37,99,235,0.3); }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-secondary { background: #ffffff; color: #374151; border: 1.5px solid #E5E7EB; padding: 10px 22px; font-family: 'DM Sans', sans-serif; font-size: 0.875rem; font-weight: 500; cursor: pointer; border-radius: 8px; transition: all 0.15s; }
        .btn-secondary:hover { border-color: #9CA3AF; background: #F9FAFB; }

        .dropzone { border: 2px dashed #D1D5DB; border-radius: 12px; padding: 48px 32px; text-align: center; cursor: pointer; transition: all 0.2s; background: #F9FAFB; margin-bottom: 24px; }
        .dropzone:hover, .dropzone.active { border-color: #2563EB; background: #F0F5FF; }
        .dropzone-icon-wrap { width: 56px; height: 56px; background: #EFF3FF; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; margin: 0 auto 14px; }
        .dropzone-text { font-size: 0.95rem; font-weight: 600; color: #374151; margin-bottom: 4px; }
        .dropzone-sub { font-size: 0.82rem; color: #9CA3AF; }

        .file-selected { display: flex; align-items: center; gap: 12px; background: #F0FDF4; border: 1.5px solid #BBF7D0; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; }
        .file-icon { font-size: 1.4rem; }
        .file-name { font-size: 0.875rem; font-weight: 500; color: #065F46; flex: 1; }
        .file-size { font-size: 0.78rem; color: #6B7280; }
        .file-remove { background: none; border: none; color: #9CA3AF; cursor: pointer; font-size: 1rem; padding: 2px 6px; border-radius: 4px; transition: all 0.15s; line-height: 1; }
        .file-remove:hover { background: #FEE2E2; color: #EF4444; }

        .config-summary { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 18px 20px; margin-bottom: 20px; }
        .config-summary-title { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: #9CA3AF; margin-bottom: 12px; }
        .config-row { display: flex; gap: 10px; font-size: 0.85rem; margin-bottom: 5px; line-height: 1.5; }
        .config-key { color: #9CA3AF; min-width: 130px; text-transform: capitalize; flex-shrink: 0; }
        .config-val { color: #1F2937; font-weight: 500; }

        .status-center { text-align: center; padding: 72px 24px; background: #ffffff; border: 1px solid #E8EAF0; border-radius: 16px; }
        .status-icon-wrap { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 20px; }
        .status-icon-wrap.green { background: #F0FDF4; }
        .status-icon-wrap.red { background: #FEF2F2; }
        .spinner-ring { width: 44px; height: 44px; border: 3px solid #E5E7EB; border-top-color: #2563EB; border-radius: 50%; animation: spin 0.75s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .status-title { font-family: 'DM Serif Display', serif; font-size: 1.6rem; font-weight: 400; color: #111827; letter-spacing: -0.02em; margin-bottom: 8px; }
        .status-sub { font-size: 0.9rem; color: #6B7280; margin-bottom: 28px; }

        .btn-download { background: #059669; color: #ffffff; border: none; padding: 11px 28px; font-family: 'DM Sans', sans-serif; font-size: 0.875rem; font-weight: 600; cursor: pointer; border-radius: 8px; transition: all 0.15s; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; margin-right: 10px; }
        .btn-download:hover { background: #047857; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(5,150,105,0.3); }

        .app-footer { border-top: 1px solid #E8EAF0; background: #fff; padding: 16px 40px; text-align: center; font-size: 0.78rem; color: #C4C9D4; }

        @media (max-width: 768px) {
          .type-grid { grid-template-columns: 1fr; }
          .page-header h1 { font-size: 1.7rem; }
          .main-content { padding: 28px 20px 60px; }
          .fields-grid { grid-template-columns: 1fr !important; }
          .two-col { grid-template-columns: 1fr !important; }
          .page-size-grid { grid-template-columns: repeat(3, 1fr); }
          .steps-bar { padding: 14px 16px; }
          .topnav { padding: 0 20px; }
        }
      `}</style>

      <div className="app-shell">
        <nav className="topnav">
          <div className="nav-logo">📄</div>
          <span className="nav-brand">Format Studio</span>
          <span className="nav-badge">Pro</span>
        </nav>

        <main className="main-content">
          <div className="page-header">
            <h1>Publishing <em>Format</em> Studio</h1>
            <p>Professional document formatting for print &amp; digital publishing</p>
          </div>

          {/* Step Indicator */}
          <div className="steps-bar">
            <div className={`step-node ${step >= 1 ? (step > 1 ? 'done' : 'active') : ''}`}>
              <div className="step-circle">{step > 1 ? '✓' : '1'}</div>Select Type
            </div>
            <div className={`step-connector ${step > 1 ? 'done-line' : ''}`} />
            <div className={`step-node ${step >= 2 ? (step > 2 ? 'done' : 'active') : ''}`}>
              <div className="step-circle">{step > 2 ? '✓' : '2'}</div>Configure
            </div>
            <div className={`step-connector ${step > 2 ? 'done-line' : ''}`} />
            <div className={`step-node ${step >= 3 ? 'active' : ''}`}>
              <div className="step-circle">3</div>Format &amp; Export
            </div>
          </div>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div>
              <p className="section-label">Choose document type</p>
              <div className="type-grid">
                {DOC_TYPES.map(type => (
                  <div key={type.id} className="type-card" onClick={() => handleTypeSelect(type.id)}>
                    <div className="type-card-top">
                      <div className="type-icon-wrap">{type.icon}</div>
                      <div className="type-label">{type.label}</div>
                    </div>
                    <div className="type-desc">{type.desc}</div>
                    <span className="type-arrow">→</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && currentType && (
            <div>
              <button className="back-btn" onClick={() => setStep(1)}>← Back</button>
              <div className="content-card">
                <div className="content-card-header">
                  <div className="card-icon-wrap">{currentType.icon}</div>
                  <div className="card-title">{currentType.label} Options</div>
                </div>
                <div className="card-subtitle">Fill in what you need — all fields are optional</div>

                {/* ── Font Style ── */}
                <div className="format-section blue">
                  <div className="format-section-title">🔤 Font Style</div>
                  <div className="two-col">
                    <div className="field-group">
                      <label className="field-label">Language / Script <span className="optional-tag">Optional</span></label>
                      <select
                        className="field-input"
                        value={formData['font_script'] || ''}
                        onChange={e => {
                          handleFieldChange('font_script', e.target.value);
                          handleFieldChange('font_style', '');
                        }}
                      >
                        <option value="">Select language...</option>
                        <option value="english">English</option>
                        <option value="hindi">Hindi (हिन्दी)</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label">Font Family <span className="optional-tag">Optional</span></label>
                      <select
                        className="field-input"
                        value={formData['font_style'] || ''}
                        onChange={e => handleFieldChange('font_style', e.target.value)}
                        disabled={!formData['font_script']}
                      >
                        <option value="">{formData['font_script'] ? 'Select font...' : 'Select language first'}</option>
                        {fontList.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {formData['font_style'] && (
                    <div className="font-preview">
                      <span>Preview:</span>
                      <span className="font-preview-text" style={{ fontFamily: formData['font_style'] }}>
                        {formData['font_script'] === 'hindi'
                          ? 'यह एक नमूना पाठ है। The quick brown fox.'
                          : 'The quick brown fox jumps over the lazy dog.'}
                      </span>
                    </div>
                  )}
                </div>

                {/* ── Page Size ── */}
                <div className="format-section purple">
                  <div className="format-section-title">📐 Page Size</div>
                  <div className="page-size-grid">
                    {PAGE_SIZES.map(ps => (
                      <div
                        key={ps.value}
                        className={`page-size-card ${formData['page_size'] === ps.value ? 'selected' : ''}`}
                        onClick={() => handleFieldChange('page_size', ps.value)}
                      >
                        <div className="page-size-label">{ps.label}</div>
                        <div className="page-size-desc">{ps.desc}</div>
                      </div>
                    ))}
                  </div>
                  {selectedPageSize && (
                    <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#7C3AED', fontWeight: 500 }}>
                      ✓ Selected: {selectedPageSize.label} — {selectedPageSize.desc}
                    </div>
                  )}
                  {!formData['page_size'] && (
                    <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#9CA3AF' }}>
                      Default: A4 will be used if none selected
                    </div>
                  )}
                </div>

                {/* ── Document Fields ── */}
                <p className="section-label" style={{ marginTop: '8px' }}>Document details</p>
                <div className="fields-grid">
                  {currentType.fields.map(field => (
                    <div className="field-group" key={field.key}>
                      <label className="field-label">
                        {field.label} <span className="optional-tag">Optional</span>
                      </label>
                      <input
                        className="field-input"
                        type="text"
                        placeholder={field.placeholder}
                        value={formData[field.key] || ''}
                        onChange={e => handleFieldChange(field.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>

                <div className="divider" />
                <div className="btn-row">
                  <button className="btn-primary" onClick={() => setStep(3)}>Continue to Upload →</button>
                  <button className="btn-secondary" onClick={() => setStep(1)}>Change Type</button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && status === 'idle' && (
            <div>
              <button className="back-btn" onClick={() => setStep(2)}>← Back to Options</button>
              <div className="content-card">
                <div className="content-card-header">
                  <div className="card-icon-wrap">📁</div>
                  <div className="card-title">Upload Your Document</div>
                </div>
                <div className="card-subtitle">Upload your .docx file — we'll apply your formatting preferences</div>

                {!file ? (
                  <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
                    <input {...getInputProps()} />
                    <div className="dropzone-icon-wrap">📄</div>
                    <div className="dropzone-text">{isDragActive ? 'Drop your file here...' : 'Drag & drop your .docx file here'}</div>
                    <div className="dropzone-sub">or click to browse files</div>
                  </div>
                ) : (
                  <div className="file-selected">
                    <span className="file-icon">📎</span>
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                    <button className="file-remove" onClick={() => setFile(null)}>✕</button>
                  </div>
                )}

                {Object.keys(formData).filter(k => formData[k]).length > 0 && (
                  <div className="config-summary">
                    <div className="config-summary-title">Configuration Summary</div>
                    {Object.entries(formData).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="config-row">
                        <span className="config-key">{k.replace(/_/g, ' ')}</span>
                        <span className="config-val">{v}</span>
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

          {/* ── Uploading ── */}
          {status === 'uploading' && (
            <div className="status-center">
              <div className="spinner-ring" />
              <div className="status-title">Formatting your document…</div>
              <div className="status-sub">This may take a few seconds. Please wait.</div>
            </div>
          )}

          {/* ── Done ── */}
          {status === 'done' && (
            <div className="status-center">
              <div className="status-icon-wrap green">✅</div>
              <div className="status-title">Document Formatted</div>
              <div className="status-sub">Your document is ready to download.</div>
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <a href={downloadUrl} download="formatted_document.docx" className="btn-download">⬇ Download File</a>
                <button className="btn-secondary" onClick={handleReset}>Format Another</button>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {status === 'error' && (
            <div className="status-center">
              <div className="status-icon-wrap red">⚠️</div>
              <div className="status-title" style={{ color: '#DC2626' }}>Formatting Failed</div>
              <div className="status-sub">Something went wrong. Please check your file and try again.</div>
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <button className="btn-primary" onClick={() => setStatus('idle')}>Try Again</button>
                <button className="btn-secondary" onClick={handleReset}>Start Over</button>
              </div>
            </div>
          )}

        </main>

        <footer className="app-footer">
          Publishing Format Studio · Professional document formatting
        </footer>
      </div>
    </div>
  );
}
