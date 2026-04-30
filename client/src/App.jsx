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
      { key: 'department', label: 'Department', placeholder: 'e.g. Computer Science' },
      { key: 'supervisor', label: 'Supervisor Name', placeholder: 'e.g. Prof. A.K. Singh' },
      { key: 'year', label: 'Submission Year', placeholder: 'e.g. 2024' },
      { key: 'header', label: 'Header Text', placeholder: 'e.g. University name' },
      { key: 'footer', label: 'Footer Text', placeholder: 'e.g. Confidential' },
    ],
  },
  {
    id: 'research', label: 'Research Paper', icon: '🔬',
    desc: 'Journal-ready research paper with citations & abstract layout',
    fields: [
      { key: 'title', label: 'Paper Title', placeholder: 'e.g. Neural Networks in Climate' },
      { key: 'author', label: 'Author(s)', placeholder: 'e.g. Kumar A., Singh B.' },
      { key: 'journal', label: 'Journal / Conference', placeholder: 'e.g. IEEE Transactions on AI' },
      { key: 'volume', label: 'Volume & Issue', placeholder: 'e.g. Vol. 12, Issue 3' },
      { key: 'doi', label: 'DOI / URL', placeholder: 'e.g. 10.1109/tai.2024.001' },
      { key: 'keywords', label: 'Keywords', placeholder: 'e.g. AI, Machine Learning' },
      { key: 'header', label: 'Header Text', placeholder: 'e.g. Journal name' },
      { key: 'footer', label: 'Footer Text', placeholder: 'e.g. Copyright notice' },
    ],
  },
  {
    id: 'letter', label: 'Letter / Notice', icon: '✉️',
    desc: 'Formal letters, office memos and official notices',
    fields: [
      { key: 'org_name', label: 'Organization Name', placeholder: 'e.g. Ministry of Education' },
      { key: 'ref_no', label: 'Reference Number', placeholder: 'e.g. MOE/2024/001' },
      { key: 'date', label: 'Date', placeholder: 'e.g. 28 April 2024' },
      { key: 'subject', label: 'Subject', placeholder: 'e.g. Annual Report Submission' },
      { key: 'header', label: 'Header Text', placeholder: 'e.g. Government of India' },
      { key: 'footer', label: 'Footer Text', placeholder: 'e.g. Address, Phone, Website' },
      { key: 'website_url', label: 'Website URL', placeholder: 'https://yourorg.gov.in' },
    ],
  },
];

const ENGLISH_FONTS = [
  { value: 'Calibri',          label: 'Calibri — Modern & Clean' },
  { value: 'Times New Roman',  label: 'Times New Roman — Classic' },
  { value: 'Arial',            label: 'Arial — Simple & Clear' },
  { value: 'Georgia',          label: 'Georgia — Editorial' },
  { value: 'Garamond',         label: 'Garamond — Publishing' },
  { value: 'Cambria',          label: 'Cambria — Academic' },
];

const HINDI_FONTS = [
  { value: 'Krutidev010',  label: 'KrutiDev 010 — Classic Hindi' },
  { value: 'Krutidev011',  label: 'KrutiDev 011 — Alternate' },
  { value: 'Mangal',       label: 'Mangal — Standard Unicode' },
  { value: 'Kokila',       label: 'Kokila — Elegant' },
  { value: 'Utsaah',       label: 'Utsaah — Modern' },
  { value: 'Aparajita',    label: 'Aparajita — Traditional' },
  { value: 'Nirmala UI',   label: 'Nirmala UI — Clean UI' },
];

const PAGE_SIZES = [
  { value: 'A4',     label: 'A4',     desc: '210×297mm' },
  { value: 'A5',     label: 'A5',     desc: '148×210mm' },
  { value: 'A3',     label: 'A3',     desc: '297×420mm' },
  { value: 'Letter', label: 'Letter', desc: '216×279mm' },
  { value: 'Legal',  label: 'Legal',  desc: '216×356mm' },
];

const PAGE_NUM_POSITIONS = [
  { value: 'left',   label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right',  label: 'Right' },
];

export default function App() {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [formData, setFormData] = useState({});
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [downloadUrl, setDownloadUrl] = useState(null);

  const currentType = DOC_TYPES.find(t => t.id === selectedType);
  const handleTypeSelect = (id) => { setSelectedType(id); setFormData({}); setStep(2); };
  const handleFieldChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));
  const handleToggle = (key) => setFormData(prev => ({ ...prev, [key]: !prev[key] }));

  const onDrop = useCallback((files) => setFile(files[0]), []);
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
      setDownloadUrl(URL.createObjectURL(new Blob([res.data])));
      setStatus('done');
    } catch { setStatus('error'); }
  };

  const handleReset = () => {
    setStep(1); setSelectedType(null); setFormData({});
    setFile(null); setStatus('idle'); setDownloadUrl(null);
  };

  const fontList = formData.font_script === 'hindi' ? HINDI_FONTS
    : formData.font_script === 'english' ? ENGLISH_FONTS : [];

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", minHeight:'100vh', width:'100%', background:'#F7F8FA' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{width:100%;min-height:100vh;background:#F7F8FA}

        .topnav{width:100%;background:#fff;border-bottom:1px solid #E8EAF0;padding:0 20px;height:56px;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:100}
        .nav-logo{width:28px;height:28px;background:linear-gradient(135deg,#2563EB,#1d4ed8);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
        .nav-brand{font-family:'DM Serif Display',serif;font-size:1rem;color:#1A1D23}
        .nav-badge{margin-left:4px;background:#EFF3FF;color:#2563EB;font-size:.65rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:20px;white-space:nowrap}

        .main-content{width:100%;padding:24px 16px 60px;max-width:1100px;margin:0 auto}
        .page-header{margin-bottom:28px}
        .page-header h1{font-family:'DM Serif Display',serif;font-size:1.7rem;color:#0F1117;letter-spacing:-.02em;line-height:1.2;margin-bottom:6px}
        .page-header h1 em{font-style:italic;color:#2563EB}
        .page-header p{font-size:.875rem;color:#6B7280}

        .steps-bar{display:flex;align-items:center;margin:0 0 28px;background:#fff;border:1px solid #E8EAF0;border-radius:12px;padding:12px 16px;overflow-x:auto;-webkit-overflow-scrolling:touch}
        .step-node{display:flex;align-items:center;gap:7px;font-size:.78rem;font-weight:500;color:#9CA3AF;white-space:nowrap}
        .step-node.active{color:#2563EB}
        .step-node.done{color:#10B981}
        .step-circle{width:24px;height:24px;border-radius:50%;border:2px solid #D1D5DB;display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:600;background:#fff;transition:all .2s;flex-shrink:0}
        .step-node.active .step-circle{border-color:#2563EB;background:#2563EB;color:#fff}
        .step-node.done .step-circle{border-color:#10B981;background:#10B981;color:#fff}
        .step-connector{width:28px;height:2px;background:#E5E7EB;margin:0 8px;border-radius:1px;flex-shrink:0}
        .step-connector.done-line{background:#10B981}

        .section-label{font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#9CA3AF;margin-bottom:14px}

        /* Type grid: 2-col on mobile, 4-col on desktop */
        .type-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
        .type-card{background:#fff;border:1.5px solid #E8EAF0;border-radius:12px;padding:16px;cursor:pointer;transition:all .18s;position:relative;display:flex;flex-direction:column;gap:6px}
        .type-card:hover{border-color:#2563EB;box-shadow:0 4px 20px rgba(37,99,235,.1)}
        .type-card-top{display:flex;align-items:center;gap:10px}
        .type-icon-wrap{width:38px;height:38px;background:#F0F5FF;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0}
        .type-label{font-size:.9rem;font-weight:600;color:#111827;line-height:1.3}
        .type-desc{font-size:.8rem;color:#6B7280;line-height:1.5}
        .type-arrow{display:none}

        .back-btn{display:inline-flex;align-items:center;gap:6px;font-size:.82rem;font-weight:500;color:#6B7280;background:none;border:none;cursor:pointer;padding:0;margin-bottom:20px;transition:color .15s;font-family:'DM Sans',sans-serif;-webkit-tap-highlight-color:transparent}
        .back-btn:hover{color:#1A1D23}

        .content-card{background:#fff;border:1px solid #E8EAF0;border-radius:16px;padding:20px 16px}
        .content-card-header{display:flex;align-items:center;gap:10px;margin-bottom:4px}
        .card-icon-wrap{width:36px;height:36px;background:#F0F5FF;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
        .card-title{font-family:'DM Serif Display',serif;font-size:1.2rem;color:#111827;letter-spacing:-.02em}
        .card-subtitle{font-size:.82rem;color:#6B7280;margin-bottom:20px;margin-left:46px}

        .format-section{border-radius:12px;padding:16px;margin-bottom:14px}
        .format-section.blue{background:#F8FAFF;border:1.5px solid #E0E8FF}
        .format-section.purple{background:#FBF8FF;border:1.5px solid #E8DEFF}
        .format-section.green{background:#F3FBF5;border:1.5px solid #C6EDD1}
        .format-section.orange{background:#FFFBF5;border:1.5px solid #FDE8C8}
        .format-section.teal{background:#F0FDFB;border:1.5px solid #B2E8E0}

        .format-section-title{font-size:.75rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px}
        .format-section.blue   .format-section-title{color:#2563EB}
        .format-section.purple .format-section-title{color:#7C3AED}
        .format-section.green  .format-section-title{color:#15803D}
        .format-section.orange .format-section-title{color:#C2410C}
        .format-section.teal   .format-section-title{color:#0F766E}

        /* Responsive grids */
        .two-col{display:grid;grid-template-columns:1fr;gap:12px}
        .three-col{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}

        .font-preview{margin-top:10px;padding:10px 12px;background:#fff;border:1px solid #E5E7EB;border-radius:8px;font-size:.82rem;color:#374151;display:flex;align-items:center;gap:8px;flex-wrap:wrap}

        /* Page size: 3 per row on mobile */
        .page-size-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .sel-card{border:1.5px solid #E5E7EB;border-radius:10px;padding:10px 8px;cursor:pointer;text-align:center;transition:all .15s;background:#fff;-webkit-tap-highlight-color:transparent}
        .sel-card-label{font-size:.85rem;font-weight:700;color:#111827;margin-bottom:2px}
        .sel-card-desc{font-size:.65rem;color:#9CA3AF;line-height:1.4}

        .sel-card.purple:hover,.sel-card.purple:active{border-color:#7C3AED;background:#FBF8FF}
        .sel-card.purple.selected{border-color:#7C3AED;background:#F5F0FF}
        .sel-card.purple.selected .sel-card-label{color:#7C3AED}

        /* Align grid: 3 col on mobile */
        .align-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .sel-card.green:hover,.sel-card.green:active{border-color:#15803D;background:#F3FBF5}
        .sel-card.green.selected{border-color:#15803D;background:#DCFCE7}
        .sel-card.green.selected .sel-card-label{color:#15803D}

        .sel-card.orange:hover,.sel-card.orange:active{border-color:#C2410C;background:#FFFBF5}
        .sel-card.orange.selected{border-color:#C2410C;background:#FEF3C7}
        .sel-card.orange.selected .sel-card-label{color:#C2410C}

        .toggle-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:12px}
        .toggle-label{font-size:.88rem;font-weight:500;color:#374151}
        .toggle-sub{font-size:.75rem;color:#9CA3AF;margin-top:2px}
        .toggle{position:relative;width:44px;height:24px;cursor:pointer;flex-shrink:0}
        .toggle input{opacity:0;width:0;height:0;position:absolute}
        .toggle-slider{position:absolute;inset:0;background:#D1D5DB;border-radius:24px;transition:.2s}
        .toggle-slider::before{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
        .toggle input:checked + .toggle-slider{background:#0F766E}
        .toggle input:checked + .toggle-slider::before{transform:translateX(20px)}

        select.field-input{cursor:pointer;appearance:auto}
        select.field-input:disabled{opacity:.45;cursor:not-allowed;background:#F3F4F6}

        /* Fields: 1 col on mobile */
        .fields-grid{display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:24px}
        .field-group{display:flex;flex-direction:column;gap:6px}
        .field-label{font-size:.78rem;font-weight:600;color:#374151;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .optional-tag{font-size:.7rem;font-weight:400;color:#9CA3AF}
        .field-input{background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:8px;padding:11px 13px;color:#111827;font-family:'DM Sans',sans-serif;font-size:16px;outline:none;transition:border-color .15s,box-shadow .15s;width:100%}
        .field-input:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.08);background:#fff}
        .field-input::placeholder{color:#C4C9D4}

        .divider{height:1px;background:#F0F2F5;margin:20px 0}
        .btn-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .btn-primary{background:#2563EB;color:#fff;border:none;padding:13px 24px;font-family:'DM Sans',sans-serif;font-size:.9rem;font-weight:600;cursor:pointer;border-radius:8px;transition:all .15s;display:inline-flex;align-items:center;gap:6px;min-height:44px;-webkit-tap-highlight-color:transparent}
        .btn-primary:hover{background:#1d4ed8}
        .btn-primary:active{background:#1e3a8a;transform:scale(0.98)}
        .btn-primary:disabled{opacity:.4;cursor:not-allowed}
        .btn-secondary{background:#fff;color:#374151;border:1.5px solid #E5E7EB;padding:12px 20px;font-family:'DM Sans',sans-serif;font-size:.875rem;font-weight:500;cursor:pointer;border-radius:8px;transition:all .15s;min-height:44px;-webkit-tap-highlight-color:transparent}
        .btn-secondary:hover{border-color:#9CA3AF;background:#F9FAFB}
        .btn-secondary:active{transform:scale(0.98)}

        .dropzone{border:2px dashed #D1D5DB;border-radius:12px;padding:36px 24px;text-align:center;cursor:pointer;transition:all .2s;background:#F9FAFB;margin-bottom:20px;-webkit-tap-highlight-color:transparent}
        .dropzone:hover,.dropzone.active{border-color:#2563EB;background:#F0F5FF}
        .dropzone-icon-wrap{width:52px;height:52px;background:#EFF3FF;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 12px}
        .dropzone-text{font-size:.9rem;font-weight:600;color:#374151;margin-bottom:4px}
        .dropzone-sub{font-size:.8rem;color:#9CA3AF}

        .file-selected{display:flex;align-items:center;gap:10px;background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:10px;padding:12px 14px;margin-bottom:18px}
        .file-name{font-size:.82rem;font-weight:500;color:#065F46;flex:1;word-break:break-all}
        .file-size{font-size:.75rem;color:#6B7280;white-space:nowrap}
        .file-remove{background:none;border:none;color:#9CA3AF;cursor:pointer;font-size:1rem;padding:4px 8px;border-radius:4px;transition:all .15s;min-width:32px;min-height:32px;display:flex;align-items:center;justify-content:center}
        .file-remove:hover{background:#FEE2E2;color:#EF4444}

        .config-summary{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:14px 16px;margin-bottom:18px}
        .config-summary-title{font-size:.72rem;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:#9CA3AF;margin-bottom:10px}
        .config-row{display:flex;gap:8px;font-size:.82rem;margin-bottom:5px;flex-wrap:wrap}
        .config-key{color:#9CA3AF;min-width:120px;text-transform:capitalize;flex-shrink:0}
        .config-val{color:#1F2937;font-weight:500}

        .status-center{text-align:center;padding:56px 20px;background:#fff;border:1px solid #E8EAF0;border-radius:16px}
        .status-icon-wrap{width:68px;height:68px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.8rem;margin:0 auto 18px}
        .status-icon-wrap.green{background:#F0FDF4}
        .status-icon-wrap.red{background:#FEF2F2}
        .spinner-ring{width:42px;height:42px;border:3px solid #E5E7EB;border-top-color:#2563EB;border-radius:50%;animation:spin .75s linear infinite;margin:0 auto 18px}
        @keyframes spin{to{transform:rotate(360deg)}}
        .status-title{font-family:'DM Serif Display',serif;font-size:1.4rem;color:#111827;letter-spacing:-.02em;margin-bottom:8px}
        .status-sub{font-size:.875rem;color:#6B7280;margin-bottom:24px}
        .btn-download{background:#059669;color:#fff;border:none;padding:13px 24px;font-family:'DM Sans',sans-serif;font-size:.875rem;font-weight:600;cursor:pointer;border-radius:8px;transition:all .15s;text-decoration:none;display:inline-flex;align-items:center;gap:8px;min-height:44px}
        .btn-download:hover{background:#047857}
        .btn-download:active{transform:scale(0.98)}
        .status-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}

        .hint{margin-top:8px;font-size:.75rem;font-weight:500}

        .app-footer{border-top:1px solid #E8EAF0;background:#fff;padding:14px 20px;text-align:center;font-size:.75rem;color:#C4C9D4}

        /* ── Tablet & Desktop breakpoints ── */
        @media(min-width:540px){
          .type-grid{grid-template-columns:repeat(2,1fr);gap:14px}
          .two-col{grid-template-columns:repeat(2,1fr)}
          .fields-grid{grid-template-columns:repeat(2,1fr)}
        }
        @media(min-width:900px){
          .main-content{padding:48px 40px 80px}
          .topnav{padding:0 40px;height:60px}
          .page-header h1{font-size:2.2rem}
          .type-grid{grid-template-columns:repeat(4,1fr);gap:16px}
          .type-card{padding:24px}
          .type-icon-wrap{width:42px;height:42px;font-size:1.3rem}
          .type-label{font-size:1rem}
          .type-arrow{display:block;position:absolute;right:20px;top:50%;transform:translateY(-50%);color:#D1D5DB;font-size:1.1rem}
          .type-card:hover .type-arrow{color:#2563EB;right:16px}
          .content-card{padding:32px}
          .card-subtitle{margin-left:50px}
          .format-section{padding:20px 24px}
          .fields-grid{grid-template-columns:repeat(3,1fr);gap:18px}
          .page-size-grid{grid-template-columns:repeat(5,1fr)}
          .align-grid{grid-template-columns:repeat(4,1fr)}
          .page-header{margin-bottom:40px}
        }
      `}</style>

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

        {/* Steps */}
        <div className="steps-bar">
          {[1,2,3].map((n,i) => (
            <div key={n} style={{display:'flex',alignItems:'center'}}>
              {i>0 && <div className={`step-connector ${step>n-1?'done-line':''}`}/>}
              <div className={`step-node ${step===n?'active':step>n?'done':''}`}>
                <div className="step-circle">{step>n?'✓':n}</div>
                {n===1?'Select Type':n===2?'Configure':'Format & Export'}
              </div>
            </div>
          ))}
        </div>

        {/* STEP 1 */}
        {step===1 && (
          <div>
            <p className="section-label">Choose document type</p>
            <div className="type-grid">
              {DOC_TYPES.map(t => (
                <div key={t.id} className="type-card" onClick={()=>handleTypeSelect(t.id)}>
                  <div className="type-card-top">
                    <div className="type-icon-wrap">{t.icon}</div>
                    <div className="type-label">{t.label}</div>
                  </div>
                  <div className="type-desc">{t.desc}</div>
                  <span className="type-arrow">→</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step===2 && currentType && (
          <div>
            <button className="back-btn" onClick={()=>setStep(1)}>← Back</button>
            <div className="content-card">
              <div className="content-card-header">
                <div className="card-icon-wrap">{currentType.icon}</div>
                <div className="card-title">{currentType.label} Options</div>
              </div>
              <div className="card-subtitle">Fill in what you need — all fields are optional</div>

              {/* 1. Font */}
              <div className="format-section blue">
                <div className="format-section-title">🔤 Font Style</div>
                <div className="two-col">
                  <div className="field-group">
                    <label className="field-label">Language <span className="optional-tag">Optional</span></label>
                    <select className="field-input" value={formData.font_script||''} onChange={e=>{handleFieldChange('font_script',e.target.value);handleFieldChange('font_style','');}}>
                      <option value="">Select language...</option>
                      <option value="english">English</option>
                      <option value="hindi">Hindi — KrutiDev / Unicode (हिन्दी)</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Font Family <span className="optional-tag">Optional</span></label>
                    <select className="field-input" value={formData.font_style||''} onChange={e=>handleFieldChange('font_style',e.target.value)} disabled={!formData.font_script}>
                      <option value="">{formData.font_script?'Select font...':'Select language first'}</option>
                      {fontList.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                </div>
                {formData.font_style && (
                  <div className="font-preview">
                    <span>Preview:</span>
                    <span style={{fontFamily:formData.font_style,fontSize:'.92rem',color:'#111827'}}>
                      {formData.font_script==='hindi'?'यह एक नमूना पाठ है। The quick brown fox.':'The quick brown fox jumps over the lazy dog.'}
                    </span>
                  </div>
                )}
              </div>

              {/* 2. Page Size */}
              <div className="format-section purple">
                <div className="format-section-title">📐 Page Size</div>
                <div className="page-size-grid">
                  {PAGE_SIZES.map(ps=>(
                    <div key={ps.value} className={`sel-card purple ${formData.page_size===ps.value?'selected':''}`} onClick={()=>handleFieldChange('page_size',ps.value)}>
                      <div className="sel-card-label">{ps.label}</div>
                      <div className="sel-card-desc">{ps.desc}</div>
                    </div>
                  ))}
                </div>
                <div className="hint">
                  <span style={{color:formData.page_size?'#7C3AED':'#9CA3AF',fontWeight:500}}>
                    {formData.page_size?`✓ Selected: ${formData.page_size}`:'Default: A4 will be used if none selected'}
                  </span>
                </div>
              </div>

              {/* 3. Page Numbers + Header/Footer */}
              <div className="format-section teal">
                <div className="format-section-title">📄 Page Numbers & Layout</div>

                <div className="toggle-row">
                  <div>
                    <div className="toggle-label">Auto Page Numbers</div>
                    <div className="toggle-sub">Automatically add page X of Y in footer</div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={!!formData.page_numbers} onChange={()=>handleToggle('page_numbers')} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {formData.page_numbers && (
                  <div style={{marginBottom:'16px'}}>
                    <div className="field-label" style={{marginBottom:'8px'}}>Page Number Position</div>
                    <div className="three-col">
                      {PAGE_NUM_POSITIONS.map(p=>(
                        <div key={p.value} className={`sel-card ${formData.page_number_position===p.value?'selected':''}`}
                          style={{borderColor:formData.page_number_position===p.value?'#0F766E':'#E5E7EB',background:formData.page_number_position===p.value?'#CCFBF1':'#fff'}}
                          onClick={()=>handleFieldChange('page_number_position',p.value)}>
                          <div className="sel-card-label" style={{color:formData.page_number_position===p.value?'#0F766E':'#111827'}}>{p.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{marginTop:'12px'}}>
                      <div className="field-label" style={{marginBottom:'6px'}}>Start Page Number <span className="optional-tag">Default: 1</span></div>
                      <input
                        className="field-input"
                        type="number"
                        min="1"
                        max="999"
                        placeholder="e.g. 1"
                        value={formData.start_page_number || ''}
                        onChange={e => handleFieldChange('start_page_number', e.target.value)}
                        style={{width:'120px'}}
                      />
                    </div>
                  </div>
                )}

                <div className="divider" style={{margin:'14px 0'}}/>

                <div className="two-col">
                  <div className="field-group">
                    <label className="field-label">Header Text <span className="optional-tag">Optional</span></label>
                    <input className="field-input" type="text" placeholder="e.g. Chapter title or Publisher" value={formData.header||''} onChange={e=>handleFieldChange('header',e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Footer Text <span className="optional-tag">Optional</span></label>
                    <input className="field-input" type="text" placeholder="e.g. © 2024 Publisher" value={formData.footer||''} onChange={e=>handleFieldChange('footer',e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Document details */}
              <p className="section-label" style={{marginTop:'8px'}}>Document details</p>
              <div className="fields-grid">
                {currentType.fields.filter(f=>f.key!=='header'&&f.key!=='footer').map(field=>(
                  <div className="field-group" key={field.key}>
                    <label className="field-label">{field.label} <span className="optional-tag">Optional</span></label>
                    <input className="field-input" type="text" placeholder={field.placeholder} value={formData[field.key]||''} onChange={e=>handleFieldChange(field.key,e.target.value)}/>
                  </div>
                ))}
              </div>

              <div className="divider"/>
              <div className="btn-row">
                <button className="btn-primary" onClick={()=>setStep(3)}>Continue to Upload →</button>
                <button className="btn-secondary" onClick={()=>setStep(1)}>Change Type</button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step===3 && status==='idle' && (
          <div>
            <button className="back-btn" onClick={()=>setStep(2)}>← Back to Options</button>
            <div className="content-card">
              <div className="content-card-header">
                <div className="card-icon-wrap">📁</div>
                <div className="card-title">Upload Your Document</div>
              </div>
              <div className="card-subtitle">Upload your .docx file — we'll apply all formatting preferences</div>

              {!file?(
                <div {...getRootProps()} className={`dropzone ${isDragActive?'active':''}`}>
                  <input {...getInputProps()}/>
                  <div className="dropzone-icon-wrap">📄</div>
                  <div className="dropzone-text">{isDragActive?'Drop your file here...':'Tap to select a .docx file'}</div>
                  <div className="dropzone-sub">or drag & drop here</div>
                </div>
              ):(
                <div className="file-selected">
                  <span style={{fontSize:'1.3rem'}}>📎</span>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{(file.size/1024).toFixed(1)} KB</span>
                  <button className="file-remove" onClick={()=>setFile(null)}>✕</button>
                </div>
              )}

              {Object.keys(formData).filter(k=>formData[k]!==undefined&&formData[k]!==''&&formData[k]!==false).length>0&&(
                <div className="config-summary">
                  <div className="config-summary-title">Configuration Summary</div>
                  {Object.entries(formData).filter(([,v])=>v!==undefined&&v!==''&&v!==false).map(([k,v])=>(
                    <div key={k} className="config-row">
                      <span className="config-key">{k.replace(/_/g,' ')}</span>
                      <span className="config-val">{v===true?'Yes':v}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="divider"/>
              <div className="btn-row">
                <button className="btn-primary" onClick={handleSubmit} disabled={!file}>Format Document</button>
                <button className="btn-secondary" onClick={handleReset}>Start Over</button>
              </div>
            </div>
          </div>
        )}

        {status==='uploading'&&(
          <div className="status-center">
            <div className="spinner-ring"/>
            <div className="status-title">Formatting your document…</div>
            <div className="status-sub">This may take a few seconds.</div>
          </div>
        )}

        {status==='done'&&(
          <div className="status-center">
            <div className="status-icon-wrap green">✅</div>
            <div className="status-title">Document Formatted</div>
            <div className="status-sub">Your document is ready to download.</div>
            <div className="status-btns">
              <a href={downloadUrl} download="formatted_document.docx" className="btn-download">⬇ Download File</a>
              <button className="btn-secondary" onClick={handleReset}>Format Another</button>
            </div>
          </div>
        )}

        {status==='error'&&(
          <div className="status-center">
            <div className="status-icon-wrap red">⚠️</div>
            <div className="status-title" style={{color:'#DC2626'}}>Formatting Failed</div>
            <div className="status-sub">Something went wrong. Please check your file and try again.</div>
            <div className="status-btns">
              <button className="btn-primary" onClick={()=>setStatus('idle')}>Try Again</button>
              <button className="btn-secondary" onClick={handleReset}>Start Over</button>
            </div>
          </div>
        )}

      </main>
      <footer className="app-footer">Publishing Format Studio · Professional document formatting</footer>
    </div>
  );
}

