import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import Modal from './Modal';
import edwincover from '../../assets/edwin_inc_cover.jpeg';

export default function LicenceModal() {
  const { modal, closeModal } = useAuth();

  return (
    <Modal isOpen={modal === 'licence'} onClose={closeModal} title="Licence Agreement" subtitle="Edwin Incorporation — Confidential & Proprietary" wide={true}>
      <img src={edwincover} alt="Edwin Incorporation" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 20 }} />
      {[
        ['Company Policies', 'This software is the exclusive property of Edwin Incorporation. Employees are granted a non-exclusive, non-transferable licence for company-related use only.'],
        ['Confidentiality', 'All data processed — client information, strategies, financial data, proprietary algorithms — is strictly confidential. Violation leads to immediate legal action.'],
        ['Intellectual Property', 'Source code, design, UI elements, trademarks and all associated IP belong solely to Edwin Incorporation. No outputs ownership rights.'],
        ['Usage Restrictions', 'Do not reverse engineer, decompile, share credentials, remove copyright notices, or use the software outside assigned duties.'],
        ['Data & Privacy', 'User data is handled per applicable privacy laws. Activity logs may be monitored. No personal data sold. Retention: 5 years.'],
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
    </Modal>
  );
}
