import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';

export default function Profile({ navTo }) {
  const { user, deleteAccount } = useAuth();
  
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    org: ''
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [deleteStatus, setDeleteStatus] = useState('idle');

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [pwStatus, setPwStatus] = useState('idle'); // 'idle' | 'saving' | 'done' | 'error'
  const [pwError, setPwError] = useState('');

  // Load existing profile data from Supabase on mount
  useEffect(() => {
    if (!user?.id) return;

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, phone, org')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setProfileForm({
          name: data.name || user?.name || '',
          email: user?.email || '',
          phone: data.phone || '',
          org: data.org || '',
        });
      } else {
        // Fallback to auth user data
        setProfileForm({
          name: user?.name || '',
          email: user?.email || '',
          phone: '',
          org: '',
        });
      }
    };

    loadProfile();
  }, [user?.id]);

  // Fix #3: Wire Save Profile to Supabase profiles table
  const saveProfile = async () => {
    if (!user?.id) return;

    setProfileSaving(true);
    setProfileError('');
    setProfileSaved(false);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profileForm.name.trim(),
          phone: profileForm.phone.trim(),
          org: profileForm.org.trim(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Profile update error:', error);
        setProfileError('Failed to save profile. Please try again.');
        return;
      }

      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      console.error('Profile save exception:', err);
      setProfileError('An unexpected error occurred.');
    } finally {
      setProfileSaving(false);
    }
  };

  // Fix #4: Wire Update Password to supabase.auth.updateUser
  const handleUpdatePassword = async () => {
    setPwError('');
    setPwStatus('idle');

    if (!newPassword || newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }

    setPwStatus('saving');

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('Password update error:', error);
        setPwError(error.message || 'Failed to update password.');
        setPwStatus('error');
        return;
      }

      setPwStatus('done');
      setNewPassword('');
      setTimeout(() => setPwStatus('idle'), 3000);
    } catch (err) {
      console.error('Password update exception:', err);
      setPwError('An unexpected error occurred.');
      setPwStatus('error');
    }
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
            { key: 'email', label: 'Email Address', placeholder: 'you@example.com', type: 'email', disabled: true },
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
                disabled={f.disabled || profileSaving}
              />
            </div>
          ))}
        </div>
        {profileError && (
          <div className="modal-error" style={{ marginTop: 12 }}>{profileError}</div>
        )}
        <div className="divider" />
        <div className="btn-row">
          <button className="btn-primary" onClick={saveProfile} disabled={profileSaving}>
            {profileSaving ? 'Saving...' : profileSaved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>
      
      <div className="dash-section-title" style={{ marginTop: 24 }}>Security</div>
      <div className="profile-form" style={{ marginBottom: 0 }}>
        <div className="field-group" style={{ maxWidth: 360 }}>
          <label className="field-label">New Password</label>
          <input
            className="field-input"
            type="password"
            placeholder="Min. 8 characters"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            disabled={pwStatus === 'saving'}
          />
        </div>
        {pwError && (
          <div className="modal-error" style={{ marginTop: 8 }}>{pwError}</div>
        )}
        {pwStatus === 'done' && (
          <div style={{ marginTop: 8, color: '#22c55e', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
            ✓ Password updated successfully
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <button
            className="btn-secondary"
            style={{ minHeight: '44px' }}
            onClick={handleUpdatePassword}
            disabled={pwStatus === 'saving'}
          >
            {pwStatus === 'saving' ? 'Updating...' : 'Update Password'}
          </button>
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
