import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { MONETIZATION_ENABLED } from '../config/features';
import Overview from '../components/dashboard/Overview';
import Activity from '../components/dashboard/Activity';
import Subscription from '../components/dashboard/Subscription';
import Profile from '../components/dashboard/Profile';

export default function Dashboard({ navTo }) {
  const { user, userPlan, openModal } = useAuth();
  const [dashTab, setDashTab] = useState('overview');

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '160px 20px' }}>
        <h1 className="tool-title" style={{ marginBottom: 12 }}>Authentication Required</h1>
        <p className="tool-subtitle" style={{ marginBottom: 24 }}>Please sign in to access your document dashboard and billing history.</p>
        <button className="btn-primary" onClick={() => openModal('login')}>Sign In →</button>
      </div>
    );
  }

  const activePlanName = userPlan === 'pro' ? 'Professional' : userPlan === 'team' ? 'Institution' : 'Scholar';
  const activePlanPrice = userPlan === 'pro' ? '₹199/mo' : userPlan === 'team' ? '₹999/mo' : '₹0/mo';

  const navItems = [
    { id: 'overview', icon: '◈', label: 'Overview' },
    { id: 'activity', icon: '⟳', label: 'Activity' },
    ...(MONETIZATION_ENABLED ? [{ id: 'subscription', icon: '✦', label: 'Subscription' }] : []),
    { id: 'profile', icon: '◯', label: 'Profile' },
  ];

  return (
    <div className="dash-shell">
      {/* Sidebar for Desktop */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-user">
          <div className="dash-sidebar-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div className="dash-sidebar-name">{user.name}</div>
          <div className="dash-sidebar-email">{user.email}</div>
        </div>
        <nav className="dash-sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`dash-sidebar-item ${dashTab === item.id ? 'active' : ''}`}
              onClick={() => setDashTab(item.id)}
            >
              <span className="item-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <button className="dash-sidebar-item" onClick={() => navTo('tool')} style={{ marginTop: 8 }}>
            <span className="item-icon" aria-hidden="true">→</span>
            Format Document
          </button>
        </nav>
        {MONETIZATION_ENABLED && (
          <div className="dash-sidebar-footer">
            <div style={{ padding: '0 2px' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Current Plan</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{activePlanName}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--gold)', marginTop: 2 }}>{activePlanPrice}</div>
            </div>
          </div>
        )}
      </aside>

      {/* Modern Bottom Tabs for Mobile View */}
      <nav className="dash-bottom-tabs">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`dash-bottom-tab-item ${dashTab === item.id ? 'active' : ''}`}
            onClick={() => setDashTab(item.id)}
          >
            <span className="dash-bottom-tab-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Main dashboard content */}
      <main className="dash-content">
        {dashTab === 'overview' && (
          <Overview navTo={navTo} setDashTab={setDashTab} />
        )}
        {dashTab === 'activity' && (
          <Activity navTo={navTo} />
        )}
        {dashTab === 'subscription' && (
          <Subscription navTo={navTo} />
        )}
        {dashTab === 'profile' && (
          <Profile navTo={navTo} />
        )}
      </main>
    </div>
  );
}
