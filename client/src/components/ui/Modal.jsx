import React, { useEffect, useRef } from 'react';

export default function Modal({ isOpen, onClose, title, subtitle, wide = false, children }) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }

        if (e.key === 'Tab' && modalRef.current) {
          const focusable = Array.from(modalRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )).filter((el) => !el.disabled && el.offsetParent !== null);

          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first || !modalRef.current.contains(document.activeElement)) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last || !modalRef.current.contains(document.activeElement)) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      // Focus first autofocus/login input or first focusable
      const focusTimer = setTimeout(() => {
        if (modalRef.current) {
          const target = modalRef.current.querySelector('#login-email') ||
                         modalRef.current.querySelector('[autofocus]') ||
                         modalRef.current.querySelector('input, select, textarea, button');
          if (target) {
            target.focus();
          }
        }
      }, 50);

      return () => {
        clearTimeout(focusTimer);
        window.removeEventListener('keydown', handleKeyDown);
        if (
          previousActiveElement.current &&
          document.body.contains(previousActiveElement.current) &&
          typeof previousActiveElement.current.focus === 'function'
        ) {
          previousActiveElement.current.focus();
        } else {
          const fallbackTrigger = document.querySelector('.hamburger') || document.querySelector('.nav-logo');
          fallbackTrigger?.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div 
        className={`modal-card ${wide ? 'wide' : ''}`}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        {title && <div className="modal-title">{title}</div>}
        {subtitle && <div className="modal-sub">{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}
