import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Modal from './Modal';

export default function AuthModals({ navTo }) {
  const { modal, closeModal, login, signup, authError, loginWithGoogle, openModal } = useAuth();
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const success = await login(authForm.email, authForm.password);
    if (success) {
      setAuthForm({ name: '', email: '', password: '' });
      navTo('dashboard');
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    const success = await signup(authForm.name, authForm.email, authForm.password);
    if (success) {
      setAuthForm({ name: '', email: '', password: '' });
      navTo('dashboard');
    }
  };

  return (
    <>
      {/* Login Modal */}
      <Modal isOpen={modal === 'login'} onClose={closeModal} title="Welcome back" subtitle="Sign in to your Format Studio account">
        <form onSubmit={handleLoginSubmit}>
          <div className="modal-field">
            <label className="modal-label">Email Address</label>
            <input 
              className="modal-input" 
              type="email" 
              placeholder="you@example.com" 
              required 
              value={authForm.email} 
              onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} 
            />
          </div>
          <div className="modal-field">
            <label className="modal-label">Password</label>
            <input 
              className="modal-input" 
              type="password" 
              placeholder="••••••••" 
              required 
              value={authForm.password} 
              onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} 
            />
          </div>
          {authError && <div className="modal-error">{authError}</div>}
          <button className="modal-submit" type="submit">Sign In →</button>
          <div className="modal-divider">or</div>
          <button type="button" onClick={loginWithGoogle} className="modal-google-btn">
            <img src="https://www.google.com/favicon.ico" width="18" height="18" alt="Google" />
            Continue with Google
          </button>
          <div className="modal-switch">No account? <button type="button" onClick={() => openModal('signup')}>Create one</button></div>
        </form>
      </Modal>

      {/* Signup Modal */}
      <Modal isOpen={modal === 'signup'} onClose={closeModal} title="Create account" subtitle="Join Format Studio — free to start">
        <form onSubmit={handleSignupSubmit}>
          <div className="modal-field">
            <label className="modal-label">Full Name</label>
            <input 
              className="modal-input" 
              type="text" 
              placeholder="Your name" 
              required 
              value={authForm.name} 
              onChange={e => setAuthForm(p => ({ ...p, name: e.target.value }))} 
            />
          </div>
          <div className="modal-field">
            <label className="modal-label">Email Address</label>
            <input 
              className="modal-input" 
              type="email" 
              placeholder="you@example.com" 
              required 
              value={authForm.email} 
              onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} 
            />
          </div>
          <div className="modal-field">
            <label className="modal-label">Password</label>
            <input 
              className="modal-input" 
              type="password" 
              placeholder="Min. 8 characters" 
              required 
              value={authForm.password} 
              onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} 
            />
          </div>
          {authError && <div className="modal-error">{authError}</div>}
          <button className="modal-submit" type="submit">Create Account →</button>
          <div className="modal-divider">or</div>
          <button type="button" onClick={loginWithGoogle} className="modal-google-btn">
            <img src="https://www.google.com/favicon.ico" width="18" height="18" alt="Google" />
            Continue with Google
          </button>
          <div className="modal-switch">Already have one? <button type="button" onClick={() => openModal('login')}>Sign in</button></div>
        </form>
      </Modal>
    </>
  );
}
