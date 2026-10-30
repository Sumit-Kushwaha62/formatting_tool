import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../theme/useTheme';
import { MONETIZATION_ENABLED } from '../../config/features';

export default function Navbar({ page, navTo, menuOpen, setMenuOpen }) {
  const { user, openModal } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsButtonRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleTools = () => setToolsOpen(!toolsOpen);

  const handleToolSelect = (target) => {
    setToolsOpen(false);
    navTo(target);
  };

  const handleToolsKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setToolsOpen(false);
      toolsButtonRef.current?.focus();
    }
  };

  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`} aria-label="Primary navigation">
      <div 
        className="nav-logo" 
        onClick={() => navTo('home')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navTo('home');
          }
        }}
        aria-label="Format Studio — Home"
      >
        <img 
          src="/logo.png" 
          alt="Format Studio logo" 
          className="nav-logo-img" 
          width="32" 
          height="32" 
        />
        <div>
          <div className="nav-logo-text">Format Studio</div>
        </div>
      </div>
      
      <div className="nav-spacer" />
      
      <div className="nav-links">
        <button 
          className={`nav-link ${page === 'home' ? 'active' : ''}`} 
          onClick={() => navTo('home')}
        >
          Home
        </button>
        
        <div 
          className="nav-dropdown-wrap"
          onKeyDown={handleToolsKeyDown}
        >
          <button 
            ref={toolsButtonRef}
            className={`nav-link ${toolsOpen ? 'active' : ''}`}
            onClick={toggleTools}
            aria-expanded={toolsOpen}
            aria-haspopup="true"
          >
            Tools <span aria-hidden="true" style={{ fontSize: 10, marginLeft: 4 }}>▾</span>
          </button>
          {toolsOpen && (
            <div className="nav-mega-dropdown" id="desktop-tools-menu" role="menu">
              <div className="dropdown-col">
                <div className="dropdown-section-label">Format Documents</div>
                <button onClick={() => handleToolSelect('tool')}>Book</button>
                <button onClick={() => handleToolSelect('tool')}>Thesis</button>
                <button onClick={() => handleToolSelect('tool')}>Research Paper</button>
                <button onClick={() => handleToolSelect('tool')}>Letter / Notice</button>
              </div>
              <div className="dropdown-col">
                <div className="dropdown-section-label">Convert & Merge</div>
                <button onClick={() => handleToolSelect('merge-pdf')}>Merge PDF</button>
                <button onClick={() => handleToolSelect('compress-pdf')}>Compress PDF</button>
                <button onClick={() => handleToolSelect('merge-word')}>Merge Word</button>
                <button onClick={() => handleToolSelect('pdf-to-word')}>PDF to Word</button>
                <button onClick={() => handleToolSelect('excel-to-pdf')}>Excel to PDF</button>
                <button onClick={() => handleToolSelect('hindi-to-krutidev')}>Hindi to KrutiDev</button>
                <button onClick={() => handleToolSelect('compress-image')}>Image Compressor</button>
                <button onClick={() => handleToolSelect('remove-bg')}>Background Remover</button>
                <button onClick={() => handleToolSelect('unlock-pdf')}>Unlock PDF</button>
              </div>
            </div>
          )}
        </div>

        {MONETIZATION_ENABLED && (
          <button 
            className={`nav-link ${page === 'pricing' ? 'active' : ''}`} 
            onClick={() => navTo('pricing')}
          >
            Pricing
          </button>
        )}
        <button 
          className={`nav-link ${page === 'contact' ? 'active' : ''}`} 
          onClick={() => navTo('contact')}
        >
          Contact
        </button>
        <div className="nav-divider" />

        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        
        {user ? (
          <>
            <button 
              className={`nav-link ${page === 'dashboard' ? 'active' : ''}`} 
              onClick={() => navTo('dashboard')}
            >
              My Account
            </button>
            <div 
              className="nav-user-dot" 
              onClick={() => navTo('dashboard')} 
              title={`Logged in as ${user.name}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navTo('dashboard');
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          </>
        ) : (
          <>
            <button className="nav-btn-ghost" onClick={() => openModal('login')}>
              Log in
            </button>
            <button className="nav-btn-solid" onClick={() => openModal('signup')}>
              Sign up
            </button>
          </>
        )}
      </div>

      <div className="nav-mobile-actions">
        <button
          className="theme-toggle-btn mobile-theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button 
          className="hamburger" 
          onClick={() => setMenuOpen(!menuOpen)} 
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </nav>
  );
}
