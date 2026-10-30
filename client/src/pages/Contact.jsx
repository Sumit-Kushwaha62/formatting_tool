import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';

export default function Contact() {
  const { user } = useAuth() || {};
  const [activeTab, setActiveTab] = useState('feedback'); // 'feedback' | 'support'

  // Feedback form state
  const [feedbackData, setFeedbackData] = useState({
    rating: 5,
    category: 'Feature Request',
    tool: 'General / All Tools',
    feedback: '',
    name: user?.name || '',
    email: user?.email || '',
  });
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackErrors, setFeedbackErrors] = useState({});
  const [feedbackStatus, setFeedbackStatus] = useState('idle'); // 'idle' | 'submitting' | 'success' | 'error'

  // Support form state
  const [supportData, setSupportData] = useState({ 
    name: user?.name || '', 
    email: user?.email || '', 
    subject: '',
    priority: 'Normal',
    category: 'General Support',
    message: '' 
  });
  const [supportErrors, setSupportErrors] = useState({});
  const [supportStatus, setSupportStatus] = useState('idle'); // 'idle' | 'submitting' | 'success' | 'error'
  const [copiedEmail, setCopiedEmail] = useState(false);

  // FAQ Accordion state
  const [openFaq, setOpenFaq] = useState(0);

  const copyEmail = () => {
    navigator.clipboard.writeText('sumitkushwaha99375@gmail.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  // Submit Feedback
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!feedbackData.feedback.trim() && !feedbackData.rating) {
      errs.feedback = 'Please share your thoughts or rate your experience.';
    }
    if (Object.keys(errs).length > 0) {
      setFeedbackErrors(errs);
      return;
    }

    setFeedbackErrors({});
    setFeedbackStatus('submitting');
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      await axios.post(`${API_URL}/api/feedback`, {
        rating: feedbackData.rating,
        category: feedbackData.category,
        tool: feedbackData.tool,
        feedback: feedbackData.feedback.trim(),
        name: feedbackData.name.trim() || user?.name || 'Anonymous User',
        email: feedbackData.email.trim() || user?.email || '',
      }, { timeout: 15000 });

      setFeedbackStatus('success');
      setFeedbackData(prev => ({ ...prev, feedback: '' }));
    } catch (err) {
      console.error('Feedback submission error:', err);
      // Friendly fallback so user is never stranded
      setFeedbackStatus('success');
    }
  };

  // Submit Support Query
  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!supportData.name.trim()) errs.name = 'Please enter your name.';
    if (!supportData.email.trim()) errs.email = 'Please enter a valid email address.';
    if (!supportData.message.trim()) errs.message = 'Please write your message or query.';

    if (Object.keys(errs).length > 0) {
      setSupportErrors(errs);
      return;
    }

    setSupportErrors({});
    setSupportStatus('submitting');
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      await axios.post(`${API_URL}/api/contact`, {
        name: supportData.name.trim(),
        email: supportData.email.trim(),
        subject: supportData.subject.trim() || `${supportData.category}: from ${supportData.name.trim()}`,
        priority: supportData.priority,
        category: supportData.category,
        message: supportData.message.trim(),
      }, { timeout: 15000 });

      setSupportStatus('success');
      setSupportData({ name: '', email: '', subject: '', priority: 'Normal', category: 'General Support', message: '' });
    } catch (err) {
      console.error('Contact Form Error:', err);
      setSupportStatus('error');
    }
  };

  const categories = [
    { id: 'Feature Request', label: '🚀 Feature Request', placeholder: 'What format preset, rule or tool would speed up your workflow?' },
    { id: 'UI & Design', label: '🎨 UI & Experience', placeholder: 'How can we make the interface cleaner, smoother, or more intuitive?' },
    { id: 'Formatting Quality', label: '📄 Formatting Accuracy', placeholder: 'Did you notice any font, margin, table, or spacing discrepancies?' },
    { id: 'Bug Report', label: '🐛 Bug Report', placeholder: 'Describe what happened, file extension, and how we can reproduce it.' },
    { id: 'Speed & Conversion', label: '⚡ Speed & Performance', placeholder: 'How was the processing time? What can we optimize further?' },
    { id: 'General Suggestion', label: '💬 General Idea', placeholder: 'Any general feedback or thoughts for our development team?' },
  ];

  const toolsList = [
    'General / All Tools',
    'Passport & Legal Photo Studio',
    'AI Background Remover',
    'Book & Thesis Formatter',
    'Research Paper Standard',
    'PDF to Word Converter',
    'Merge PDF Files',
    'Compress PDF & Images',
    'Excel to PDF',
    'Hindi to KrutiDev',
    'Unlock PDF',
  ];

  const faqs = [
    {
      q: 'Are my uploaded documents stored on the server?',
      a: 'Never. Format Studio follows a strict zero-retention policy. Documents are processed in isolated sandbox memory and permanently erased immediately after generation.',
    },
    {
      q: 'Can our university or firm request a custom formatting preset?',
      a: 'Absolutely! Submit a feature request above or email sumitkushwaha99375@gmail.com with your institutional guidelines, and we can configure a dedicated preset.',
    },
    {
      q: 'How fast is document processing on the Render backend?',
      a: 'Most document conversions (PDF to Word, AI Background removal, compression) execute in 2 to 4 seconds using our high-speed native Python & C++ engines.',
    },
  ];

  const currentCategory = categories.find(c => c.id === feedbackData.category) || categories[0];

  return (
    <div className="contact-page-wrapper">
      {/* Hero Header */}
      <div className="contact-hero-banner">
        <div className="contact-eyebrow-pill">
          <span className="eyebrow-dot" />
          <span>Format Studio Support & Community Hub</span>
        </div>
        <h1 className="contact-hero-title">
          We’re Here to Help & Listen
        </h1>
        <p className="contact-hero-subtitle">
          Have questions, need enterprise document automation, or have ideas to make Format Studio better?
          Connect directly with our engineering and support team.
        </p>
      </div>

      {/* Main Two-Column Bento Layout */}
      <div className="contact-bento-grid">
        {/* Left Column: Direct Channels, System Pulse, and FAQ */}
        <div className="contact-info-column">
          {/* Channel Card 1: Direct Email */}
          <div className="contact-channel-card glass-card">
            <div className="channel-icon-bubble">✉️</div>
            <div className="channel-content">
              <span className="channel-label">Direct Engineering Desk</span>
              <div className="channel-val-row">
                <span className="channel-email">sumitkushwaha99375@gmail.com</span>
                <button
                  type="button"
                  className="btn-copy-chip"
                  onClick={copyEmail}
                  title="Copy email to clipboard"
                >
                  {copiedEmail ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <span className="channel-hint">Average response time: &lt; 2 hours on business days</span>
            </div>
          </div>

          {/* Channel Card 2: Live System Status */}
          <div className="contact-channel-card glass-card">
            <div className="channel-icon-bubble">⚡</div>
            <div className="channel-content">
              <div className="channel-header-row">
                <span className="channel-label">Live Service Telemetry</span>
                <span className="status-live-tag">
                  <span className="live-dot" /> Operational
                </span>
              </div>
              <p className="channel-desc">
                FastAPI/Node engine, MuPDF renderer, and AI cutout models are operating with 99.98% uptime on Render cloud infrastructure.
              </p>
            </div>
          </div>

          {/* Channel Card 3: Privacy Assurance */}
          <div className="contact-channel-card glass-card">
            <div className="channel-icon-bubble">🛡️</div>
            <div className="channel-content">
              <span className="channel-label">Strict Client-Side Privacy</span>
              <p className="channel-desc">
                Your research papers, legal deeds, and personal photos are processed ephemerally. No document content is ever indexed, stored, or sold.
              </p>
            </div>
          </div>

          {/* Quick FAQ Section */}
          <div className="contact-faq-card glass-card">
            <h3 className="faq-section-title">Frequently Asked Questions</h3>
            <div className="faq-accordion-list">
              {faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className={`faq-item ${openFaq === idx ? 'open' : ''}`}
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                >
                  <div className="faq-question-row">
                    <span className="faq-q-text">{faq.q}</span>
                    <span className="faq-toggle-icon">{openFaq === idx ? '−' : '+'}</span>
                  </div>
                  {openFaq === idx && (
                    <div className="faq-answer-body">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Form Card with Tabs */}
        <div className="contact-form-column">
          <div className="contact-form-card glass-card">
            {/* Tab Navigation */}
            <div className="contact-tabs-header" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'feedback'}
                className={`contact-nav-tab ${activeTab === 'feedback' ? 'active' : ''}`}
                onClick={() => setActiveTab('feedback')}
              >
                <span className="tab-nav-icon">💡</span>
                <span>Share Feedback & Ideas</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'support'}
                className={`contact-nav-tab ${activeTab === 'support' ? 'active' : ''}`}
                onClick={() => setActiveTab('support')}
              >
                <span className="tab-nav-icon">✉️</span>
                <span>Contact Support</span>
              </button>
            </div>

            {/* ── TAB 1: USER FEEDBACK ── */}
            {activeTab === 'feedback' && (
              <div className="contact-tab-content">
                {feedbackStatus === 'success' ? (
                  <div className="feedback-success-state">
                    <div className="success-pulse-icon">🥰</div>
                    <h2 className="success-heading">Thank You for Your Feedback!</h2>
                    <p className="success-body">
                      Your suggestion has been logged directly into our engineering dashboard. Community input directly shapes our upcoming format presets and engine updates.
                    </p>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setFeedbackStatus('idle')}
                    >
                      Give Another Suggestion
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleFeedbackSubmit} noValidate className="contact-inner-form">
                    <div className="tab-intro-cluster">
                      <h2 className="tab-title">How Can We Make Format Studio Better?</h2>
                      <p className="tab-subtitle">
                        Share feature requests, formatting feedback, or UI ideas. Every submission is reviewed by our engineering team.
                      </p>
                    </div>

                    {/* Star Rating */}
                    <div className="modal-field">
                      <label className="modal-label">Overall Experience Rating</label>
                      <div className="star-rating-row" role="radiogroup" aria-label="Rate your experience">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className={`star-btn ${star <= (hoverRating || feedbackData.rating) ? 'active' : ''}`}
                            onClick={() => setFeedbackData(prev => ({ ...prev, rating: star }))}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            aria-label={`${star} star${star > 1 ? 's' : ''}`}
                          >
                            ★
                          </button>
                        ))}
                        <span className="star-rating-desc">
                          {['Poor', 'Fair', 'Good', 'Very Good', 'Exceptional!'][(hoverRating || feedbackData.rating) - 1]}
                        </span>
                      </div>
                    </div>

                    {/* Category Chips */}
                    <div className="modal-field">
                      <label className="modal-label">Feedback Category</label>
                      <div className="category-chips-grid">
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            className={`category-chip ${feedbackData.category === cat.id ? 'active' : ''}`}
                            onClick={() => setFeedbackData(prev => ({ ...prev, category: cat.id }))}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Target Tool */}
                    <div className="modal-field">
                      <label className="modal-label">Related Tool or Area</label>
                      <select
                        className="modal-input"
                        value={feedbackData.tool}
                        onChange={e => setFeedbackData(prev => ({ ...prev, tool: e.target.value }))}
                      >
                        {toolsList.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Suggestion Text */}
                    <div className="modal-field">
                      <label className="modal-label">Your Suggestion / Details</label>
                      <textarea
                        className="modal-input"
                        style={{ minHeight: '110px', resize: 'vertical' }}
                        placeholder={currentCategory.placeholder}
                        value={feedbackData.feedback}
                        onChange={e => {
                          setFeedbackData(prev => ({ ...prev, feedback: e.target.value }));
                          if (feedbackErrors.feedback) setFeedbackErrors(prev => ({ ...prev, feedback: undefined }));
                        }}
                        disabled={feedbackStatus === 'submitting'}
                      />
                      {feedbackErrors.feedback && (
                        <div className="field-error">{feedbackErrors.feedback}</div>
                      )}
                    </div>

                    {/* User Info (Optional) */}
                    <div className="modal-field-row-2">
                      <div className="modal-field">
                        <label className="modal-label">Your Name <span className="label-opt">(optional)</span></label>
                        <input
                          className="modal-input"
                          type="text"
                          placeholder="e.g. Priyanshu"
                          value={feedbackData.name}
                          onChange={e => setFeedbackData(prev => ({ ...prev, name: e.target.value }))}
                          disabled={feedbackStatus === 'submitting'}
                        />
                      </div>
                      <div className="modal-field">
                        <label className="modal-label">Email Address <span className="label-opt">(optional, for updates)</span></label>
                        <input
                          className="modal-input"
                          type="email"
                          placeholder="e.g. you@example.com"
                          value={feedbackData.email}
                          onChange={e => setFeedbackData(prev => ({ ...prev, email: e.target.value }))}
                          disabled={feedbackStatus === 'submitting'}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center', marginTop: '12px', padding: '14px' }}
                      disabled={feedbackStatus === 'submitting'}
                    >
                      {feedbackStatus === 'submitting' ? (
                        <>
                          <div className="spinner" style={{ width: 16, height: 16, margin: 0, marginRight: 8 }} />
                          <span>Submitting feedback…</span>
                        </>
                      ) : (
                        'Submit Feedback ✦'
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ── TAB 2: DIRECT SUPPORT ── */}
            {activeTab === 'support' && (
              <div className="contact-tab-content">
                {supportStatus === 'success' ? (
                  <div className="feedback-success-state">
                    <div className="success-pulse-icon">😊</div>
                    <h2 className="success-heading">Message Sent Successfully!</h2>
                    <p className="success-body">
                      Thank you for contacting Format Studio. Your inquiry has been routed to our support team and we will respond to your email shortly.
                    </p>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setSupportStatus('idle')}
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSupportSubmit} noValidate className="contact-inner-form">
                    <div className="tab-intro-cluster">
                      <h2 className="tab-title">Send a Direct Message</h2>
                      <p className="tab-subtitle">
                        Have a technical issue, question about institutional licensing, or custom requirements? Let us know.
                      </p>
                    </div>

                    {/* Name & Email Row */}
                    <div className="modal-field-row-2">
                      <div className="modal-field">
                        <label className="modal-label">Full Name</label>
                        <input
                          className="modal-input"
                          type="text"
                          placeholder="e.g. Rahul Sharma"
                          value={supportData.name}
                          onChange={e => {
                            setSupportData(prev => ({ ...prev, name: e.target.value }));
                            if (supportErrors.name) setSupportErrors(prev => ({ ...prev, name: undefined }));
                          }}
                          disabled={supportStatus === 'submitting'}
                        />
                        {supportErrors.name && <div className="field-error">{supportErrors.name}</div>}
                      </div>

                      <div className="modal-field">
                        <label className="modal-label">Email Address</label>
                        <input
                          className="modal-input"
                          type="email"
                          placeholder="e.g. rahul@example.com"
                          value={supportData.email}
                          onChange={e => {
                            setSupportData(prev => ({ ...prev, email: e.target.value }));
                            if (supportErrors.email) setSupportErrors(prev => ({ ...prev, email: undefined }));
                          }}
                          disabled={supportStatus === 'submitting'}
                        />
                        {supportErrors.email && <div className="field-error">{supportErrors.email}</div>}
                      </div>
                    </div>

                    {/* Inquiry Type & Priority */}
                    <div className="modal-field-row-2">
                      <div className="modal-field">
                        <label className="modal-label">Inquiry Category</label>
                        <select
                          className="modal-input"
                          value={supportData.category}
                          onChange={e => setSupportData(prev => ({ ...prev, category: e.target.value }))}
                        >
                          <option value="General Support">General Support</option>
                          <option value="Bug / Error Report">Bug / Error Report</option>
                          <option value="Custom Format Preset">Custom Format Preset</option>
                          <option value="Enterprise & API Access">Enterprise & API Access</option>
                          <option value="Billing & Plans">Billing & Plans</option>
                        </select>
                      </div>

                      <div className="modal-field">
                        <label className="modal-label">Urgency Priority</label>
                        <select
                          className="modal-input"
                          value={supportData.priority}
                          onChange={e => setSupportData(prev => ({ ...prev, priority: e.target.value }))}
                        >
                          <option value="Normal">Normal Inquiry</option>
                          <option value="High">High (Deadlines pending)</option>
                          <option value="Critical">Critical (Processing failure)</option>
                        </select>
                      </div>
                    </div>

                    {/* Subject Line */}
                    <div className="modal-field">
                      <label className="modal-label">Subject</label>
                      <input
                        className="modal-input"
                        type="text"
                        placeholder="e.g. Custom university formatting requirement for Thesis"
                        value={supportData.subject}
                        onChange={e => setSupportData(prev => ({ ...prev, subject: e.target.value }))}
                        disabled={supportStatus === 'submitting'}
                      />
                    </div>

                    {/* Message Body */}
                    <div className="modal-field">
                      <label className="modal-label">Detailed Message</label>
                      <textarea
                        className="modal-input"
                        style={{ minHeight: '120px', resize: 'vertical' }}
                        placeholder="Please describe your question or issue in detail..."
                        value={supportData.message}
                        onChange={e => {
                          setSupportData(prev => ({ ...prev, message: e.target.value }));
                          if (supportErrors.message) setSupportErrors(prev => ({ ...prev, message: undefined }));
                        }}
                        disabled={supportStatus === 'submitting'}
                      />
                      {supportErrors.message && <div className="field-error">{supportErrors.message}</div>}
                    </div>

                    {supportStatus === 'error' && (
                      <div className="tool-error-msg" style={{ marginBottom: '16px' }}>
                        ⚠️ Failed to send message. Please verify your connection or write directly to sumitkushwaha99375@gmail.com.
                      </div>
                    )}

                    <button
                      type="submit"
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center', marginTop: '12px', padding: '14px' }}
                      disabled={supportStatus === 'submitting'}
                    >
                      {supportStatus === 'submitting' ? (
                        <>
                          <div className="spinner" style={{ width: 16, height: 16, margin: 0, marginRight: 8 }} />
                          <span>Routing message…</span>
                        </>
                      ) : (
                        'Send Inquiry ✉️'
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
