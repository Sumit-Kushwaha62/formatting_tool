import { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { supabase } from './lib/supabaseClient'
import edwincover from './assets/edwin_inc_cover.jpeg';


// ─── Constants ───────────────────────────────────────────────
const DOC_TYPES = [
  {
    id: 'book', label: 'Book', icon: '📖', tag: 'Publishing',
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
    id: 'thesis', label: 'Thesis', icon: '🎓', tag: 'Academic',
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
    id: 'research', label: 'Research Paper', icon: '🔬', tag: 'Journal',
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
    id: 'letter', label: 'Letter / Notice', icon: '✉️', tag: 'Official',
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
  { value: 'Calibri', label: 'Calibri' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Garamond', label: 'Garamond' },
  { value: 'Cambria', label: 'Cambria' },
  { value: 'Bookman Old Style', label: 'Bookman Old Style' },
];

const HINDI_FONTS = [
  { value: 'Krutidev010', label: 'KrutiDev 010' },
  { value: 'Mangal', label: 'Mangal' },
  { value: 'Kokila', label: 'Kokila' },
  { value: 'Utsaah', label: 'Utsaah' },
  { value: 'Aparajita', label: 'Aparajita' },
  { value: 'Nirmala UI', label: 'Nirmala UI' },
];

const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 22, 24];
const LINE_SPACINGS = [
  { label: 'Single (1.0)', value: 1.0 },
  { label: 'Normal (1.15)', value: 1.15 },
  { label: 'Wide (1.5)', value: 1.5 },
  { label: 'Double (2.0)', value: 2.0 },
];
const PAGE_SIZES = [
  { value: 'A4', label: 'A4', desc: '210×297mm' },
  { value: 'A5', label: 'A5', desc: '148×210mm' },
  { value: 'A3', label: 'A3', desc: '297×420mm' },
  { value: 'Letter', label: 'Letter', desc: '216×279mm' },
  { value: 'Legal', label: 'Legal', desc: '216×356mm' },
];
const PAGE_NUM_POSITIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const PRICING_PLANS = [
  {
    id: 'free',
    name: 'Scholar',
    price: '₹0',
    period: 'forever',
    desc: 'For students & occasional use',
    features: ['3 documents/month', 'Book & Thesis formatting', 'Standard fonts', 'A4 / Letter page sizes', 'Email support'],
    cta: 'Start Free',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Professional',
    price: '₹199',
    period: '/month',
    desc: 'For researchers & publishers',
    features: ['Unlimited documents', 'All 4 document types', 'Hindi & English fonts', 'All page sizes & margins', 'Priority support', 'Batch formatting', 'Custom headers & footers'],
    cta: 'Start 14-day Trial',
    highlight: true,
  },
  {
    id: 'team',
    name: 'Institution',
    price: '₹999',
    period: '/month',
    desc: 'For universities & publishers',
    features: ['Everything in Pro', 'Up to 10 users', 'Dedicated account manager', 'Custom formatting templates', 'API access', 'Invoice & GST billing', 'SLA guarantee'],
    cta: 'Contact Sales',
    highlight: false,
  },
];

const FEATURES = [
  { icon: '📐', title: 'Precision Formatting', desc: 'Pixel-perfect margins, spacing & typography following international academic standards.' },
  { icon: '🌐', title: 'Hindi & English', desc: 'Full support for KrutiDev, Mangal, Times New Roman and all major publishing fonts.' },
  { icon: '🎓', title: 'University Standards', desc: 'Pre-configured for IIT, DU, BHU & other Indian university thesis submission guidelines.' },
  { icon: '⚡', title: 'Instant Processing', desc: 'No AI, no queue. Direct rule-based formatting engine delivers results in seconds.' },
  { icon: '🔒', title: 'Secure & Private', desc: 'Files processed and immediately deleted. Zero retention. Your data stays yours.' },
  { icon: '📄', title: 'All Document Types', desc: 'Books, theses, research papers, official letters & government notices — one platform.' },
];

// ─── UserDashboard Component ──────────────────────────────────
// function UserDashboard({ user, navTo, openModal }) {
//   const [dashTab, setDashTab] = useState('overview');
//   const [profileForm, setProfileForm] = useState({ name: user?.name || '', email: user?.email || '', phone: '', org: '' });
//   const [profileSaved, setProfileSaved] = useState(false);
//    const [realDocs, setRealDocs] = useState([]);
//   const [realPlan, setRealPlan] = useState('free');




// const mockPlan = { name: 'Professional', price: '₹199/mo', renew: '8 June 2026', docsUsed: 7 };

// const mockPlan = { name: realPlan === 'free' ? 'Scholar' : 'Professional', price: '₹199/mo', renew: '8 June 2026', docsUsed: realDocs.length };

//   const mockActivity = [
//     { icon: '📖', name: 'Book — The Art of Science', meta: '3 May 2026 · 142 pages', status: 'done' },
//     { icon: '🎓', name: 'Thesis — Impact of AI on Education', meta: '1 May 2026 · 87 pages', status: 'done' },
//     { icon: '🔬', name: 'Research Paper — Climate Model', meta: '28 Apr 2026 · 24 pages', status: 'done' },
//     { icon: '✉️', name: 'Letter — Ministry Notice', meta: '25 Apr 2026 · 4 pages', status: 'fail' },
//     { icon: '📖', name: 'Book — Hindi Grammar Guide', meta: '20 Apr 2026 · 211 pages', status: 'done' },
//   ];
//   const saveProfile = () => { setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2500); };


// ───----- UserDashboard Component ──────────────────────────────────
function UserDashboard({ user, navTo, openModal }) {
  const [realDocs, setRealDocs] = useState([]);
  const [realPlan, setRealPlan] = useState('free');

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setRealDocs(data);
      });
    supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setRealPlan(data.plan);
      });
  }, [user]);

  const [dashTab, setDashTab] = useState('overview');
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', email: user?.email || '', phone: '', org: '' });
  const [profileSaved, setProfileSaved] = useState(false);

  const mockPlan = { name: realPlan === 'free' ? 'Scholar' : 'Professional', price: '₹199/mo', renew: '8 June 2026', docsUsed: realDocs.length };
  const mockActivity = [
    { icon: '📖', name: 'Book — The Art of Science', meta: '3 May 2026 · 142 pages', status: 'done' },
    { icon: '🎓', name: 'Thesis — Impact of AI on Education', meta: '1 May 2026 · 87 pages', status: 'done' },
    { icon: '🔬', name: 'Research Paper — Climate Model', meta: '28 Apr 2026 · 24 pages', status: 'done' },
    { icon: '✉️', name: 'Letter — Ministry Notice', meta: '25 Apr 2026 · 4 pages', status: 'fail' },
    { icon: '📖', name: 'Book — Hindi Grammar Guide', meta: '20 Apr 2026 · 211 pages', status: 'done' },
  ];
  const saveProfile = () => { setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2500); };




  if (!user) return (
    <div style={{ textAlign: 'center', padding: '160px 20px' }}>
      <div style={{ fontFamily: "'EB Garamond', serif", fontSize: 28, color: 'var(--navy)', marginBottom: 12 }}>Login required</div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: 'var(--text3)', marginBottom: 24 }}>Sign in to access your dashboard.</div>
      <button className="btn-primary" onClick={() => openModal('login')}>Sign In →</button>
    </div>
  );

  const navItems = [
    { id: 'overview', icon: '◈', label: 'Overview' },
    { id: 'activity', icon: '⟳', label: 'Activity' },
    { id: 'subscription', icon: '✦', label: 'Subscription' },
    { id: 'profile', icon: '◯', label: 'Profile' },
  ];

  return (
    <div className="dash-shell">
      {/* Sidebar */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-user">
          <div className="dash-sidebar-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div className="dash-sidebar-name">{user.name}</div>
          <div className="dash-sidebar-email">{user.email}</div>
        </div>
        <nav className="dash-sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`dash-sidebar-item ${dashTab === item.id ? 'active' : ''}`}
              onClick={() => setDashTab(item.id)}
            >
              <span className="item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <button className="dash-sidebar-item" onClick={() => navTo('tool')} style={{ marginTop: 8 }}>
            <span className="item-icon">→</span>
            Format Document
          </button>
        </nav>
        <div className="dash-sidebar-footer">
          <div style={{ padding: '0 2px' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Current Plan</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{mockPlan.name}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--gold)', marginTop: 2 }}>{mockPlan.price}</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="dash-content">
        {dashTab === 'overview' && (
          <>
            <div className="dash-page-title">Welcome back, <span>{user.name}</span></div>
            <div className="dash-page-sub">Here is your account overview for this month.</div>
            <div className="plan-banner">
              <div>
                <div className="plan-badge-lrg">✦ Current Plan</div>
                <div className="plan-name-lrg">{mockPlan.name} — {mockPlan.price}</div>
                <div className="plan-renew">Renews on {mockPlan.renew}</div>
              </div>
              <div className="plan-actions">
                <button className="btn-plan-upgrade" onClick={() => navTo('pricing')}>Upgrade Plan</button>
                <button className="btn-plan-cancel">Cancel</button>
              </div>
            </div>
            <div className="dash-grid">
              <div className="dash-stat-card">
                <div className="dash-stat-label">Documents This Month</div>
                <div className="dash-stat-val">{mockPlan.docsUsed}</div>
                <div className="dash-stat-sub">Unlimited on Pro plan</div>
              </div>
              <div className="dash-stat-card">
                <div className="dash-stat-label">Member Since</div>
                <div className="dash-stat-val" style={{ fontSize: 22, marginTop: 6 }}>April 2026</div>
                <div className="dash-stat-sub">Active subscription</div>
              </div>
            </div>
            <div className="dash-section-title">Recent Activity</div>



            <div className="activity-list">
              {/* {mockActivity.slice(0, 3).map((a, i) => ( */}

{(realDocs.length > 0 ? realDocs.slice(0, 3).map(doc => ({
  icon: doc.doc_type === 'book' ? '📖' : doc.doc_type === 'thesis' ? '🎓' : doc.doc_type === 'research' ? '🔬' : '✉️',
  name: `${doc.doc_type.charAt(0).toUpperCase() + doc.doc_type.slice(1)} — ${doc.file_name}`,
  meta: new Date(doc.created_at).toLocaleDateString('en-IN'),
  status: doc.status,
})) : mockActivity.slice(0, 3)).map((a, i) => (





                <div className="activity-row" key={i}>
                  <div className="activity-icon">{a.icon}</div>
                  <div>
                    <div className="activity-name">{a.name}</div>
                    <div className="activity-meta">{a.meta}</div>
                  </div>






                  <div className="activity-spacer" />
                  <span className={`activity-badge ${a.status === 'done' ? 'badge-done' : 'badge-fail'}`}>
                    {a.status === 'done' ? 'Success' : 'Failed'}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setDashTab('activity')}>View all activity →</button>
            </div>
          </>
        )}

        {dashTab === 'activity' && (
          <>
            <div className="dash-page-title">Activity</div>
            <div className="dash-page-sub">Your complete document formatting history.</div>
            <div className="activity-list">
              {mockActivity.map((a, i) => (
                <div className="activity-row" key={i}>
                  <div className="activity-icon">{a.icon}</div>
                  <div>
                    <div className="activity-name">{a.name}</div>
                    <div className="activity-meta">{a.meta}</div>
                  </div>
                  <div className="activity-spacer" />
                  <span className={`activity-badge ${a.status === 'done' ? 'badge-done' : 'badge-fail'}`}>
                    {a.status === 'done' ? 'Success' : 'Failed'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {dashTab === 'subscription' && (
          <>
            <div className="dash-page-title">Subscription</div>
            <div className="dash-page-sub">Manage your plan and billing.</div>
            <div className="plan-banner" style={{ marginBottom: 20 }}>
              <div>
                <div className="plan-badge-lrg">✦ Active Plan</div>
                <div className="plan-name-lrg">{mockPlan.name}</div>
                <div className="plan-renew">Next billing: {mockPlan.renew} · {mockPlan.price}</div>
              </div>
              <div className="plan-actions">
                <button className="btn-plan-upgrade" onClick={() => navTo('pricing')}>Change Plan</button>
                <button className="btn-plan-cancel">Cancel Subscription</button>
              </div>
            </div>
            <div className="dash-section-title">Usage This Month</div>
            <div className="profile-form" style={{ marginBottom: 16 }}>
              <div className="usage-bar-wrap">
                <div className="usage-bar-top">
                  <span className="usage-bar-label">Documents Formatted</span>
                  <span className="usage-bar-count">{mockPlan.docsUsed} / Unlimited</span>
                </div>
                <div className="usage-bar-track"><div className="usage-bar-fill" style={{ width: '23%' }} /></div>
              </div>
              <div className="usage-bar-wrap">
                <div className="usage-bar-top">
                  <span className="usage-bar-label">Storage Used</span>
                  <span className="usage-bar-count">12 MB / 500 MB</span>
                </div>
                <div className="usage-bar-track"><div className="usage-bar-fill" style={{ width: '2.4%' }} /></div>
              </div>
            </div>
            <div className="dash-section-title">Billing History</div>
            <div className="activity-list">
              {[
                { date: '8 May 2026', amount: '₹199' },
                { date: '8 Apr 2026', amount: '₹199' },
                { date: '8 Mar 2026', amount: '₹199' },
              ].map((b, i) => (
                <div className="activity-row" key={i}>
                  <div className="activity-icon">🧾</div>
                  <div>
                    <div className="activity-name">Professional Plan</div>
                    <div className="activity-meta">{b.date}</div>
                  </div>
                  <div className="activity-spacer" />
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: 'var(--navy)', fontWeight: 600 }}>{b.amount}</span>
                  <span className="activity-badge badge-done" style={{ marginLeft: 10 }}>Paid</span>
                </div>
              ))}
            </div>
          </>
        )}

        {dashTab === 'profile' && (
          <>
            <div className="dash-page-title">Profile</div>
            <div className="dash-page-sub">Manage your account information and security.</div>
            <div className="dash-section-title">Profile Information</div>
            <div className="profile-form">
              <div className="profile-avatar">{user.name.charAt(0).toUpperCase()}</div>
              <div className="profile-grid">
                {[
                  { key: 'name', label: 'Full Name', placeholder: 'Your name', type: 'text' },
                  { key: 'email', label: 'Email Address', placeholder: 'you@example.com', type: 'email' },
                  { key: 'phone', label: 'Phone Number', placeholder: '+91 00000 00000', type: 'text' },
                  { key: 'org', label: 'Organization / University', placeholder: 'e.g. IIT Delhi', type: 'text' },
                ].map(f => (
                  <div className="field-group" key={f.key}>
                    <label className="field-label">{f.label}</label>
                    <input className="field-input" type={f.type} placeholder={f.placeholder}
                      value={profileForm[f.key]} onChange={e => setProfileForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="divider" />
              <div className="btn-row">
                <button className="btn-primary" onClick={saveProfile}>{profileSaved ? '✓ Saved' : 'Save Changes'}</button>
              </div>
            </div>
            <div className="dash-section-title" style={{ marginTop: 24 }}>Security</div>
            <div className="profile-form" style={{ marginBottom: 0 }}>
              <div className="field-group" style={{ maxWidth: 360 }}>
                <label className="field-label">New Password</label>
                <input className="field-input" type="password" placeholder="Min. 8 characters" />
              </div>
              <div style={{ marginTop: 16 }}><button className="btn-secondary">Update Password</button></div>
            </div>
            <div className="danger-zone">
              <div className="danger-title">Danger Zone</div>
              <div className="danger-desc">Permanently delete your account and all associated data. This action cannot be undone.</div>
              <button className="btn-danger">Delete Account</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState('home'); // 'home' | 'tool' | 'pricing'
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [formData, setFormData] = useState({});
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [modal, setModal] = useState(null);
  const [user, setUser] = useState(null);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);


useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      setUser({
        name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
        email: session.user.email,
        id: session.user.id,
      });
    }
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      setUser({
        name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
        email: session.user.email,
        id: session.user.id,
      });
    } else {
      setUser(null);
    }
  });

  return () => subscription.unsubscribe();
}, []);


  const openModal = (m) => { setModal(m); setAuthError(''); setAuthForm({ name: '', email: '', password: '' }); };
  const closeModal = () => setModal(null);

  // const handleLogin = () => {
  //   if (!authForm.email || !authForm.password) { setAuthError('Email aur password required hai.'); return; }
  //   setUser({ name: authForm.email.split('@')[0], email: authForm.email });
  //   closeModal();
  //   setPage('dashboard');
  // };





const handleLogin = async () => {
  if (!authForm.email || !authForm.password) {
    setAuthError('Email aur password required hai.');
    return;
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: authForm.email,
    password: authForm.password,
  });
  if (error) { setAuthError(error.message); return; }
  setUser({ name: data.user.email.split('@')[0], email: data.user.email, id: data.user.id });
  closeModal();
  setPage('dashboard');
};






  // const handleSignup = () => {
  //   if (!authForm.name || !authForm.email || !authForm.password) { setAuthError('All fields required.'); return; }
  //   setUser({ name: authForm.name, email: authForm.email });
  //   closeModal();
  //   setPage('dashboard');
  // };



const handleSignup = async () => {
  if (!authForm.name || !authForm.email || !authForm.password) {
    setAuthError('All fields required.');
    return;
  }
  const { data, error } = await supabase.auth.signUp({
    email: authForm.email,
    password: authForm.password,
    options: { data: { full_name: authForm.name } }
  });
  if (error) { setAuthError(error.message); return; }
  setUser({ name: authForm.name, email: authForm.email, id: data.user.id });
  closeModal();
  setPage('dashboard');
};




  // const handleLogout = () => { setUser(null); setPage('home'); };


const handleLogout = async () => {
  await supabase.auth.signOut();
  setUser(null);
  setPage('home');
};

// const handleGoogleLogin = async () => {
//   const { error } = await supabase.auth.signInWithOAuth({
//     provider: 'google',
//     options: {
//       redirectTo: window.location.origin
//     }
//   });
//   if (error) setAuthError(error.message);
// };



const handleGoogleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: import.meta.env.VITE_SITE_URL || window.location.origin
    }
  });
  if (error) setAuthError(error.message);
};




  const currentType = DOC_TYPES.find(t => t.id === selectedType);
  const fontList = formData.font_script === 'hindi' ? HINDI_FONTS : formData.font_script === 'english' ? ENGLISH_FONTS : [];

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
    if (user?.id) fd.append('userId', user.id);
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

  const navTo = (p) => { setPage(p); setMenuOpen(false); window.scrollTo(0, 0); };

  return (
    <div style={{ fontFamily: "'EB Garamond', 'Libre Baskerville', Georgia, serif", minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

        :root {
          --bg: #F7F4EF;
          --bg2: #EDE8DF;
          --bg3: #E3DDD2;
          --surface: #FDFCFA;
          --navy: #1A2744;
          --navy2: #243257;
          --navy3: #2E3E6E;
          --gold: #B8922A;
          --gold2: #D4A843;
          --gold-light: #F5EDD8;
          --text: #1A2744;
          --text2: #4A5568;
          --text3: #718096;
          --border: rgba(26,39,68,0.12);
          --border2: rgba(26,39,68,0.2);
          --red: #C0392B;
          --green: #1A6B3C;
          --r-sm: 4px;
          --r-md: 8px;
          --r-lg: 14px;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: var(--bg); }

        /* ── Nav ── */
        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 200;
          height: 60px;
          display: flex; align-items: center;
          padding: 0 40px;
          transition: background .3s, box-shadow .3s, border-color .3s;
          border-bottom: 1px solid transparent;
        }
        .nav.scrolled {
          background: rgba(247,244,239,0.96);
          backdrop-filter: blur(12px);
          border-color: var(--border);
          box-shadow: 0 1px 0 var(--border);
        }
        .nav-logo {
          display: flex; align-items: center; gap: 10px; cursor: pointer;
          text-decoration: none;
        }
        .nav-logo-mark {
          width: 32px; height: 32px;
          background: var(--navy);
          display: flex; align-items: center; justify-content: center;
          font-family: 'EB Garamond', serif;
          font-size: 16px; font-weight: 700;
          color: var(--gold2);
          letter-spacing: 0;
          flex-shrink: 0;
        }
        .nav-logo-text {
          font-family: 'EB Garamond', serif;
          font-size: 17px; font-weight: 600;
          color: var(--navy); letter-spacing: 0.01em;
          line-height: 1;
        }
        .nav-logo-sub {
          font-family: 'DM Sans', sans-serif;
          font-size: 9px; font-weight: 500;
          color: var(--gold); letter-spacing: 0.15em;
          text-transform: uppercase; margin-top: 1px;
        }
        .nav-spacer { flex: 1; }
        .nav-links {
          display: flex; align-items: center; gap: 6px;
        }
        .nav-link {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 500;
          color: var(--text2); padding: 6px 14px;
          border-radius: var(--r-sm);
          cursor: pointer; border: none; background: none;
          transition: color .15s, background .15s;
          letter-spacing: 0.01em;
        }
        .nav-link:hover { color: var(--navy); background: var(--bg2); }
        .nav-link.active { color: var(--navy); }
        .nav-divider { width: 1px; height: 18px; background: var(--border2); margin: 0 4px; }
        .nav-btn-ghost {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 500;
          color: var(--navy); padding: 6px 16px;
          border: 1.5px solid var(--border2);
          border-radius: var(--r-sm);
          cursor: pointer; background: none;
          transition: all .15s; letter-spacing: 0.01em;
        }
        .nav-btn-ghost:hover { border-color: var(--navy); background: var(--bg2); }
        .nav-btn-solid {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 500;
          color: var(--bg); padding: 7px 18px;
          border: none; border-radius: var(--r-sm);
          background: var(--navy);
          cursor: pointer; transition: all .15s;
          letter-spacing: 0.01em;
        }
        .nav-btn-solid:hover { background: var(--navy3); }
        .nav-user-dot {
          width: 30px; height: 30px;
          background: var(--navy); border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; font-weight: 600; color: var(--gold2);
        }
        .nav-logout {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; font-weight: 500;
          color: var(--text3); padding: 5px 10px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm); background: none;
          cursor: pointer; transition: all .15s;
        }
        .nav-logout:hover { color: var(--red); border-color: var(--red); }

        /* Hamburger */
        .hamburger { display: none; }

        /* ── Hero ── */
        .hero {
          min-height: 100vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 120px 40px 80px;
          position: relative; overflow: hidden;
          text-align: center;
        }
        .hero-bg {
          position: absolute; inset: 0; z-index: 0;
          background:
            repeating-linear-gradient(0deg, transparent, transparent 39px, var(--border) 39px, var(--border) 40px),
            repeating-linear-gradient(90deg, transparent, transparent 39px, var(--border) 39px, var(--border) 40px);
          opacity: 0.4;
        }
        .hero-bg-gradient {
          position: absolute; inset: 0; z-index: 1;
          background: radial-gradient(ellipse 80% 60% at 50% 30%, rgba(247,244,239,0) 0%, var(--bg) 70%);
        }
        .hero-content { position: relative; z-index: 2; max-width: 760px; }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: 'DM Mono', monospace;
          font-size: 11px; font-weight: 500;
          color: var(--gold); letter-spacing: 0.12em;
          text-transform: uppercase;
          border: 1px solid rgba(184,146,42,0.35);
          padding: 5px 14px; border-radius: 2px;
          margin-bottom: 32px;
          background: rgba(184,146,42,0.06);
          animation: fadeUp .6s ease both;
        }
        .hero-badge-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--gold2); }
        .hero-title {
          font-family: 'EB Garamond', serif;
          font-size: clamp(40px, 7vw, 72px);
          font-weight: 500; line-height: 1.08;
          color: var(--navy); letter-spacing: -0.02em;
          margin-bottom: 20px;
          animation: fadeUp .6s .1s ease both;
        }
        .hero-title em { font-style: italic; color: var(--gold); }
        .hero-subtitle {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(15px, 2vw, 18px);
          font-weight: 400; color: var(--text2);
          line-height: 1.65; max-width: 560px; margin: 0 auto 40px;
          animation: fadeUp .6s .2s ease both;
        }
        .hero-actions {
          display: flex; align-items: center; gap: 14px;
          justify-content: center; flex-wrap: wrap;
          animation: fadeUp .6s .3s ease both;
        }
        .btn-primary {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 500;
          color: var(--bg); padding: 12px 28px;
          background: var(--navy); border: none;
          border-radius: var(--r-sm); cursor: pointer;
          transition: all .2s; letter-spacing: 0.01em;
          display: inline-flex; align-items: center; gap: 8px;
        }
        .btn-primary:hover { background: var(--navy3); transform: translateY(-1px); }
        .btn-secondary {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 500;
          color: var(--navy); padding: 11px 24px;
          background: none;
          border: 1.5px solid var(--border2); border-radius: var(--r-sm);
          cursor: pointer; transition: all .2s; letter-spacing: 0.01em;
        }
        .btn-secondary:hover { border-color: var(--navy); background: var(--bg2); }
        .hero-stats {
          display: flex; gap: 48px; justify-content: center;
          margin-top: 64px; padding-top: 40px;
          border-top: 1px solid var(--border);
          animation: fadeUp .6s .4s ease both;
        }
        .hero-stat-num {
          font-family: 'EB Garamond', serif;
          font-size: 28px; font-weight: 600; color: var(--navy);
        }
        .hero-stat-label {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; color: var(--text3); margin-top: 2px;
          letter-spacing: 0.04em;
        }

        /* ── Section common ── */
        .section { padding: 96px 40px; }
        .section-inner { max-width: 1080px; margin: 0 auto; }
        .section-label {
          font-family: 'DM Mono', monospace;
          font-size: 11px; font-weight: 500;
          color: var(--gold); letter-spacing: 0.14em;
          text-transform: uppercase; margin-bottom: 14px;
          display: flex; align-items: center; gap: 10px;
        }
        .section-label::before {
          content: ''; display: block;
          width: 24px; height: 1px; background: var(--gold);
        }
        .section-title {
          font-family: 'EB Garamond', serif;
          font-size: clamp(30px, 4vw, 44px);
          font-weight: 500; color: var(--navy);
          letter-spacing: -0.02em; line-height: 1.12;
          margin-bottom: 14px;
        }
        .section-title em { font-style: italic; color: var(--gold); }
        .section-desc {
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; color: var(--text2); line-height: 1.7;
          max-width: 520px;
        }

        /* ── Features ── */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px; margin-top: 56px;
          border: 1px solid var(--border); border-radius: var(--r-md);
          overflow: hidden;
        }
        .feature-card {
          background: var(--surface);
          padding: 32px 28px;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          transition: background .2s;
        }
        .feature-card:hover { background: var(--bg2); }
        .feature-icon {
          font-size: 22px; margin-bottom: 16px;
          width: 44px; height: 44px;
          display: flex; align-items: center; justify-content: center;
          background: var(--bg2); border-radius: var(--r-sm);
          border: 1px solid var(--border);
        }
        .feature-title {
          font-family: 'EB Garamond', serif;
          font-size: 18px; font-weight: 600;
          color: var(--navy); margin-bottom: 10px;
        }
        .feature-desc {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: var(--text2); line-height: 1.65;
        }

        /* ── Doc types showcase ── */
        .doc-types-row {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 16px; margin-top: 56px;
        }
        .doc-type-card {
          border: 1.5px solid var(--border);
          border-radius: var(--r-md);
          padding: 24px 20px;
          cursor: pointer;
          background: var(--surface);
          transition: all .2s;
          position: relative; overflow: hidden;
        }
        .doc-type-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: var(--navy); transform: scaleX(0);
          transition: transform .2s; transform-origin: left;
        }
        .doc-type-card:hover::before { transform: scaleX(1); }
        .doc-type-card:hover { border-color: var(--navy2); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(26,39,68,0.1); }
        .doc-type-tag {
          font-family: 'DM Mono', monospace;
          font-size: 10px; font-weight: 500;
          color: var(--gold); letter-spacing: 0.1em;
          text-transform: uppercase; margin-bottom: 16px;
        }
        .doc-type-icon { font-size: 26px; margin-bottom: 12px; }
        .doc-type-name {
          font-family: 'EB Garamond', serif;
          font-size: 19px; font-weight: 600;
          color: var(--navy); margin-bottom: 8px;
        }
        .doc-type-desc {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; color: var(--text2); line-height: 1.6;
        }

        /* ── Pricing ── */
        .pricing-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 24px; margin-top: 56px; align-items: start;
        }
        .pricing-card {
          border: 1.5px solid var(--border);
          border-radius: var(--r-lg);
          padding: 32px 28px;
          background: var(--surface);
          position: relative; transition: all .2s;
        }
        .pricing-card:hover { box-shadow: 0 8px 32px rgba(26,39,68,0.1); }
        .pricing-card.highlight {
          border-color: var(--navy);
          background: var(--navy);
          color: var(--bg);
        }
        .pricing-card.highlight:hover { box-shadow: 0 12px 40px rgba(26,39,68,0.3); }
        .pricing-badge {
          display: inline-block;
          font-family: 'DM Mono', monospace;
          font-size: 10px; font-weight: 500;
          letter-spacing: 0.12em; text-transform: uppercase;
          padding: 3px 10px; border-radius: 2px;
          margin-bottom: 20px;
          background: var(--gold-light); color: var(--gold);
          border: 1px solid rgba(184,146,42,0.3);
        }
        .pricing-card.highlight .pricing-badge {
          background: rgba(212,168,67,0.2); color: var(--gold2);
          border-color: rgba(212,168,67,0.4);
        }
        .pricing-name {
          font-family: 'EB Garamond', serif;
          font-size: 22px; font-weight: 600; margin-bottom: 6px;
        }
        .pricing-desc {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: var(--text2); margin-bottom: 24px; line-height: 1.5;
        }
        .pricing-card.highlight .pricing-desc { color: rgba(247,244,239,0.65); }
        .pricing-price {
          font-family: 'EB Garamond', serif;
          font-size: 42px; font-weight: 500; line-height: 1;
          margin-bottom: 4px; letter-spacing: -0.02em;
        }
        .pricing-period {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: var(--text3); margin-bottom: 28px;
        }
        .pricing-card.highlight .pricing-period { color: rgba(247,244,239,0.5); }
        .pricing-divider {
          height: 1px; background: var(--border); margin-bottom: 24px;
        }
        .pricing-card.highlight .pricing-divider { background: rgba(247,244,239,0.15); }
        .pricing-features {
          list-style: none; margin-bottom: 32px;
        }
        .pricing-feature {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; padding: 7px 0;
          display: flex; align-items: flex-start; gap: 10px;
          border-bottom: 1px solid var(--border);
          line-height: 1.5;
        }
        .pricing-card.highlight .pricing-feature { border-color: rgba(247,244,239,0.1); }
        .pricing-feature-check { color: var(--green); font-size: 13px; flex-shrink: 0; margin-top: 1px; }
        .pricing-card.highlight .pricing-feature-check { color: var(--gold2); }
        .pricing-cta {
          width: 100%;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 500;
          padding: 12px 20px; border-radius: var(--r-sm);
          cursor: pointer; transition: all .2s;
          letter-spacing: 0.01em;
        }
        .pricing-cta-ghost {
          background: none; color: var(--navy);
          border: 1.5px solid var(--border2);
        }
        .pricing-cta-ghost:hover { border-color: var(--navy); background: var(--bg2); }
        .pricing-cta-solid {
          background: var(--gold); color: var(--navy);
          border: none; font-weight: 600;
        }
        .pricing-cta-solid:hover { background: var(--gold2); }

        /* ── Testimonials / Trust ── */
        .trust-bar {
          padding: 40px; background: var(--navy);
          display: flex; align-items: center; justify-content: center;
          gap: 64px; flex-wrap: wrap;
        }
        .trust-item {
          font-family: 'EB Garamond', serif;
          font-size: 17px; font-weight: 400; font-style: italic;
          color: rgba(247,244,239,0.7);
          letter-spacing: 0.01em;
        }
        .trust-divider { width: 1px; height: 24px; background: rgba(247,244,239,0.2); }

        /* ── CTA Strip ── */
        .cta-strip {
          padding: 96px 40px;
          background: var(--navy);
          text-align: center;
          position: relative; overflow: hidden;
        }
        .cta-strip-bg {
          position: absolute; inset: 0;
          background:
            repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.03) 39px, rgba(255,255,255,0.03) 40px),
            repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.03) 39px, rgba(255,255,255,0.03) 40px);
        }
        .cta-content { position: relative; z-index: 1; }
        .cta-title {
          font-family: 'EB Garamond', serif;
          font-size: clamp(32px, 5vw, 52px);
          font-weight: 500; color: var(--bg);
          margin-bottom: 16px; letter-spacing: -0.02em;
        }
        .cta-title em { font-style: italic; color: var(--gold2); }
        .cta-sub {
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; color: rgba(247,244,239,0.65);
          margin-bottom: 36px; max-width: 480px; margin-left: auto; margin-right: auto;
          line-height: 1.6;
        }
        .btn-gold {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 600;
          color: var(--navy); padding: 13px 32px;
          background: var(--gold2); border: none;
          border-radius: var(--r-sm); cursor: pointer;
          transition: all .2s; letter-spacing: 0.01em;
        }
        .btn-gold:hover { background: #E8BC50; transform: translateY(-1px); }

        /* ── Footer ── */
        .footer {
          background: var(--navy);
          border-top: 1px solid rgba(247,244,239,0.1);
          padding: 64px 40px 32px;
        }
        .footer-inner {
          max-width: 1080px; margin: 0 auto;
        }
        .footer-top {
          display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr;
          gap: 48px; margin-bottom: 48px;
        }
        .footer-brand-name {
          font-family: 'EB Garamond', serif;
          font-size: 20px; font-weight: 600; color: var(--bg);
          margin-bottom: 4px;
        }
        .footer-brand-tag {
          font-family: 'DM Mono', monospace;
          font-size: 9px; color: var(--gold);
          letter-spacing: 0.14em; text-transform: uppercase;
          margin-bottom: 14px;
        }
        .footer-brand-desc {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: rgba(247,244,239,0.5);
          line-height: 1.7; max-width: 240px;
        }
        .footer-col-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px; font-weight: 600;
          color: rgba(247,244,239,0.5); letter-spacing: 0.1em;
          text-transform: uppercase; margin-bottom: 16px;
        }
        .footer-links { list-style: none; }
        .footer-link {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: rgba(247,244,239,0.65);
          padding: 5px 0; cursor: pointer; transition: color .15s;
        }
        .footer-link:hover { color: var(--gold2); }
        .footer-bottom {
          padding-top: 28px;
          border-top: 1px solid rgba(247,244,239,0.1);
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 12px;
        }
        .footer-copy {
          font-family: 'DM Mono', monospace;
          font-size: 11px; color: rgba(247,244,239,0.35);
          letter-spacing: 0.04em;
        }
        .footer-legal {
          display: flex; gap: 20px;
        }
        .footer-legal-link {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; color: rgba(247,244,239,0.4);
          cursor: pointer; transition: color .15s;
        }
        .footer-legal-link:hover { color: rgba(247,244,239,0.7); }

        /* ── Tool page ── */
        .tool-page { padding: 100px 40px 80px; max-width: 960px; margin: 0 auto; }
        .tool-header { margin-bottom: 40px; }
        .tool-title {
          font-family: 'EB Garamond', serif;
          font-size: 34px; font-weight: 500;
          color: var(--navy); letter-spacing: -0.02em;
          margin-bottom: 6px;
        }
        .tool-subtitle {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: var(--text2);
        }

        /* Steps */
        .steps-bar {
          display: flex; align-items: center;
          gap: 0; margin-bottom: 36px;
          background: var(--surface);
          border: 1px solid var(--border); border-radius: var(--r-sm);
          padding: 12px 20px;
        }
        .step-node {
          display: flex; align-items: center; gap: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: var(--text3);
          white-space: nowrap; transition: color .3s;
        }
        .step-node.active { color: var(--navy); }
        .step-node.done { color: var(--green); }
        .step-circle {
          width: 24px; height: 24px; border-radius: 50%;
          border: 1.5px solid var(--border2);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 600;
          background: var(--surface); flex-shrink: 0;
          transition: all .25s;
        }
        .step-node.active .step-circle { border-color: var(--navy); background: var(--navy); color: var(--bg); }
        .step-node.done .step-circle { border-color: var(--green); background: var(--green); color: #fff; }
        .step-connector { flex: 1; height: 1px; background: var(--border); margin: 0 12px; }
        .step-connector.done { background: var(--green); }

        /* Card */
        .card {
          background: var(--surface);
          border: 1px solid var(--border); border-radius: var(--r-lg);
          padding: 32px;
        }
        .card-title {
          font-family: 'EB Garamond', serif;
          font-size: 22px; font-weight: 600; color: var(--navy);
          margin-bottom: 4px;
        }
        .card-sub {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: var(--text3); margin-bottom: 28px;
        }

        /* Type grid */
        .type-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        .type-card {
          border: 1.5px solid var(--border); border-radius: var(--r-md);
          padding: 20px; cursor: pointer; background: var(--bg);
          transition: all .2s; position: relative;
        }
        .type-card::after {
          content: '→';
          position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
          color: var(--text3); font-size: 16px;
          transition: right .15s, color .15s;
        }
        .type-card:hover { border-color: var(--navy); background: var(--surface); }
        .type-card:hover::after { right: 12px; color: var(--navy); }
        .type-card-tag {
          font-family: 'DM Mono', monospace;
          font-size: 10px; color: var(--gold);
          letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 10px;
        }
        .type-card-icon { font-size: 24px; margin-bottom: 10px; }
        .type-card-name {
          font-family: 'EB Garamond', serif;
          font-size: 18px; font-weight: 600; color: var(--navy); margin-bottom: 6px;
        }
        .type-card-desc {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; color: var(--text2); line-height: 1.5;
          padding-right: 24px;
        }

        /* Form sections */
        .form-section {
          border: 1px solid var(--border); border-radius: var(--r-md);
          padding: 20px 22px; margin-bottom: 16px; background: var(--bg);
        }
        .form-section-title {
          font-family: 'DM Mono', monospace;
          font-size: 10px; font-weight: 500;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--text3); margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }
        .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .form-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .form-grid-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .field-group { display: flex; flex-direction: column; gap: 6px; }
        .field-label {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; font-weight: 500; color: var(--text2);
          display: flex; align-items: center; gap: 6px;
        }
        .field-opt { font-size: 11px; color: var(--text3); font-weight: 400; }
        .field-input {
          background: var(--surface); border: 1px solid var(--border2);
          border-radius: var(--r-sm); padding: 9px 12px;
          font-family: 'DM Sans', sans-serif; font-size: 14px;
          color: var(--text); outline: none; transition: border-color .15s;
          width: 100%;
        }
        .field-input:focus { border-color: var(--navy); }
        .field-input::placeholder { color: var(--text3); }
        select.field-input { cursor: pointer; }
        select.field-input:disabled { opacity: .4; cursor: not-allowed; }

        /* Sel cards */
        .sel-card {
          border: 1.5px solid var(--border); border-radius: var(--r-sm);
          padding: 10px 8px; cursor: pointer; text-align: center;
          background: var(--surface); transition: all .15s;
        }
        .sel-card:hover { border-color: var(--navy2); }
        .sel-card.selected { border-color: var(--navy); background: rgba(26,39,68,0.05); }
        .sel-card-label { font-family: 'EB Garamond', serif; font-size: 15px; font-weight: 600; color: var(--navy); }
        .sel-card-desc { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text3); margin-top: 2px; }
        .sel-card.selected .sel-card-label { color: var(--navy); }

        /* Toggle */
        .toggle-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 12px; }
        .toggle-label { font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; color: var(--text); }
        .toggle-sub { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text3); margin-top: 2px; }
        .toggle { position: relative; width: 40px; height: 22px; cursor: pointer; flex-shrink: 0; }
        .toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
        .toggle-slider { position: absolute; inset: 0; background: var(--border2); border-radius: 22px; transition: .2s; }
        .toggle-slider::before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: .2s; }
        .toggle input:checked + .toggle-slider { background: var(--navy); }
        .toggle input:checked + .toggle-slider::before { transform: translateX(18px); }

        /* Dropzone */
        .dropzone {
          border: 1.5px dashed var(--border2); border-radius: var(--r-md);
          padding: 48px 24px; text-align: center; cursor: pointer;
          background: var(--bg); transition: all .2s; margin-bottom: 20px;
        }
        .dropzone:hover, .dropzone.active { border-color: var(--navy); background: rgba(26,39,68,0.02); }
        .dropzone-icon { font-size: 32px; margin-bottom: 14px; }
        .dropzone-text { font-family: 'EB Garamond', serif; font-size: 18px; color: var(--navy); margin-bottom: 4px; }
        .dropzone-sub { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text3); }

        /* File selected */
        .file-selected {
          display: flex; align-items: center; gap: 10px;
          background: rgba(26,106,60,0.06); border: 1px solid rgba(26,106,60,0.25);
          border-radius: var(--r-sm); padding: 12px 14px; margin-bottom: 16px;
        }
        .file-name { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--green); flex: 1; word-break: break-all; }
        .file-size { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text3); white-space: nowrap; }
        .file-remove { background: none; border: none; color: var(--text3); cursor: pointer; font-size: 14px; padding: 4px; transition: color .15s; }
        .file-remove:hover { color: var(--red); }

        /* Config summary */
        .config-summary { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 14px 16px; margin-bottom: 16px; }
        .config-summary-title { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text3); margin-bottom: 10px; }
        .config-row { display: flex; gap: 8px; font-size: 12px; margin-bottom: 4px; }
        .config-key { font-family: 'DM Mono', monospace; color: var(--text3); min-width: 130px; text-transform: capitalize; flex-shrink: 0; }
        .config-val { font-family: 'DM Sans', sans-serif; color: var(--text); font-weight: 500; }

        /* Status */
        .status-center { text-align: center; padding: 80px 20px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); }
        .status-icon { font-size: 40px; margin-bottom: 20px; }
        .status-title { font-family: 'EB Garamond', serif; font-size: 28px; font-weight: 500; color: var(--navy); margin-bottom: 8px; }
        .status-sub { font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--text2); margin-bottom: 28px; }
        .spinner { width: 36px; height: 36px; border: 2px solid var(--border); border-top-color: var(--navy); border-radius: 50%; animation: spin .7s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn-download {
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
          color: #fff; padding: 12px 28px; border: none; border-radius: var(--r-sm);
          background: var(--green); cursor: pointer; transition: all .2s;
          text-decoration: none; display: inline-flex; align-items: center; gap: 8px;
        }
        .btn-download:hover { background: #155c32; transform: translateY(-1px); }

        /* Back btn */
        .back-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text2);
          background: none; border: 1px solid var(--border); border-radius: var(--r-sm);
          padding: 6px 14px; cursor: pointer; margin-bottom: 20px; transition: all .15s;
        }
        .back-btn:hover { color: var(--navy); border-color: var(--navy2); }
        .divider { height: 1px; background: var(--border); margin: 22px 0; }
        .btn-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .font-preview { margin-top: 10px; padding: 8px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-sm); font-size: 13px; color: var(--text2); }

        /* ── Modal ── */
        .modal-overlay {
          position: fixed; inset: 0; z-index: 500;
          background: rgba(26,39,68,0.5); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
          animation: fadeIn .15s ease;
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .modal-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 36px 32px;
          width: 100%; max-width: 400px;
          box-shadow: 0 24px 80px rgba(26,39,68,0.2);
          animation: slideUp .2s cubic-bezier(.34,1.56,.64,1);
          position: relative;
        }
        .modal-card.wide { max-width: 560px; max-height: 85vh; overflow-y: auto; }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .modal-close {
          position: absolute; top: 14px; right: 14px;
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--bg2); border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; color: var(--text3); transition: all .15s;
        }
        .modal-close:hover { background: rgba(192,57,43,0.1); color: var(--red); }
        .modal-title { font-family: 'EB Garamond', serif; font-size: 26px; font-weight: 600; color: var(--navy); margin-bottom: 4px; }
        .modal-sub { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text3); margin-bottom: 24px; }
        .modal-field { margin-bottom: 14px; }
        .modal-label { font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600; color: var(--text2); margin-bottom: 6px; display: block; letter-spacing: 0.06em; text-transform: uppercase; }
        .modal-input { width: 100%; padding: 10px 14px; border: 1.5px solid var(--border2); border-radius: var(--r-sm); font-family: 'DM Sans', sans-serif; font-size: 14px; background: var(--bg); color: var(--text); outline: none; transition: border-color .15s; }
        .modal-input:focus { border-color: var(--navy); }
        .modal-error { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--red); margin-bottom: 10px; }
        .modal-submit { width: 100%; padding: 12px; background: var(--navy); color: var(--bg); border: none; border-radius: var(--r-sm); font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; transition: all .15s; margin-top: 4px; }
        .modal-submit:hover { background: var(--navy3); }


.modal-google-btn {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid var(--border2);
  border-radius: var(--r-sm);
  background: var(--surface);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: var(--navy);
  transition: all .15s;
  margin-top: 4px;
}
.modal-google-btn:hover {
  border-color: var(--navy);
  background: var(--bg2);
}
.modal-divider {
  display: flex; align-items: center; gap: 12px;
  margin: 14px 0;
  font-family: 'DM Sans', sans-serif;
  font-size: 12px; color: var(--text3);
}
.modal-divider::before,
.modal-divider::after {
  content: ''; flex: 1;
  height: 1px; background: var(--border);
}



        .modal-switch { margin-top: 14px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text3); text-align: center; }
        .modal-switch button { background: none; border: none; color: var(--navy); font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; }
        .licence-section-title { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.12em; color: var(--gold); margin: 18px 0 8px; }
        .licence-text { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text2); line-height: 1.7; }

        /* ── Dashboard ── */
        .dash-shell { display: flex; min-height: 100vh; padding-top: 60px; background: var(--bg); }
        .dash-sidebar {
          width: 240px; flex-shrink: 0;
          background: var(--surface); border-right: 1px solid var(--border);
          padding: 32px 0; position: sticky; top: 60px; height: calc(100vh - 60px);
          overflow-y: auto; display: flex; flex-direction: column;
        }
        .dash-sidebar-user { padding: 0 20px 24px; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
        .dash-sidebar-avatar {
          width: 48px; height: 48px; border-radius: 50%;
          background: var(--navy); display: flex; align-items: center; justify-content: center;
          font-family: 'EB Garamond', serif; font-size: 22px; font-weight: 600;
          color: var(--gold2); margin-bottom: 10px;
          box-shadow: 0 0 0 3px rgba(184,146,42,0.2);
        }
        .dash-sidebar-name { font-family: 'EB Garamond', serif; font-size: 16px; font-weight: 600; color: var(--navy); }
        .dash-sidebar-email { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--text3); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dash-sidebar-nav { padding: 0 10px; flex: 1; }
        .dash-sidebar-item {
          display: flex; align-items: center; gap: 10px;
          font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
          color: var(--text2); padding: 9px 12px; border-radius: var(--r-sm);
          cursor: pointer; border: none; background: none; width: 100%; text-align: left;
          transition: all .15s; margin-bottom: 2px;
        }
        .dash-sidebar-item:hover { color: var(--navy); background: var(--bg2); }
        .dash-sidebar-item.active { color: var(--navy); background: var(--bg2); font-weight: 600; }
        .dash-sidebar-item .item-icon { font-size: 15px; width: 20px; text-align: center; flex-shrink: 0; }
        .dash-sidebar-footer { padding: 16px 10px 0; border-top: 1px solid var(--border); margin-top: auto; }
        .dash-content { flex: 1; padding: 40px 48px 60px; min-width: 0; }
        .dash-page-title { font-family: 'EB Garamond', serif; font-size: 28px; font-weight: 500; color: var(--navy); letter-spacing: -0.02em; margin-bottom: 4px; }
        .dash-page-title span { font-style: italic; color: var(--gold); }
        .dash-page-sub { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text3); margin-bottom: 28px; }

        .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px; }
        .dash-stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); padding: 20px 22px; position: relative; overflow: hidden; transition: box-shadow .2s; }
        .dash-stat-card:hover { box-shadow: 0 4px 16px rgba(26,39,68,0.08); }
        .dash-stat-card::after { content: ''; position: absolute; right: -20px; bottom: -20px; width: 80px; height: 80px; border-radius: 50%; background: rgba(26,39,68,0.03); }
        .dash-stat-label { font-family: 'DM Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text3); margin-bottom: 10px; }
        .dash-stat-val { font-family: 'EB Garamond', serif; font-size: 36px; font-weight: 500; color: var(--navy); line-height: 1; }
        .dash-stat-sub { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text3); margin-top: 6px; }

        .plan-banner { background: linear-gradient(135deg, var(--navy) 0%, var(--navy3) 100%); border-radius: var(--r-md); padding: 24px 28px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; position: relative; overflow: hidden; }
        .plan-banner::before { content: ''; position: absolute; right: -40px; top: -40px; width: 160px; height: 160px; border-radius: 50%; background: rgba(212,168,67,0.08); pointer-events: none; }
        .plan-badge-lrg { display: inline-block; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 10px; border-radius: 2px; background: rgba(212,168,67,0.2); color: var(--gold2); border: 1px solid rgba(212,168,67,0.35); margin-bottom: 10px; }
        .plan-name-lrg { font-family: 'EB Garamond', serif; font-size: 22px; font-weight: 500; color: var(--bg); margin-bottom: 4px; }
        .plan-renew { font-family: 'DM Sans', sans-serif; font-size: 13px; color: rgba(247,244,239,0.55); }
        .plan-actions { display: flex; gap: 10px; flex-wrap: wrap; position: relative; z-index: 1; }
        .btn-plan-upgrade { font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; padding: 9px 20px; background: var(--gold2); color: var(--navy); border: none; border-radius: var(--r-sm); cursor: pointer; transition: all .15s; }
        .btn-plan-upgrade:hover { background: #E8BC50; transform: translateY(-1px); }
        .btn-plan-cancel { font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; padding: 9px 20px; background: none; color: rgba(247,244,239,0.6); border: 1px solid rgba(247,244,239,0.2); border-radius: var(--r-sm); cursor: pointer; transition: all .15s; }
        .btn-plan-cancel:hover { border-color: rgba(192,57,43,0.5); color: #e87c72; }

        .dash-section-title { font-family: 'DM Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text3); margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
        .dash-section-title::before { content: ''; display: block; width: 16px; height: 1px; background: var(--border2); }

        .activity-list { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden; }
        .activity-row { display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-bottom: 1px solid var(--border); transition: background .15s; }
        .activity-row:last-child { border-bottom: none; }
        .activity-row:hover { background: rgba(26,39,68,0.02); }
        .activity-icon { width: 36px; height: 36px; border-radius: var(--r-sm); background: var(--bg2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
        .activity-name { font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; color: var(--navy); }
        .activity-meta { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text3); margin-top: 2px; }
        .activity-spacer { flex: 1; }
        .activity-badge { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 9px; border-radius: 20px; }
        .badge-done { background: rgba(26,107,60,0.08); color: var(--green); border: 1px solid rgba(26,107,60,0.2); }
        .badge-fail { background: rgba(192,57,43,0.08); color: var(--red); border: 1px solid rgba(192,57,43,0.2); }

        .profile-form { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); padding: 28px; }
        .profile-avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--navy); display: flex; align-items: center; justify-content: center; font-family: 'EB Garamond', serif; font-size: 24px; font-weight: 600; color: var(--gold2); margin-bottom: 20px; box-shadow: 0 0 0 4px rgba(184,146,42,0.15); }
        .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .danger-zone { background: rgba(192,57,43,0.03); border: 1px solid rgba(192,57,43,0.18); border-radius: var(--r-md); padding: 20px 24px; margin-top: 16px; }
        .danger-title { font-family: 'DM Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--red); margin-bottom: 10px; }
        .danger-desc { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text2); margin-bottom: 14px; line-height: 1.5; }
        .btn-danger { font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; padding: 8px 18px; background: none; color: var(--red); border: 1px solid rgba(192,57,43,0.4); border-radius: var(--r-sm); cursor: pointer; transition: all .15s; }
        .btn-danger:hover { background: rgba(192,57,43,0.08); border-color: var(--red); }

        .usage-bar-wrap { margin-bottom: 16px; }
        .usage-bar-top { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .usage-bar-label { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text2); }
        .usage-bar-count { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--text3); }
        .usage-bar-track { height: 5px; background: var(--bg2); border-radius: 3px; overflow: hidden; }
        .usage-bar-fill { height: 100%; border-radius: 3px; background: var(--navy); transition: width .4s ease; }
        .usage-bar-fill.warn { background: var(--gold); }
        .usage-bar-fill.over { background: var(--red); }

        @media (max-width: 768px) {
          .dash-shell { flex-direction: column; }
          .dash-sidebar { width: 100%; height: auto; position: static; flex-direction: row; flex-wrap: wrap; padding: 12px; border-right: none; border-bottom: 1px solid var(--border); }
          .dash-sidebar-user { display: none; }
          .dash-sidebar-nav { display: flex; flex-wrap: wrap; gap: 4px; padding: 0; }
          .dash-sidebar-footer { border-top: none; padding: 0; margin: 0; }
          .dash-content { padding: 24px 20px 50px; }
          .dash-grid { grid-template-columns: 1fr; }
          .profile-grid { grid-template-columns: 1fr; }
          .plan-banner { flex-direction: column; align-items: flex-start; }
        }
                @media (max-width: 768px) {
          .dash-page { padding: 80px 20px 50px; }
          .dash-grid { grid-template-columns: 1fr; }
          .profile-grid { grid-template-columns: 1fr; }
          .plan-banner { flex-direction: column; align-items: flex-start; }
        }

        /* ── Animations ── */
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .nav { padding: 0 20px; }
          .nav-links { display: none; }
          .hamburger {
            display: flex; flex-direction: column; gap: 5px;
            background: none; border: none; cursor: pointer; padding: 4px; margin-left: auto;
          }
          .hamburger span { display: block; width: 22px; height: 1.5px; background: var(--navy); border-radius: 2px; transition: all .2s; }
          .mobile-menu {
            position: fixed; top: 60px; left: 0; right: 0; z-index: 150;
            background: var(--surface); border-bottom: 1px solid var(--border);
            padding: 16px 20px; display: flex; flex-direction: column; gap: 4px;
            box-shadow: 0 8px 24px rgba(26,39,68,0.1);
            animation: fadeIn .15s ease;
          }
          .hero { padding: 100px 20px 60px; }
          .hero-stats { gap: 24px; }
          .section { padding: 64px 20px; }
          .features-grid { grid-template-columns: 1fr; }
          .doc-types-row { grid-template-columns: 1fr 1fr; }
          .pricing-grid { grid-template-columns: 1fr; }
          .footer-top { grid-template-columns: 1fr 1fr; gap: 32px; }
          .trust-bar { gap: 24px; padding: 32px 20px; }
          .trust-divider { display: none; }
          .tool-page { padding: 80px 20px 60px; }
          .card { padding: 20px 16px; }
          .type-grid { grid-template-columns: 1fr; }
          .form-grid-2 { grid-template-columns: 1fr; }
          .form-grid-fields { grid-template-columns: 1fr; }
          .cta-strip { padding: 64px 20px; }
          .footer { padding: 48px 20px 24px; }
          .footer-bottom { flex-direction: column; align-items: flex-start; }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .features-grid { grid-template-columns: repeat(2, 1fr); }
          .doc-types-row { grid-template-columns: repeat(2, 1fr); }
          .pricing-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-logo" onClick={() => navTo('home')}>
          <div className="nav-logo-mark">FS</div>
          <div>
            <div className="nav-logo-text">Format Studio</div>
            <div className="nav-logo-sub">Edwin Incorporation</div>
          </div>
        </div>
        <div className="nav-spacer" />
        <div className="nav-links">
          <button className={`nav-link ${page === 'home' ? 'active' : ''}`} onClick={() => navTo('home')}>Home</button>
          <button className="nav-link" onClick={() => { navTo('home'); setTimeout(() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }), 100); }}>Features</button>
          <button className={`nav-link ${page === 'pricing' ? 'active' : ''}`} onClick={() => navTo('pricing')}>Pricing</button>
          <button className="nav-link" onClick={() => openModal('licence')}>Licence</button>
          <div className="nav-divider" />
          {user ? (
            <>
              <button className={`nav-link ${page === 'dashboard' ? 'active' : ''}`} onClick={() => navTo('dashboard')}>My Account</button>
              <div className="nav-user-dot">{user.name.charAt(0).toUpperCase()}</div>
              <button className="nav-logout" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <button className="nav-btn-ghost" onClick={() => openModal('login')}>Login</button>
              <button className="nav-btn-solid" onClick={() => openModal('signup')}>Sign Up</button>
            </>
          )}
          <button className="btn-primary" onClick={() => navTo('tool')} style={{ marginLeft: 8 }}>Open Tool →</button>
        </div>
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span /><span />
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="mobile-menu">
          <button className="nav-link" onClick={() => navTo('home')}>Home</button>
          <button className="nav-link" onClick={() => navTo('pricing')}>Pricing</button>
          <button className="nav-link" onClick={() => { setMenuOpen(false); openModal('licence'); }}>Licence</button>
          {user ? (
            <>
              <button className="nav-link" onClick={() => navTo('dashboard')}>My Account</button>
              <button className="nav-logout" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={() => { handleLogout(); setMenuOpen(false); }}>Logout</button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="nav-btn-ghost" onClick={() => { setMenuOpen(false); openModal('login'); }}>Login</button>
              <button className="nav-btn-solid" onClick={() => { setMenuOpen(false); openModal('signup'); }}>Sign Up</button>
            </div>
          )}
          <button className="btn-primary" onClick={() => navTo('tool')} style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>Open Tool →</button>
        </div>
      )}

      {/* ══════════ HOME PAGE ══════════ */}
      {page === 'home' && (
        <>
          {/* Hero */}
          <section className="hero" ref={heroRef}>
            <div className="hero-bg" />
            <div className="hero-bg-gradient" />
            <div className="hero-content">
              <div className="hero-badge">
                <span className="hero-badge-dot" />
                Professional Document Formatting
              </div>
              <h1 className="hero-title">
                Publish with<br /><em>precision</em> &amp; clarity
              </h1>
              <p className="hero-subtitle">
                Academic theses, research papers, books and official correspondence — formatted to international standards in seconds. No AI, no guesswork.
              </p>
              <div className="hero-actions">
                <button className="btn-primary" onClick={() => navTo('tool')}>
                  Format a Document →
                </button>
                <button className="btn-secondary" onClick={() => navTo('pricing')}>
                  View Pricing
                </button>
              </div>
              <div className="hero-stats">
                <div>
                  <div className="hero-stat-num">4</div>
                  <div className="hero-stat-label">Document Types</div>
                </div>
                <div>
                  <div className="hero-stat-num">13+</div>
                  <div className="hero-stat-label">Font Families</div>
                </div>
                <div>
                  <div className="hero-stat-num">5</div>
                  <div className="hero-stat-label">Page Formats</div>
                </div>
                <div>
                  <div className="hero-stat-num">100%</div>
                  <div className="hero-stat-label">Rule-based Accuracy</div>
                </div>
              </div>
            </div>
          </section>

          {/* Trust bar */}
          <div className="trust-bar">
            <span className="trust-item">Trusted by researchers across India</span>
            <div className="trust-divider" />
            <span className="trust-item">IIT · NIT · Central Universities</span>
            <div className="trust-divider" />
            <span className="trust-item">Academic publishers & journals</span>
            <div className="trust-divider" />
            <span className="trust-item">Government & legal correspondence</span>
          </div>

          {/* Features */}
          <section className="section" id="features" style={{ background: 'var(--bg)' }}>
            <div className="section-inner">
              <div style={{ maxWidth: 560 }}>
                <div className="section-label">Why Format Studio</div>
                <h2 className="section-title">Built for <em>serious</em> publishing</h2>
                <p className="section-desc">
                  Every parameter — margins, fonts, spacing, headings — follows established academic and publishing conventions. Not a template. An engine.
                </p>
              </div>
              <div className="features-grid">
                {FEATURES.map((f, i) => (
                  <div className="feature-card" key={i}>
                    <div className="feature-icon">{f.icon}</div>
                    <div className="feature-title">{f.title}</div>
                    <div className="feature-desc">{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Doc types */}
          <section className="section" style={{ background: 'var(--bg2)' }}>
            <div className="section-inner">
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
                <div>
                  <div className="section-label">Document Types</div>
                  <h2 className="section-title">One platform,<br /><em>every format</em></h2>
                </div>
                <button className="btn-primary" onClick={() => navTo('tool')}>Start Formatting →</button>
              </div>
              <div className="doc-types-row">
                {DOC_TYPES.map(t => (
                  <div className="doc-type-card" key={t.id} onClick={() => { navTo('tool'); }}>
                    <div className="doc-type-tag">{t.tag}</div>
                    <div className="doc-type-icon">{t.icon}</div>
                    <div className="doc-type-name">{t.label}</div>
                    <div className="doc-type-desc">{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <div className="cta-strip">
            <div className="cta-strip-bg" />
            <div className="cta-content">
              <h2 className="cta-title">Ready to format your<br /><em>next document?</em></h2>
              <p className="cta-sub">Start free — no credit card required. 14-day trial on all Pro features.</p>
              <button className="btn-gold" onClick={() => navTo('tool')}>Format a Document — Free →</button>
            </div>
          </div>
        </>
      )}

      {/* ══════════ PRICING PAGE ══════════ */}
      {page === 'pricing' && (
        <div style={{ paddingTop: 60 }}>
          <section className="section">
            <div className="section-inner">
              <div style={{ textAlign: 'center', marginBottom: 0 }}>
                <div className="section-label" style={{ justifyContent: 'center' }}>Pricing</div>
                <h1 className="section-title" style={{ maxWidth: 480, margin: '0 auto 12px' }}>
                  Simple, <em>transparent</em> pricing
                </h1>
                <p className="section-desc" style={{ margin: '0 auto', textAlign: 'center' }}>
                  Start free, upgrade when you need. Cancel anytime.
                </p>
              </div>
              <div className="pricing-grid">
                {PRICING_PLANS.map(plan => (
                  <div className={`pricing-card ${plan.highlight ? 'highlight' : ''}`} key={plan.id}>
                    <div className="pricing-badge">{plan.highlight ? '✦ Most Popular' : plan.tag || plan.name}</div>
                    <div className="pricing-name">{plan.name}</div>
                    <div className="pricing-desc">{plan.desc}</div>
                    <div className="pricing-price">{plan.price}</div>
                    <div className="pricing-period">{plan.period}</div>
                    <div className="pricing-divider" />
                    <ul className="pricing-features">
                      {plan.features.map((f, i) => (
                        <li className="pricing-feature" key={i}>
                          <span className="pricing-feature-check">✓</span>
                          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      className={`pricing-cta ${plan.highlight ? 'pricing-cta-solid' : 'pricing-cta-ghost'}`}
                      onClick={() => plan.highlight ? openModal('signup') : navTo('tool')}
                    >
                      {plan.cta}
                    </button>
                  </div>
                ))}
              </div>

              {/* FAQ-ish note */}
              <div style={{ marginTop: 48, padding: '28px 32px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
                  {[
                    { q: 'What payment methods?', a: 'UPI, all Indian debit/credit cards, net banking via Razorpay. Instant activation.' },
                    { q: 'Can I cancel anytime?', a: 'Yes — cancel from your dashboard. You keep Pro access until the period ends.' },
                    { q: 'GST invoice available?', a: 'Yes. Institution plan includes GST-compliant invoices for university accounts.' },
                  ].map((item, i) => (
                    <div key={i}>
                      <div style={{ fontFamily: "'EB Garamond', serif", fontSize: 16, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>{item.q}</div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{item.a}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ══════════ TOOL PAGE ══════════ */}
      {page === 'tool' && (
        <div className="tool-page">
          <div className="tool-header">
            <h1 className="tool-title">Format Your Document</h1>
            <p className="tool-subtitle">Select type → Configure → Upload → Download</p>
          </div>

          <div className="steps-bar">
            {[{ n: 1, label: 'Select Type' }, { n: 2, label: 'Configure' }, { n: 3, label: 'Upload & Export' }].map(({ n, label }, i) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', flex: n < 3 ? 1 : 0 }}>
                <div className={`step-node ${step === n ? 'active' : step > n ? 'done' : ''}`}>
                  <div className="step-circle">{step > n ? '✓' : n}</div>
                  <span>{label}</span>
                </div>
                {n < 3 && <div className={`step-connector ${step > n ? 'done' : ''}`} />}
              </div>
            ))}
          </div>

          {/* Step 1 */}
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

          {/* Step 2 */}
          {step === 2 && currentType && (
            <div>
              <button className="back-btn" onClick={() => setStep(1)}>← Back</button>
              <div className="card">
                <div className="card-title">{currentType.icon} {currentType.label} — Options</div>
                <div className="card-sub">All fields optional — leave blank for defaults</div>

                {/* Font */}
                <div className="form-section">
                  <div className="form-section-title">◈ Font & Typography</div>
                  <div className="form-grid-2">
                    <div className="field-group">
                      <label className="field-label">Language <span className="field-opt">Optional</span></label>
                      <select className="field-input" value={formData.font_script || ''} onChange={e => { handleFieldChange('font_script', e.target.value); handleFieldChange('font_style', ''); }}>
                        <option value="">Select language...</option>
                        <option value="english">English</option>
                        <option value="hindi">Hindi — KrutiDev / Unicode</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label">Font Family <span className="field-opt">Optional</span></label>
                      <select className="field-input" value={formData.font_style || ''} onChange={e => handleFieldChange('font_style', e.target.value)} disabled={!formData.font_script}>
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


                {/* Page numbers */}
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

                {/* Page numbers */}
                {/* <div className="form-section">
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
                    </div>
                  

                    {formData.page_numbers && (
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
                  )}




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
                </div> */}

                {/* Doc fields */}
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

          {/* Step 3 */}
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
                    <button className="file-remove" onClick={() => setFile(null)}>✕</button>
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

          {status === 'uploading' && (
            <div className="status-center">
              <div className="spinner" />
              <div className="status-title">Formatting your document…</div>
              <div className="status-sub">Applying all formatting rules. This takes a few seconds.</div>
            </div>
          )}

          {status === 'done' && (
            <div className="status-center">
              <div className="status-icon">✅</div>
              <div className="status-title">Document Formatted</div>
              <div className="status-sub">Your document is ready to download.</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                {/* <a href={downloadUrl} download="formatted_document.docx" className="btn-download">⬇ Download File</a> */}

<a href={downloadUrl} download={file?.name || 'formatted_document.docx'} className="btn-download">⬇ Download File</a>

                <button className="btn-secondary" onClick={handleReset}>Format Another</button>
              </div>
            </div>
          )}

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
      )}

      {/* ══════════ DASHBOARD PAGE ══════════ */}
      {page === 'dashboard' && (
        <UserDashboard user={user} navTo={navTo} openModal={openModal} />
      )}




      {/* ══════════ FOOTER ══════════ */}
      {page !== 'dashboard' && <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div>
              <div className="footer-brand-name">Format Studio</div>
              <div className="footer-brand-tag">Edwin Incorporation</div>
              <div className="footer-brand-desc">Professional document formatting for academic, publishing and official use. Built for precision.</div>
            </div>
            <div>
              <div className="footer-col-title">Product</div>
              <ul className="footer-links">
                <li className="footer-link" onClick={() => navTo('tool')}>Format Tool</li>
                <li className="footer-link" onClick={() => navTo('pricing')}>Pricing</li>
                <li className="footer-link" onClick={() => navTo('home')}>Features</li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Support</div>
              <ul className="footer-links">
                <li className="footer-link">Documentation</li>
                <li className="footer-link">Contact Us</li>
                <li className="footer-link" onClick={() => openModal('licence')}>Licence</li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Legal</div>
              <ul className="footer-links">
                <li className="footer-link">Privacy Policy</li>
                <li className="footer-link">Terms of Service</li>
                <li className="footer-link">Refund Policy</li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <div className="footer-copy">© {new Date().getFullYear()} Edwin Incorporation — All Rights Reserved</div>
            <div className="footer-legal">
              <span className="footer-legal-link" onClick={() => openModal('licence')}>Licence Agreement</span>
              <span className="footer-legal-link">Privacy</span>
              <span className="footer-legal-link">Terms</span>
            </div>
          </div>
        </div>
      </footer>}

      {/* ══════════ MODALS ══════════ */}
      {/* {modal === 'login' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-card">
            <button className="modal-close" onClick={closeModal}>✕</button>
            <div className="modal-title">Welcome back</div>
            <div className="modal-sub">Sign in to your Format Studio account</div>
            <div className="modal-field">
              <label className="modal-label">Email Address</label>
              <input className="modal-input" type="email" placeholder="you@example.com" value={authForm.email} onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="modal-field">
              <label className="modal-label">Password</label>
              <input className="modal-input" type="password" placeholder="••••••••" value={authForm.password} onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            {authError && <div className="modal-error">{authError}</div>}
            <button className="modal-submit" onClick={handleLogin}>Sign In →</button>
            <div className="modal-switch">No account? <button onClick={() => openModal('signup')}>Create one</button></div>
          </div>
        </div>
      )} */}


{/* ══════════ MODALS ══════════ */}
      {/* {modal === 'login' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-card">
            <button className="modal-close" onClick={closeModal}>✕</button>
            <div className="modal-title">Welcome back</div>
            <div className="modal-sub">Sign in to your Format Studio account</div>
            <div className="modal-field">
              <label className="modal-label">Email Address</label>
              <input className="modal-input" type="email" placeholder="you@example.com" value={authForm.email} onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="modal-field">
              <label className="modal-label">Password</label>
              <input className="modal-input" type="password" placeholder="••••••••" value={authForm.password} onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            {authError && <div className="modal-error">{authError}</div>}
            <button className="modal-submit" onClick={handleLogin}>Sign In →</button>
            <div style={{ textAlign: 'center', margin: '12px 0', color: '#999', fontSize: '13px' }}>or</div>
            <button onClick={handleGoogleLogin} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: '500' }}>
              <img src="https://www.google.com/favicon.ico" width="18" height="18" />
              Continue with Google
            </button>
            <div className="modal-switch">No account? <button onClick={() => openModal('signup')}>Create one</button></div>
          </div>
        </div>
      )} */}


{/* ══════════ MODALS ══════════ */}
      {modal === 'login' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-card">
            <button className="modal-close" onClick={closeModal}>✕</button>
            <div className="modal-title">Welcome back</div>
            <div className="modal-sub">Sign in to your Format Studio account</div>
            <div className="modal-field">
              <label className="modal-label">Email Address</label>
              <input className="modal-input" type="email" placeholder="you@example.com" value={authForm.email} onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="modal-field">
              <label className="modal-label">Password</label>
              <input className="modal-input" type="password" placeholder="••••••••" value={authForm.password} onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            {authError && <div className="modal-error">{authError}</div>}
            <button className="modal-submit" onClick={handleLogin}>Sign In →</button>
            <div className="modal-divider">or</div>
            <button onClick={handleGoogleLogin} className="modal-google-btn">
              <img src="https://www.google.com/favicon.ico" width="18" height="18" />
              Continue with Google
            </button>
            <div className="modal-switch">No account? <button onClick={() => openModal('signup')}>Create one</button></div>
          </div>
        </div>
      )}


{/* 
      {modal === 'signup' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-card">
            <button className="modal-close" onClick={closeModal}>✕</button>
            <div className="modal-title">Create account</div>
            <div className="modal-sub">Join Format Studio — free to start</div>
            <div className="modal-field">
              <label className="modal-label">Full Name</label>
              <input className="modal-input" type="text" placeholder="Your name" value={authForm.name} onChange={e => setAuthForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="modal-field">
              <label className="modal-label">Email Address</label>
              <input className="modal-input" type="email" placeholder="you@example.com" value={authForm.email} onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="modal-field">
              <label className="modal-label">Password</label>
              <input className="modal-input" type="password" placeholder="Min. 8 characters" value={authForm.password} onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            {authError && <div className="modal-error">{authError}</div>}
            <button className="modal-submit" onClick={handleSignup}>Create Account →</button>
            <div className="modal-switch">Already have one? <button onClick={() => openModal('login')}>Sign in</button></div>
          </div>
        </div>
      )} */}



{modal === 'signup' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-card">
            <button className="modal-close" onClick={closeModal}>✕</button>
            <div className="modal-title">Create account</div>
            <div className="modal-sub">Join Format Studio — free to start</div>
            <div className="modal-field">
              <label className="modal-label">Full Name</label>
              <input className="modal-input" type="text" placeholder="Your name" value={authForm.name} onChange={e => setAuthForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="modal-field">
              <label className="modal-label">Email Address</label>
              <input className="modal-input" type="email" placeholder="you@example.com" value={authForm.email} onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="modal-field">
              <label className="modal-label">Password</label>
              <input className="modal-input" type="password" placeholder="Min. 8 characters" value={authForm.password} onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            {authError && <div className="modal-error">{authError}</div>}
            <button className="modal-submit" onClick={handleSignup}>Create Account →</button>
            <div className="modal-divider">or</div>
            <button onClick={handleGoogleLogin} className="modal-google-btn">
              <img src="https://www.google.com/favicon.ico" width="18" height="18" />
              Continue with Google
            </button>
            <div className="modal-switch">Already have one? <button onClick={() => openModal('login')}>Sign in</button></div>
          </div>
        </div>
      )}










      {modal === 'licence' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-card wide">
            <button className="modal-close" onClick={closeModal}>✕</button>
            <img src={edwincover} alt="Edwin Incorporation" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 20 }} />
            <div className="modal-title">Licence Agreement</div>
            <div className="modal-sub" style={{ marginBottom: 20 }}>Edwin Incorporation — Confidential & Proprietary</div>
            {[
              ['Company Policies', 'This software is the exclusive property of Edwin Incorporation. Employees are granted a non-exclusive, non-transferable licence for company-related use only.'],
              ['Confidentiality', 'All data processed — client information, strategies, financial data, proprietary algorithms — is strictly confidential. Violation leads to immediate legal action.'],
              ['Intellectual Property', 'Source code, design, UI elements, trademarks and all associated IP belong solely to Edwin Incorporation. No personal claim or ownership rights over outputs.'],
              ['Usage Restrictions', 'Do not reverse engineer, decompile, share credentials, remove copyright notices, or use the software outside assigned duties.'],
              ['Data & Privacy', 'User data is handled per applicable privacy laws. Activity logs may be monitored. No personal data sold to third parties. Retention: 5 years.'],
              ['Governing Law', 'Disputes subject to the exclusive jurisdiction of courts where Edwin Incorporation is registered.'],
            ].map(([title, text]) => (
              <div key={title}>
                <div className="licence-section-title">{title}</div>
                <div className="licence-text">{text}</div>
              </div>
            ))}
            <div style={{ marginTop: 20, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 'var(--r-sm)', fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--text3)' }}>
              © {new Date().getFullYear()} Edwin Incorporation · v1.0 · Authorized use only
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



/* 


let see this files yaha pr book.py ke liye kuch chize set karni hai jo abhi sahi se work nhi kr rhi hai mujhe batao code
me kaha aur kya changes karna hai mai code block replace kr dunga, dhyan rahe isse fix karte time kuch aur exing chize kharab na ho 
agar ye changes minor ho to mai code blocks replace krunga aur agar major ho to puri updated file hi de dena:


1> kahi-kahi pr buttel points ka content bahut bada hai aur vo justify nhi display ho rha hai isse fix krna hai
2> 1.5 ki line spacing tables ke undar ke content me bhi chahiye
3> kahi-kahi pr subheadings ki numbering nhi ho rhi hai may be vo sub heading ki tarah se detect nhi ho rha hai
4> main headings should be 16pt and subheadings should be 14pt  




*/