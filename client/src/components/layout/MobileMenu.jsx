import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { MONETIZATION_ENABLED } from '../../config/features';

export default function MobileMenu({ isOpen, navTo, setMenuOpen }) {
  const { user, openModal } = useAuth();
  const [toolsExpanded, setToolsExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setToolsExpanded(false);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuOpen(false);
        const hamburger = document.querySelector('.hamburger');
        hamburger?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setMenuOpen]);

  if (!isOpen) return null;

  const handleNav = (targetPage) => {
    setMenuOpen(false);
    navTo(targetPage);
  };

  const handleAuth = (type) => {
    setMenuOpen(false);
    openModal(type);
  };

  return (
    <div className="mobile-menu" id="mobile-navigation">
      <button className="nav-link" onClick={() => handleNav('home')}>
        Home
      </button>

      <div className="mobile-tools-accordion">
        <button 
          className="nav-link mobile-tools-trigger" 
          onClick={() => setToolsExpanded(!toolsExpanded)}
          aria-expanded={toolsExpanded}
        >
          Tools <span aria-hidden="true" style={{ fontSize: 10, marginLeft: 4 }}>{toolsExpanded ? '▴' : '▾'}</span>
        </button>
        {toolsExpanded && (
          <div className="mobile-tools-list" id="mobile-tools-list">
            <button onClick={() => handleNav('tool')}>Book</button>
            <button onClick={() => handleNav('tool')}>Thesis</button>
            <button onClick={() => handleNav('tool')}>Research Paper</button>
            <button onClick={() => handleNav('tool')}>Letter / Notice</button>
            <button onClick={() => handleNav('merge-pdf')}>Merge PDF</button>
            <button onClick={() => handleNav('compress-pdf')}>Compress PDF</button>
            <button onClick={() => handleNav('merge-word')}>Merge Word</button>
            <button onClick={() => handleNav('pdf-to-word')}>PDF to Word</button>
            <button onClick={() => handleNav('excel-to-pdf')}>Excel to PDF</button>
            <button onClick={() => handleNav('hindi-to-krutidev')}>Hindi to KrutiDev</button>
            <button onClick={() => handleNav('compress-image')}>Image Compressor</button>
            <button onClick={() => handleNav('remove-bg')}>Background Remover</button>
            <button onClick={() => handleNav('unlock-pdf')}>Unlock PDF</button>
          </div>
        )}
      </div>

      {MONETIZATION_ENABLED && (
        <button className="nav-link" onClick={() => handleNav('pricing')}>
          Pricing
        </button>
      )}
      <button className="nav-link" onClick={() => handleNav('contact')}>
        Contact
      </button>
      
      {user ? (
        <button className="nav-link" onClick={() => handleNav('dashboard')}>
          My Account
        </button>
      ) : (
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button className="nav-btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleAuth('login')}>
            Log in
          </button>
          <button className="nav-btn-solid" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleAuth('signup')}>
            Sign up
          </button>
        </div>
      )}
    </div>
  );
}
