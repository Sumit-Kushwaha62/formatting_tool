import React, { useState } from 'react';
import axios from 'axios';

export default function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle'); // 'idle' | 'submitting' | 'success' | 'error'

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    
    setStatus('submitting');
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.post(`${API_URL}/contact`, formData);
      setStatus('success');
      setFormData({ name: '', email: '', message: '' });
    } catch (err) {
      console.error('Contact Form Error:', err);
      setStatus('error');
    }
  };

  return (
    <div className="contact-page">
      <div className="contact-card">
        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '50px', marginBottom: '20px' }}>✉️</div>
            <div className="modal-title" style={{ color: 'var(--navy)' }}>Message Sent!</div>
            <p className="modal-sub" style={{ marginTop: '12px', fontSize: '15px', lineHeight: '1.6' }}>
              Thank you for contacting Format Studio. Your message has been sent successfully to <strong>care@edwinepc.com</strong>. We will get back to you shortly.
            </p>
            <button className="btn-primary" style={{ marginTop: '24px' }} onClick={() => setStatus('idle')}>
              Send Another Message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-title" style={{ fontSize: '28px', marginBottom: '8px', color: 'var(--navy)' }}>
              Contact Us
            </div>
            <p className="modal-sub" style={{ marginBottom: '28px', fontSize: '14px' }}>
              Have questions or feedback? Send us a message and we'll respond within 24 hours.
            </p>

            <div className="modal-field">
              <label className="modal-label">Full Name</label>
              <input 
                className="modal-input" 
                type="text" 
                placeholder="e.g. Rahul Sharma" 
                required 
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                disabled={status === 'submitting'}
              />
            </div>

            <div className="modal-field">
              <label className="modal-label">Email Address</label>
              <input 
                className="modal-input" 
                type="email" 
                placeholder="e.g. rahul@gmail.com" 
                required 
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                disabled={status === 'submitting'}
              />
            </div>

            <div className="modal-field">
              <label className="modal-label">Message</label>
              <textarea 
                className="modal-input" 
                style={{ minHeight: '120px', resize: 'vertical', padding: '12px 14px' }}
                placeholder="Write your query here..." 
                required 
                value={formData.message}
                onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                disabled={status === 'submitting'}
              />
            </div>

            {status === 'error' && (
              <div className="modal-error" style={{ marginBottom: '16px' }}>
                ⚠️ Failed to send message. Please check your internet connection and try again.
              </div>
            )}

            <button 
              type="submit" 
              className="modal-submit" 
              style={{ padding: '14px', fontWeight: '500' }}
              disabled={status === 'submitting'}
            >
              {status === 'submitting' ? 'Sending Message...' : 'Send Message →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
