import React, { useState } from 'react';
import Modal from './Modal';

export default function AIMagicModal({ isOpen, onClose, onApply }) {
  const [docType, setDocType] = useState('book');
  const [userPrompt, setUserPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleApply = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/ai-suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType, userPrompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get suggestions');
      }

      onApply({ docType, options: data.options });
      onClose();
    } catch (err) {
      console.error('AI Magic Error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="✨ AI Magic" 
      subtitle="Let AI configure the perfect formatting settings for you."
    >
      <div style={{ padding: '0 4px' }}>
        <div className="field-group" style={{ marginBottom: 20 }}>
          <label className="field-label">Document Type</label>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {['book', 'thesis', 'letter'].map((type) => (
              <label 
                key={type} 
                style={{ 
                  flex: 1, 
                  textAlign: 'center', 
                  padding: '10px', 
                  border: `1px solid ${docType === type ? 'var(--navy)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-sm)',
                  cursor: 'pointer',
                  background: docType === type ? 'var(--navy)' : 'var(--surface)',
                  color: docType === type ? 'var(--bg)' : 'var(--text)',
                  fontSize: '13px',
                  fontWeight: '500',
                  textTransform: 'capitalize',
                  transition: 'all 0.2s'
                }}
              >
                <input 
                  type="radio" 
                  name="docType" 
                  value={type} 
                  checked={docType === type} 
                  onChange={() => setDocType(type)}
                  style={{ display: 'none' }}
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        <div className="field-group" style={{ marginBottom: 20 }}>
          <label className="field-label">
            Describe your needs <span className="field-opt">Optional</span>
          </label>
          <textarea 
            className="field-input" 
            placeholder="e.g. 'I want a classic book layout with large margins and serif font' or 'A professional academic thesis with 1.5 line spacing'..."
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            style={{ minHeight: '100px', resize: 'vertical', paddingTop: '10px' }}
          />
        </div>

        {error && (
          <div style={{ 
            color: 'var(--red)', 
            fontSize: '13px', 
            marginBottom: '16px', 
            padding: '10px', 
            background: 'rgba(192,57,43,0.05)', 
            borderRadius: 'var(--r-sm)',
            border: '1px solid rgba(192,57,43,0.1)'
          }}>
            {error}
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 24 }}>
          <button 
            className="btn-primary" 
            style={{ flex: 1, justifyContent: 'center' }} 
            onClick={handleApply}
            disabled={loading}
          >
            {loading ? <div className="spinner" style={{ width: 18, height: 18, margin: 0 }} /> : 'Apply Settings'}
          </button>
          <button 
            className="btn-secondary" 
            style={{ flex: 1, justifyContent: 'center' }} 
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
