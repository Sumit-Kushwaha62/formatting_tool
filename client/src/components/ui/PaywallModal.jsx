import React from 'react';
import { usePayment } from '../../hooks/usePayment';

export default function PaywallModal({ isOpen, onClose }) {
  const { handlePayment } = usePayment();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '440px', padding: '40px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <div className="modal-title" style={{ fontSize: '24px', color: 'var(--navy)' }}>Upgrade to Pro</div>
        <div className="modal-sub" style={{ margin: '8px 0 24px', lineHeight: '1.6' }}>
          You have formatted 3 documents on your free plan. Upgrade to the <strong>Professional Plan</strong> for unlimited access.
        </div>

        <div style={{ background: 'var(--bg2)', padding: '16px 20px', borderRadius: 'var(--r-md)', textAlign: 'left', marginBottom: '24px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 'bold' }}>Unlocked with Pro</div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li style={{ fontSize: '13px', display: 'flex', gap: '8px', color: 'var(--text2)' }}>
              <span style={{ color: 'var(--green)' }}>✓</span> <strong>Unlimited</strong> document formatting
            </li>
            <li style={{ fontSize: '13px', display: 'flex', gap: '8px', color: 'var(--text2)' }}>
              <span style={{ color: 'var(--green)' }}>✓</span> Full Hindi & English font support
            </li>
            <li style={{ fontSize: '13px', display: 'flex', gap: '8px', color: 'var(--text2)' }}>
              <span style={{ color: 'var(--green)' }}>✓</span> Pre-configured academic templates
            </li>
            <li style={{ fontSize: '13px', display: 'flex', gap: '8px', color: 'var(--text2)' }}>
              <span style={{ color: 'var(--green)' }}>✓</span> Priority processing & email support
            </li>
          </ul>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '32px', fontFamily: "'EB Garamond', serif", fontWeight: '600', color: 'var(--navy)' }}>₹199</span>
          <span style={{ fontSize: '14px', color: 'var(--text3)', marginLeft: '4px' }}>/ month</span>
        </div>

        <button 
          className="modal-submit" 
          onClick={() => handlePayment(onClose)}
          style={{ width: '100%', padding: '14px', fontWeight: '600', letterSpacing: '0.02em', background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: 'var(--r-sm)' }}
        >
          Activate Pro Plan — ₹199 →
        </button>

        <button 
          onClick={onClose} 
          style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '13px', marginTop: '16px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}
