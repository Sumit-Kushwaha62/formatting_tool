import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function Profile({ navTo }) {
  const { user, deleteAccount } = useAuth();
  
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    org: ''
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState('idle');

  const saveProfile = () => {
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm('Delete your account and all associated data? This action cannot be undone.');
    if (!confirmed) return;

    setDeleteStatus('deleting');
    const deleted = await deleteAccount();
    if (deleted) {
      navTo('home');
      return;
    }
    setDeleteStatus('error');
  };

  return (
    <>
      <div className="dash-page-title">Profile</div>
      <div className="dash-page-sub">Manage your account information and security.</div>
      
      <div className="dash-section-title">Profile Information</div>
      <div className="profile-form">
        <div className="profile-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
        <div className="profile-grid">
          {[
            { key: 'name', label: 'Full Name', placeholder: 'Your name', type: 'text' },
            { key: 'email', label: 'Email Address', placeholder: 'you@example.com', type: 'email' },
            { key: 'phone', label: 'Phone Number', placeholder: '+91 00000 00000', type: 'text' },
            { key: 'org', label: 'Organization / University', placeholder: 'e.g. IIT Delhi', type: 'text' },
          ].map(f => (
            <div className="field-group" key={f.key}>
              <label className="field-label">{f.label}</label>
              <input 
                className="field-input" 
                type={f.type} 
                placeholder={f.placeholder}
                value={profileForm[f.key]} 
                onChange={e => setProfileForm(p => ({ ...p, [f.key]: e.target.value }))} 
              />
            </div>
          ))}
        </div>
        <div className="divider" />
        <div className="btn-row">
          <button className="btn-primary" onClick={saveProfile}>
            {profileSaved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>
      
      <div className="dash-section-title" style={{ marginTop: 24 }}>Security</div>
      <div className="profile-form" style={{ marginBottom: 0 }}>
        <div className="field-group" style={{ maxWidth: 360 }}>
          <label className="field-label">New Password</label>
          <input className="field-input" type="password" placeholder="Min. 8 characters" />
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn-secondary" style={{ minHeight: '44px' }}>Update Password</button>
        </div>
      </div>
      
      <div className="danger-zone">
        <div className="danger-title">Danger Zone</div>
        <div className="danger-desc">Permanently delete your account and all associated data. This action cannot be undone.</div>
        <button className="btn-danger" onClick={handleDeleteAccount} disabled={deleteStatus === 'deleting'}>
          {deleteStatus === 'deleting' ? 'Deleting...' : 'Delete Account'}
        </button>
        {deleteStatus === 'error' && (
          <div className="modal-error" style={{ marginTop: 12 }}>Could not delete account. Please try again.</div>
        )}
      </div>
    </>
  );
}
