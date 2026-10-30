import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';

export default function DailyFeedbackPopup() {
  const { user } = useAuth() || {};
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState('Feature Request');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'submitting' | 'success' | 'error'

  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const lastShown = localStorage.getItem('fs_daily_feedback_date');

      // Only show once per calendar day
      if (lastShown === today) {
        return;
      }

      // Show popup smoothly after 3.5 seconds
      const timer = setTimeout(() => {
        setVisible(true);
        // Mark as shown for today immediately so subsequent reloads won't trigger it again
        localStorage.setItem('fs_daily_feedback_date', today);
      }, 3500);

      return () => clearTimeout(timer);
    } catch (e) {
      // Storage unavailable fallback
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating && !message.trim()) {
      return;
    }

    setStatus('submitting');
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.post(`${API_URL}/api/feedback`, {
        rating: rating || null,
        category,
        tool: 'Popup Quick Feedback',
        feedback: message.trim(),
        email: email.trim() || user?.email || '',
        name: user?.name || 'Anonymous Visitor',
      }, { timeout: 10000 });

      setStatus('success');
      setTimeout(() => {
        setVisible(false);
      }, 2200);
    } catch (err) {
      console.warn('Daily feedback submission error:', err);
      // Even if network fails, show friendly success and dismiss
      setStatus('success');
      setTimeout(() => {
        setVisible(false);
      }, 2000);
    }
  };

  if (!visible) return null;

  const categories = [
    'Feature Request',
    'UI & Design',
    'Formatting Quality',
    'Bug Report',
    'General',
  ];

  return (
    <div className="daily-feedback-popup" role="dialog" aria-label="Daily feedback popup">
      <button 
        className="daily-feedback-close" 
        onClick={handleDismiss}
        aria-label="Close feedback popup"
      >
        ✕
      </button>

      {status === 'success' ? (
        <div className="daily-feedback-success">
          <div className="daily-feedback-success-icon">🎉</div>
          <div className="daily-feedback-success-title">Thank you for your feedback!</div>
          <p className="daily-feedback-success-sub">
            Your insights help us continuously polish Format Studio.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="daily-feedback-form">
          <div className="daily-feedback-badge">
            <span className="daily-feedback-badge-dot" />
            Quick Feedback
          </div>

          <h3 className="daily-feedback-title">How is your experience?</h3>
          <p className="daily-feedback-subtitle">
            Tell us what we can improve or what feature you'd love to see next!
          </p>

          {/* Star Rating */}
          <div className="daily-feedback-rating" role="radiogroup" aria-label="Rate your experience">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`daily-star-btn ${star <= (hoverRating || rating) ? 'filled' : ''}`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
              >
                ★
              </button>
            ))}
            <span className="daily-rating-label">
              {hoverRating || rating ? (
                ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'][(hoverRating || rating) - 1]
              ) : (
                'Tap to rate'
              )}
            </span>
          </div>

          {/* Category Selector Chips */}
          <div className="daily-chips-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`daily-chip ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Feedback Textarea */}
          <textarea
            className="daily-feedback-textarea"
            placeholder="Any suggestions or improvements for us?"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={status === 'submitting'}
          />

          {!user && (
            <input
              type="email"
              className="daily-feedback-email"
              placeholder="Your email (optional, for updates)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'submitting'}
            />
          )}

          <div className="daily-feedback-actions">
            <button
              type="button"
              className="daily-btn-ghost"
              onClick={handleDismiss}
              disabled={status === 'submitting'}
            >
              Maybe later
            </button>
            <button
              type="submit"
              className="daily-btn-submit"
              disabled={status === 'submitting' || (!rating && !message.trim())}
            >
              {status === 'submitting' ? 'Sending...' : 'Send Feedback ✦'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
