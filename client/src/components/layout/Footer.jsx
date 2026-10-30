import React from 'react';
import { MONETIZATION_ENABLED } from '../../config/features';

export default function Footer({ navTo }) {
  const handleScrollToTools = () => {
    navTo('home');
    setTimeout(() => {
      document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand-col">
            <div className="footer-brand-header">
              <img 
                src="/logo.png" 
                alt="Format Studio logo" 
                className="footer-logo-img" 
                width="28" 
                height="28" 
              />
              <div className="footer-brand-name">Format Studio</div>
            </div>
            <p className="footer-brand-desc">
              High-precision document formatting, conversion, and merging engine engineered for academic research, publishing, and institutional standards.
            </p>
            <div className="footer-status-pill">
              <span className="status-dot-pulse" />
              <span>Rule-based engine • Zero retention</span>
              

            </div>
          </div>

          <div className="footer-links-col">
            <div className="footer-col-title">Tools & Utilities</div>
            <ul className="footer-links">
              <li>
                <button className="footer-link" onClick={() => navTo('tool')}>Book & Thesis Formatter</button>
              </li>
              <li>
                <button className="footer-link" onClick={() => navTo('tool')}>Research Paper Standard</button>
              </li>
              <li>
                <button className="footer-link" onClick={() => navTo('pdf-to-word')}>PDF to Word</button>
              </li>
              <li>
                <button className="footer-link" onClick={() => navTo('merge-pdf')}>Merge PDF Files</button>
              </li>
              <li>
                <button className="footer-link" onClick={() => navTo('compress-pdf')}>Compress PDF</button>
              </li>
              <li>
                <button className="footer-link" onClick={() => navTo('merge-word')}>Merge Word Documents</button>
              </li>
              <li>
                <button className="footer-link" onClick={() => navTo('hindi-to-krutidev')}>Hindi to KrutiDev</button>
              </li>
              <li>
                <button className="footer-link" onClick={() => navTo('compress-image')}>Image Compressor</button>
              </li>
              <li>
                <button className="footer-link" onClick={() => navTo('remove-bg')}>Background Remover</button>
              </li>
              <li>
                <button className="footer-link" onClick={() => navTo('unlock-pdf')}>Unlock PDF</button>
              </li>
            </ul>
          </div>

          <div className="footer-links-col">
            <div className="footer-col-title">Platform</div>
            <ul className="footer-links">
              <li>
                <button className="footer-link" onClick={() => navTo('home')}>Home</button>
              </li>
              <li>
                <button className="footer-link" onClick={handleScrollToTools}>All Tools</button>
              </li>
              {MONETIZATION_ENABLED && (
                <li>
                  <button className="footer-link" onClick={() => navTo('pricing')}>Pricing & Plans</button>
                </li>
              )}
              <li>
                <button className="footer-link" onClick={() => navTo('contact')}>Contact & Support</button>
              </li>
              <li>
                <button className="footer-link" onClick={() => navTo('admin')} style={{ opacity: 0.85 }}>⚡ Admin Console</button>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-copy">
            © 2026 Format Studio. All rights reserved. Made with 💖 by Sumit Kushwaha!!
          </div>
          <div className="footer-badges">
            <span className="footer-badge-item">100% Client-Side Privacy</span>
            <span className="footer-badge-dot">•</span>
            <span className="footer-badge-item">Instant File Deletion</span>
            <span className="footer-badge-dot">•</span>
            <button className="footer-admin-btn" onClick={() => navTo('admin')} title="Operational Telemetry & Management">
              ⚡ Admin Portal
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
