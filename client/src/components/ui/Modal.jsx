import React from 'react';

export default function Modal({ isOpen, onClose, title, subtitle, wide = false, children }) {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className={`modal-card ${wide ? 'wide' : ''}`}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        {title && <div className="modal-title">{title}</div>}
        {subtitle && <div className="modal-sub">{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}
