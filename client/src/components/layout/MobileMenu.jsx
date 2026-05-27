import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function MobileMenu({ isOpen, navTo, setMenuOpen }) {
  const { user, logout, openModal } = useAuth();

  if (!isOpen) return null;

  const handleNav = (targetPage) => {
    setMenuOpen(false);
    navTo(targetPage);
  };

  const handleLicence = () => {
    setMenuOpen(false);
    openModal('licence');
  };

  const handleAuth = (type) => {
    setMenuOpen(false);
    openModal(type);
  };

  return (
    <div className="mobile-menu">
      <button className="nav-link" onClick={() => handleNav('home')}>Home</button>
      <button className="nav-link" onClick={() => handleNav('pricing')}>Pricing</button>
      <button className="nav-link" onClick={() => handleNav('contact')}>Contact</button>
      <button className="nav-link" onClick={handleLicence}>Licence</button>
      
      {user ? (
        <>
          <button className="nav-link" onClick={() => handleNav('dashboard')}>My Account</button>
          <button 
            className="nav-logout" 
            style={{ alignSelf: 'flex-start', marginTop: '8px', minHeight: '44px', display: 'flex', alignItems: 'center' }} 
            onClick={() => { logout(); setMenuOpen(false); }}
          >
            Logout
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button className="nav-btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleAuth('login')}>
            Login
          </button>
          <button className="nav-btn-solid" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleAuth('signup')}>
            Sign Up
          </button>
        </div>
      )}
    </div>
  );
}
