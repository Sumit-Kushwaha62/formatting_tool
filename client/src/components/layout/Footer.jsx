import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function Footer({ navTo }) {
  const { openModal } = useAuth();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div>
            <div className="footer-brand-name">Format Studio</div>
            <div className="footer-brand-tag">Edwin Incorporation</div>
            <div className="footer-brand-desc">
              Professional document formatting for academic, publishing and official use. Built for precision.
            </div>
          </div>
          <div>
            <div className="footer-col-title">Product</div>
            <ul className="footer-links">
              <li className="footer-link" onClick={() => navTo('tool')}>Format Tool</li>
              <li className="footer-link" onClick={() => navTo('pricing')}>Pricing</li>
              <li className="footer-link" onClick={() => {
                navTo('home');
                setTimeout(() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}>Features</li>
            </ul>
          </div>
          <div>
            <div className="footer-col-title">Support</div>
            <ul className="footer-links">
              <li className="footer-link">Documentation</li>
              <li className="footer-link" onClick={() => navTo('contact')}>Contact Us</li>
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
          <div className="footer-copy">
            © {new Date().getFullYear()} Edwin Incorporation — All Rights Reserved
          </div>
          <div className="footer-legal">
            <span className="footer-legal-link" onClick={() => openModal('licence')}>Licence Agreement</span>
            <span className="footer-legal-link">Privacy</span>
            <span className="footer-legal-link">Terms</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
