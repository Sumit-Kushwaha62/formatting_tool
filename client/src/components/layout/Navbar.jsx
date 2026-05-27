import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function Navbar({ page, navTo, menuOpen, setMenuOpen }) {
  const { user, logout, openModal } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleFeaturesClick = () => {
    setMenuOpen(false);
    navTo('home');
    setTimeout(() => {
      document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-logo" onClick={() => navTo('home')}>
        <div className="nav-logo-mark">FS</div>
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
        <button className="nav-link" onClick={handleFeaturesClick}>
          Features
        </button>
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
            <button className="nav-logout" onClick={logout}>
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
