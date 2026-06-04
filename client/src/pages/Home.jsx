import React from 'react';
import { FEATURES, DOC_TYPES } from '../constants/data';

export default function Home({ navTo }) {
  return (
    <>
      {/* Hero */}
      <section className="hero">
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
              <div className="hero-stat-label">Accuracy</div>
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
      <section className="section" id="features">
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
              <div className="doc-type-card" key={t.id} onClick={() => navTo('tool')}>
                <div className="doc-type-tag">{t.tag}</div>
                <div className="doc-type-icon">{t.icon}</div>
                <div className="doc-type-name">{t.label}</div>
                <div className="doc-type-desc">{t.desc}</div>
              </div>
            ))}
            
            <div className="doc-type-card" onClick={() => navTo('merge-pdf')}>
              <div className="doc-type-tag">Convert</div>
              <div className="doc-type-icon">🔗</div>
              <div className="doc-type-name">Merge PDF</div>
              <div className="doc-type-desc">Combine multiple PDF files into a single document</div>
            </div>

            <div className="doc-type-card" onClick={() => navTo('merge-word')}>
              <div className="doc-type-tag">Convert</div>
              <div className="doc-type-icon">📝</div>
              <div className="doc-type-name">Merge Word</div>
              <div className="doc-type-desc">Merge multiple Word documents into one file</div>
            </div>

            <div className="doc-type-card" onClick={() => navTo('pdf-to-word')}>
              <div className="doc-type-tag">Convert</div>
              <div className="doc-type-icon">🔄</div>
              <div className="doc-type-name">PDF → Word</div>
              <div className="doc-type-desc">Convert PDF documents into editable Word files</div>
            </div>

            <div className="doc-type-card" onClick={() => navTo('excel-to-pdf')}>
              <div className="doc-type-tag">Convert</div>
              <div className="doc-type-icon">📊</div>
              <div className="doc-type-name">Excel → PDF</div>
              <div className="doc-type-desc">Convert Excel spreadsheets into professional PDFs</div>
            </div>
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
  );
}
