import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
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
        <div style={{ fontFamily: "'EB Garamond', serif", fontSize: 28, color: 'var(--navy)', marginBottom: 12 }}>Login required</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: 'var(--text3)', marginBottom: 24 }}>Sign in to access your dashboard.</div>
        <button className="btn-primary" onClick={() => openModal('login')}>Sign In →</button>
      </div>
    );
  }

  const activePlanName = userPlan === 'pro' ? 'Professional' : userPlan === 'team' ? 'Institution' : 'Scholar';
  const activePlanPrice = userPlan === 'pro' ? '₹199/mo' : userPlan === 'team' ? '₹999/mo' : '₹0/mo';

  const navItems = [
    { id: 'overview', icon: '◈', label: 'Overview' },
    { id: 'activity', icon: '⟳', label: 'Activity' },
    { id: 'subscription', icon: '✦', label: 'Subscription' },
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
              <span className="item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <button className="dash-sidebar-item" onClick={() => navTo('tool')} style={{ marginTop: 8 }}>
            <span className="item-icon">→</span>
            Format Document
          </button>
        </nav>
        <div className="dash-sidebar-footer">
          <div style={{ padding: '0 2px' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Current Plan</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{activePlanName}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--gold)', marginTop: 2 }}>{activePlanPrice}</div>
          </div>
        </div>
      </aside>

      {/* Modern Bottom Tabs for Mobile View */}
      <nav className="dash-bottom-tabs">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`dash-bottom-tab-item ${dashTab === item.id ? 'active' : ''}`}
            onClick={() => setDashTab(item.id)}
          >
            <span className="dash-bottom-tab-icon">{item.icon}</span>
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
          <Profile />
        )}
      </main>
    </div>
  );
}
