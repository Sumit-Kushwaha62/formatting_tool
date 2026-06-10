import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import logo from '../../assets/logo.png';

export default function Navbar({ page, navTo, menuOpen, setMenuOpen }) {
  const { user, logout, openModal } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navTo('home');
  };

  const handleMouseEnter = () => setToolsOpen(true);
  const handleMouseLeave = () => setToolsOpen(false);
  const toggleTools = () => setToolsOpen(!toolsOpen);

  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-logo" onClick={() => navTo('home')}>
        {/* <img src={logo} alt="Format Studio" style={{ height: 32, width: 'auto' }} /> */}
        <div>
          <div className="nav-logo-text">Format Studio</div>
          <div className="nav-logo-sub">Edwin Incorporation</div>
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
          onMouseEnter={handleMouseEnter} 
          onMouseLeave={handleMouseLeave}
        >
          <button 
            className={`nav-link ${toolsOpen ? 'active' : ''}`}
            onClick={toggleTools}
          >
            Tools <span style={{ fontSize: 10, marginLeft: 4 }}>▾</span>
          </button>
          {toolsOpen && (
            <div className="nav-mega-dropdown" onMouseEnter={handleMouseEnter}>
              <div className="dropdown-col">
                <div className="dropdown-section-label">Format Documents</div>
                <button onClick={() => { navTo('tool'); setToolsOpen(false); }}>📖 Book</button>
                <button onClick={() => { navTo('tool'); setToolsOpen(false); }}>🎓 Thesis</button>
                <button onClick={() => { navTo('tool'); setToolsOpen(false); }}>🔬 Research Paper</button>
                <button onClick={() => { navTo('tool'); setToolsOpen(false); }}>✉️ Letter / Notice</button>
              </div>
              <div className="dropdown-col">
                <div className="dropdown-section-label">Convert & Merge</div>
                <button onClick={() => { navTo('merge-pdf'); setToolsOpen(false); }}>🔗 Merge PDF</button>
                <button onClick={() => { navTo('merge-word'); setToolsOpen(false); }}>📝 Merge Word</button>
                <button onClick={() => { navTo('pdf-to-word'); setToolsOpen(false); }}>🔄 PDF → Word</button>
                <button onClick={() => { navTo('excel-to-pdf'); setToolsOpen(false); }}>📊 Excel → PDF</button>
              </div>
            </div>
          )}
        </div>

        <button 
          className={`nav-link ${page === 'pricing' ? 'active' : ''}`} 
          onClick={() => navTo('pricing')}
        >
          Pricing
        </button>
        <button 
          className={`nav-link ${page === 'contact' ? 'active' : ''}`} 
          onClick={() => navTo('contact')}
        >
          Contact
        </button>
        <button className="nav-link" onClick={() => openModal('licence')}>
          Licence
        </button>
        
        <div className="nav-divider" />
        
        {user ? (
          <>
            <button 
              className={`nav-link ${page === 'dashboard' ? 'active' : ''}`} 
              onClick={() => navTo('dashboard')}
            >
              My Account
            </button>
            <div className="nav-user-dot">{user.name.charAt(0).toUpperCase()}</div>
            <button className="nav-logout" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <button className="nav-btn-ghost" onClick={() => openModal('login')}>
              Login
            </button>
            <button className="nav-btn-solid" onClick={() => openModal('signup')}>
              Sign Up
            </button>
          </>
        )}
      </div>

      <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
        <span />
        <span />
        <span />
      </button>
    </nav>
  );
}
