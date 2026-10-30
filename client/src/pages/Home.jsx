import React from 'react';
import ToolIcon from '../components/ui/ToolIcon';
import { TOOL_GROUPS } from '../constants/tools';

export default function Home({ navTo }) {
  const handleScrollToTools = () => {
    const el = document.getElementById('tools');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <main className="home-page">
      {/* Hero Section */}
      <section className="hero hero-section">
        <div className="hero-container">
          <div className="hero-left">
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-dot" />
              Professional Document Toolkit
            </div>
            <h1 className="hero-title">
              Your documents,<br />formatted precisely.
            </h1>
            <p className="hero-subtitle">
              Format books, theses, research papers and official letters with exact standards.
              Convert, merge and process files — all in one workspace, completely free.
            </p>
            <div className="hero-actions">
              <button className="btn-primary" onClick={() => navTo('tool')}>
                Start formatting
              </button>
              <button className="btn-secondary" onClick={handleScrollToTools}>
                Browse tools
              </button>
            </div>
            <div className="hero-trust-row">
              <div className="hero-trust-item">
                <span className="hero-trust-icon">✓</span>
                Free to use
              </div>
              <div className="hero-trust-sep" />
              <div className="hero-trust-item">
                <span className="hero-trust-icon">✓</span>
                No account needed
              </div>
              <div className="hero-trust-sep" />
              <div className="hero-trust-item">
                <span className="hero-trust-icon">✓</span>
                Files deleted instantly
              </div>
            </div>
          </div>

          <div className="hero-right">
            <div className="sample-workspace-wrap">
              {/* Decorative background cards */}
              <div className="workspace-sheet-bg sheet-bg-1">
                <div className="sheet-label">Thesis</div>
                <div className="sheet-line line-sm" />
                <div className="sheet-line line-md" />
                <div className="sheet-line line-3q" />
              </div>
              <div className="workspace-sheet-bg sheet-bg-2" />

              {/* Main workspace illustration */}
              <div className="sample-workspace">
                <div className="workspace-top-bar">
                  <div className="workspace-top-bar-left">
                    <div className="workspace-traffic-light" />
                    <div className="workspace-traffic-light" />
                    <div className="workspace-traffic-light" />
                  </div>
                  <span className="workspace-badge">Format Studio</span>
                  <span className="workspace-view-pill">● Live</span>
                </div>
                <div className="workspace-body">
                  <div className="workspace-sidebar">
                    <div className="sidebar-brand">
                      <span className="sidebar-brand-icon">FS</span>
                    </div>
                    <div className="sidebar-item active">
                      <ToolIcon name="file" size={13} />
                    </div>
                    <div className="sidebar-item">
                      <ToolIcon name="grid" size={13} />
                    </div>
                    <div className="sidebar-item">
                      <ToolIcon name="download" size={13} />
                    </div>
                  </div>

                  <div className="workspace-preview">
                    <div className="preview-paper">
                      <div className="paper-header-line" />
                      <div className="paper-tag">RESEARCH PAPER</div>
                      <div className="paper-title">Impact of AI on Academic Writing</div>
                      <div className="paper-author">Kumar, A. · Singh, B. · 2024</div>
                      <div className="paper-divider" />
                      <div className="paper-line line-full" />
                      <div className="paper-line line-full" />
                      <div className="paper-line line-3q" />
                      <div className="paper-line line-full" />
                      <div className="paper-line line-half" />
                    </div>
                  </div>

                  <div className="workspace-panel">
                    <div className="panel-title">Page setup</div>
                    <div className="panel-field">
                      <label className="panel-label">Page size</label>
                      <div className="panel-select">A4 ▾</div>
                    </div>
                    <div className="panel-field">
                      <label className="panel-label">Font</label>
                      <div className="panel-select">Times NR ▾</div>
                    </div>
                    <div className="panel-field">
                      <label className="panel-label">Margins</label>
                      <div className="panel-select">Normal ▾</div>
                    </div>
                    <div className="panel-field-row">
                      <label className="panel-label">Page numbers</label>
                      <div className="panel-switch active"><span className="switch-knob" /></div>
                    </div>
                    <div className="panel-process-btn">Format →</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stats-bar-inner">
          <div className="stat-item">
            <span className="stat-num">14</span>
            <span className="stat-label">Tools available</span>
          </div>
          <div className="stat-sep" />
          <div className="stat-item">
            <span className="stat-num">4</span>
            <span className="stat-label">Document formats</span>
          </div>
          <div className="stat-sep" />
          <div className="stat-item">
            <span className="stat-num">100%</span>
            <span className="stat-label">Rule-based, no AI</span>
          </div>
          <div className="stat-sep" />
          <div className="stat-item">
            <span className="stat-num">0</span>
            <span className="stat-label">File retention</span>
          </div>
        </div>
      </div>

      {/* Tools Section */}
      <section className="tools-section" id="tools">
        <div className="section-container">
          <div className="section-header-center">
            <div className="section-eyebrow">All tools</div>
            <h2 className="section-title">Everything you need for documents</h2>
            <p className="section-subtitle">
              From academic formatting to file conversion — pick the right tool and get it done.
            </p>
          </div>

          {TOOL_GROUPS.map((group) => (
            <div key={group.id} className="tool-group">
              <div className="tool-group-header">
                <h3 className="tool-group-title">{group.label}</h3>
                <p className="tool-group-desc">{group.description}</p>
              </div>
              <div className={`tools-grid tools-grid-${group.id}`}>
                {group.tools.map((tool) => {
                  const accessibleName = `${tool.action}: ${tool.name}`;
                  return (
                    <div
                      key={tool.id}
                      className="tool-card"
                      onClick={() => navTo(tool.target)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navTo(tool.target); }}
                    >
                      <div className="tool-card-icon">
                        <ToolIcon name={tool.id} size={20} />
                      </div>
                      <h4 className="tool-card-title">{tool.name}</h4>
                      <p className="tool-card-desc">{tool.description}</p>
                      <div className="tool-card-footer">
                        <span
                          className="tool-card-btn"
                          aria-label={accessibleName}
                        >
                          {tool.action}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works Section */}
      <section className="workflow-section">
        <div className="section-container">
          <div className="section-header-center">
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">Three steps, done.</h2>
            <p className="section-subtitle">
              No learning curve. No signup required. Upload, configure, download.
            </p>
          </div>

          <div className="workflow-steps">
            <div className="workflow-step">
              <div className="step-badge-wrap">
                <div className="step-num">1</div>
                <div className="step-icon-circle">
                  <ToolIcon name="grid" size={22} />
                </div>
              </div>
              <h3 className="step-title">Choose a tool</h3>
              <p className="step-desc">
                Pick a formatter, converter or merge utility that matches your task.
              </p>
            </div>

            <div className="workflow-connector" />

            <div className="workflow-step">
              <div className="step-badge-wrap">
                <div className="step-num">2</div>
                <div className="step-icon-circle">
                  <ToolIcon name="upload" size={22} />
                </div>
              </div>
              <h3 className="step-title">Upload and configure</h3>
              <p className="step-desc">
                Add your file and adjust the settings — font, margins, page size and more.
              </p>
            </div>

            <div className="workflow-connector" />

            <div className="workflow-step">
              <div className="step-badge-wrap">
                <div className="step-num">3</div>
                <div className="step-icon-circle">
                  <ToolIcon name="download" size={22} />
                </div>
              </div>
              <h3 className="step-title">Download instantly</h3>
              <p className="step-desc">
                Get your formatted or converted file in seconds, ready to submit or publish.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features strip */}
      <section className="features-strip">
        <div className="section-container">
          <div className="features-strip-grid">
            <div className="feature-strip-item">
              <div className="feature-strip-icon">📐</div>
              <div>
                <div className="feature-strip-title">Precision formatting</div>
                <div className="feature-strip-desc">Exact margins, spacing and typography for academic and publishing standards.</div>
              </div>
            </div>
            <div className="feature-strip-item">
              <div className="feature-strip-icon">🌐</div>
              <div>
                <div className="feature-strip-title">Hindi and English</div>
                <div className="feature-strip-desc">KrutiDev, Mangal, Times New Roman and all major fonts supported.</div>
              </div>
            </div>
            <div className="feature-strip-item">
              <div className="feature-strip-icon">⚡</div>
              <div>
                <div className="feature-strip-title">Instant results</div>
                <div className="feature-strip-desc">Direct rule-based engine. No AI queue, no waiting — output in seconds.</div>
              </div>
            </div>
            <div className="feature-strip-item">
              <div className="feature-strip-icon">🔒</div>
              <div>
                <div className="feature-strip-title">Zero file retention</div>
                <div className="feature-strip-desc">Files are processed and deleted immediately. Nothing is stored.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="cta-section">
        <div className="cta-container">
          <div className="cta-label">Get started free</div>
          <h2 className="cta-title">Ready to format your document?</h2>
          <p className="cta-sub">No sign up. No payment. Just upload and format.</p>
          <button className="btn-primary btn-cta" onClick={() => navTo('tool')}>
            Open formatting tool
          </button>
        </div>
      </section>
    </main>
  );
}
