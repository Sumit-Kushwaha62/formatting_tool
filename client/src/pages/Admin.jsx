import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export default function Admin({ navTo }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('fs_admin_token') || '');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard Data State
  const [activeTab, setActiveTab] = useState('metrics'); // 'metrics' | 'contacts' | 'feedbacks' | 'users'
  const [data, setData] = useState({
    metrics: null,
    contacts: [],
    feedbacks: [],
    users: [],
    recentDocuments: [],
  });
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Contact status update filter
  const [contactFilter, setContactFilter] = useState('all');
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState('all');
  const [expandedMessageId, setExpandedMessageId] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || '';

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setLoginError('Please enter the admin passcode.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await axios.post(`${API_URL}/api/admin/login`, { password: password.trim() });
      if (res.data?.success && res.data?.token) {
        setToken(res.data.token);
        sessionStorage.setItem('fs_admin_token', res.data.token);
        setPassword('');
      } else {
        setLoginError('Authentication failed. Check your passcode.');
      }
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Invalid admin passcode. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    sessionStorage.removeItem('fs_admin_token');
    setData({ metrics: null, contacts: [], feedbacks: [], users: [], recentDocuments: [] });
  };

  // Fetch admin data
  const fetchAdminData = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    try {
      const res = await axios.get(`${API_URL}/api/admin/data`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      if (res.data?.success) {
        setData(res.data);
        setLastRefreshed(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Admin data fetch error:', err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  }, [token, API_URL]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    if (token) {
      fetchAdminData();
    }
  }, [token, fetchAdminData]);

  useEffect(() => {
    if (!token || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchAdminData();
    }, 12000);
    return () => clearInterval(interval);
  }, [token, autoRefresh, fetchAdminData]);

  // Update contact status
  const handleUpdateContactStatus = async (id, status) => {
    try {
      await axios.patch(
        `${API_URL}/api/admin/contacts/${id}`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setData(prev => ({
        ...prev,
        contacts: prev.contacts.map(c => c.id === id ? { ...c, status } : c),
      }));
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  // Delete contact message
  const handleDeleteContact = async (id) => {
    if (!window.confirm('Delete this contact inquiry permanently?')) return;
    try {
      await axios.delete(`${API_URL}/api/admin/contacts/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(prev => ({
        ...prev,
        contacts: prev.contacts.filter(c => c.id !== id),
      }));
    } catch (err) {
      alert('Failed to delete contact inquiry.');
    }
  };

  // Delete feedback
  const handleDeleteFeedback = async (id) => {
    if (!window.confirm('Delete this feedback entry?')) return;
    try {
      await axios.delete(`${API_URL}/api/admin/feedbacks/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(prev => ({
        ...prev,
        feedbacks: prev.feedbacks.filter(f => f.id !== id),
      }));
    } catch (err) {
      alert('Failed to delete feedback entry.');
    }
  };

  // Filtered contacts
  const filteredContacts = data.contacts.filter(c => {
    if (contactFilter === 'unread') return c.status === 'unread';
    if (contactFilter === 'replied') return c.status === 'replied';
    if (contactFilter === 'read') return c.status === 'read';
    return true;
  });

  // Filtered feedbacks
  const filteredFeedbacks = data.feedbacks.filter(f => {
    if (feedbackRatingFilter === '5') return f.rating === 5;
    if (feedbackRatingFilter === '4') return f.rating === 4;
    if (feedbackRatingFilter === 'low') return f.rating && f.rating <= 3;
    return true;
  });

  // Calculate average rating
  const ratings = data.feedbacks.filter(f => f.rating).map(f => f.rating);
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '5.0';

  // ── VIEW 1: LOGIN CARD ──
  if (!token) {
    return (
      <div className="admin-page-container">
        <button className="back-btn" onClick={() => navTo('home')}>
          ← Back to Application
        </button>

        <div className="admin-login-card glass-card">
          <div className="admin-login-badge">
            <span className="admin-lock-icon">🔒</span>
            <span>Restricted Access</span>
          </div>

          <h1 className="admin-login-title">Format Studio Admin Console</h1>
          <p className="admin-login-sub">
            Monitor real-time Render server metrics, memory utilization, user feedback, and contact inquiries.
          </p>

          <form onSubmit={handleLogin} className="admin-login-form">
            <div className="modal-field">
              <label className="modal-label">Admin Master Passcode</label>
              <input
                type="password"
                className="modal-input admin-pass-input"
                placeholder="Enter admin passcode"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (loginError) setLoginError('');
                }}
                disabled={isLoggingIn}
                autoFocus
              />
            </div>

            {loginError && <div className="tool-error-msg">{loginError}</div>}

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16, margin: 0, marginRight: 8 }} />
                  <span>Verifying credentials…</span>
                </>
              ) : (
                'Access Admin Console ⚡'
              )}
            </button>
          </form>

          <div className="admin-login-footer">
            <span>Configured via <code>ADMIN_PASSWORD</code> in server environment.</span>
          </div>
        </div>
      </div>
    );
  }

  const metrics = data.metrics;

  // ── VIEW 2: AUTHENTICATED DASHBOARD ──
  return (
    <div className="admin-dashboard-container">
      {/* Top Bar */}
      <div className="admin-topbar">
        <div className="admin-brand-cluster">
          <button className="admin-back-btn" onClick={() => navTo('home')} title="Return to user app">
            ← Main App
          </button>
          <div className="admin-brand-meta">
            <div className="admin-brand-row">
              <span className="admin-brand-title">Format Studio Operations</span>
              <span className="admin-live-pill">
                <span className="live-pulse-dot" />
                Live Telemetry
              </span>
            </div>
            <span className="admin-brand-desc">
              Render Node Instance • Host: {metrics?.service?.platform || 'Node / Linux'}
            </span>
          </div>
        </div>

        <div className="admin-topbar-actions">
          <label className="admin-toggle-label">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Live Auto-Sync</span>
          </label>

          <button
            type="button"
            className="admin-action-btn"
            onClick={fetchAdminData}
            disabled={loading}
            title="Refresh metrics immediately"
          >
            {loading ? '↻ Syncing…' : '↻ Refresh'}
          </button>

          <button
            type="button"
            className="admin-logout-btn"
            onClick={handleLogout}
            title="End admin session"
          >
            Sign Out
          </button>
        </div>
      </div>

      {lastRefreshed && (
        <div className="admin-sync-indicator">
          Last synced with backend engine at {lastRefreshed}
        </div>
      )}

      {/* Render-Style Metric Tiles Grid */}
      <div className="admin-metrics-grid">
        {/* Metric 1: Uptime */}
        <div className="admin-metric-card">
          <div className="metric-header">
            <span className="metric-icon">⏱️</span>
            <span className="metric-title">System Uptime</span>
          </div>
          <div className="metric-value-row">
            <span className="metric-val">{metrics?.uptime?.formatted || 'Online'}</span>
            <span className="metric-tag tag-success">{metrics?.uptime?.availability || '99.9%'}</span>
          </div>
          <div className="metric-sub">
            Continuous operation since {metrics?.service?.bootTime ? new Date(metrics.service.bootTime).toLocaleDateString() : 'Deploy'}
          </div>
        </div>

        {/* Metric 2: Memory (Render 512MB limit) */}
        <div className="admin-metric-card">
          <div className="metric-header">
            <span className="metric-icon">🧠</span>
            <span className="metric-title">RAM Usage (Render 512MB)</span>
          </div>
          <div className="metric-value-row">
            <span className="metric-val">{metrics?.memory?.rssMB || 0} <span className="metric-unit">MB</span></span>
            <span className={`metric-tag ${metrics?.memory?.renderUsagePercent > 80 ? 'tag-warn' : 'tag-neutral'}`}>
              {metrics?.memory?.renderUsagePercent || 0}%
            </span>
          </div>
          {/* Progress Bar */}
          <div className="admin-meter-track">
            <div
              className={`admin-meter-fill ${metrics?.memory?.renderUsagePercent > 80 ? 'fill-warn' : 'fill-good'}`}
              style={{ width: `${Math.min(100, metrics?.memory?.renderUsagePercent || 10)}%` }}
            />
          </div>
          <div className="metric-sub">
            Heap: {metrics?.memory?.heapUsedMB || 0} MB / {metrics?.memory?.heapTotalMB || 0} MB Allocated
          </div>
        </div>

        {/* Metric 3: CPU & Hardware */}
        <div className="admin-metric-card">
          <div className="metric-header">
            <span className="metric-icon">⚡</span>
            <span className="metric-title">CPU Utilization</span>
          </div>
          <div className="metric-value-row">
            <span className="metric-val">{metrics?.cpu?.cores || 1} <span className="metric-unit">Virtual Cores</span></span>
            <span className="metric-tag tag-neutral">Load: {metrics?.cpu?.load1m || '0.00'}</span>
          </div>
          <div className="metric-sub" title={metrics?.cpu?.model}>
            Node {metrics?.service?.runtime?.split(' ')[1] || 'v20'} • PID {metrics?.service?.pid}
          </div>
        </div>

        {/* Metric 4: Traffic & Operations */}
        <div className="admin-metric-card">
          <div className="metric-header">
            <span className="metric-icon">🌐</span>
            <span className="metric-title">Traffic & Conversions</span>
          </div>
          <div className="metric-value-row">
            <span className="metric-val">{metrics?.traffic?.totalRequests || 0} <span className="metric-unit">Reqs</span></span>
            <span className="metric-tag tag-success">{metrics?.traffic?.successRate || 100}% OK</span>
          </div>
          <div className="metric-sub">
            Tool Ops: {metrics?.traffic?.toolOperations || 0} • Cache: {metrics?.storage?.totalDiskMB || 0} MB
          </div>
        </div>
      </div>

      {/* Navigation Tabs for Data Panels */}
      <div className="admin-panel-tabs">
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          <span>📊</span> Live Metrics & Telemetry
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'contacts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contacts')}
        >
          <span>📬</span> Contact Inquiries ({data.contacts.length})
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'feedbacks' ? 'active' : ''}`}
          onClick={() => setActiveTab('feedbacks')}
        >
          <span>💡</span> User Feedback ({data.feedbacks.length})
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <span>👥</span> Registered Users ({data.users.length})
        </button>
      </div>

      {/* ── TAB 1: DETAILED SYSTEM METRICS (RENDER STYLE) ── */}
      {activeTab === 'metrics' && (
        <div className="admin-content-card glass-card">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-section-title">Backend Architecture & Live Health</h2>
              <p className="admin-section-sub">Render production service telemetry, storage capacity, and error rates.</p>
            </div>
            <span className="admin-status-badge-healthy">
              ● All Systems Operational
            </span>
          </div>

          <div className="admin-telemetry-table-grid">
            <div className="telemetry-block">
              <span className="telemetry-block-label">Service Information</span>
              <div className="telemetry-row">
                <span>Service Identifier</span>
                <strong>{metrics?.service?.name}</strong>
              </div>
              <div className="telemetry-row">
                <span>Runtime Environment</span>
                <strong>{metrics?.service?.runtime}</strong>
              </div>
              <div className="telemetry-row">
                <span>Host Platform</span>
                <strong>{metrics?.service?.platform}</strong>
              </div>
              <div className="telemetry-row">
                <span>Process ID (PID)</span>
                <strong>{metrics?.service?.pid}</strong>
              </div>
            </div>

            <div className="telemetry-block">
              <span className="telemetry-block-label">Memory Allocation (512MB Cap)</span>
              <div className="telemetry-row">
                <span>Resident Set Size (RSS)</span>
                <strong>{metrics?.memory?.rssMB} MB ({metrics?.memory?.renderUsagePercent}%)</strong>
              </div>
              <div className="telemetry-row">
                <span>V8 Heap Used</span>
                <strong>{metrics?.memory?.heapUsedMB} MB</strong>
              </div>
              <div className="telemetry-row">
                <span>V8 Heap Total</span>
                <strong>{metrics?.memory?.heapTotalMB} MB</strong>
              </div>
              <div className="telemetry-row">
                <span>Memory Health State</span>
                <strong style={{ color: metrics?.memory?.status === 'High' ? 'var(--red)' : 'var(--green)' }}>
                  {metrics?.memory?.status}
                </strong>
              </div>
            </div>

            <div className="telemetry-block">
              <span className="telemetry-block-label">Traffic & Request Codes</span>
              <div className="telemetry-row">
                <span>Total Invocations</span>
                <strong>{metrics?.traffic?.totalRequests}</strong>
              </div>
              <div className="telemetry-row">
                <span>HTTP 2xx (Success)</span>
                <strong style={{ color: 'var(--green)' }}>{metrics?.traffic?.status2xx}</strong>
              </div>
              <div className="telemetry-row">
                <span>HTTP 4xx (Client Error)</span>
                <strong style={{ color: 'var(--amber)' }}>{metrics?.traffic?.status4xx}</strong>
              </div>
              <div className="telemetry-row">
                <span>HTTP 5xx (Server Error)</span>
                <strong style={{ color: metrics?.traffic?.status5xx > 0 ? 'var(--red)' : 'inherit' }}>
                  {metrics?.traffic?.status5xx}
                </strong>
              </div>
            </div>

            <div className="telemetry-block">
              <span className="telemetry-block-label">Storage & Disk Sandboxing</span>
              <div className="telemetry-row">
                <span>Active Temp Uploads</span>
                <strong>{metrics?.storage?.uploadsCount} files</strong>
              </div>
              <div className="telemetry-row">
                <span>Active Processed Outputs</span>
                <strong>{metrics?.storage?.outputsCount} files</strong>
              </div>
              <div className="telemetry-row">
                <span>Total Ephemeral Storage</span>
                <strong>{metrics?.storage?.totalDiskMB} MB</strong>
              </div>
              <div className="telemetry-row">
                <span>Data Retention Policy</span>
                <strong style={{ color: 'var(--green)' }}>Auto-clean on Session End</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: CONTACT INQUIRIES ── */}
      {activeTab === 'contacts' && (
        <div className="admin-content-card glass-card">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-section-title">Support & Contact Inquiries</h2>
              <p className="admin-section-sub">Direct messages submitted via the Contact page.</p>
            </div>

            {/* Filter buttons */}
            <div className="admin-filter-row">
              {['all', 'unread', 'read', 'replied'].map(f => (
                <button
                  key={f}
                  type="button"
                  className={`admin-filter-pill ${contactFilter === f ? 'active' : ''}`}
                  onClick={() => setContactFilter(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {filteredContacts.length === 0 ? (
            <div className="admin-empty-state">
              <div className="empty-icon">📬</div>
              <h3>No inquiries found</h3>
              <p>No contact messages match your active filter.</p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User & Email</th>
                    <th>Category</th>
                    <th>Subject & Message</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map(c => (
                    <tr key={c.id} className={c.status === 'unread' ? 'row-unread' : ''}>
                      <td className="cell-date">
                        {new Date(c.created_at).toLocaleDateString()}<br />
                        <small>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                      </td>
                      <td>
                        <strong>{c.name}</strong><br />
                        <a href={`mailto:${c.email}`} className="cell-email-link">{c.email}</a>
                      </td>
                      <td>
                        <span className="badge-category">{c.category || 'Support'}</span>
                      </td>
                      <td className="cell-message-col">
                        <div className="message-subject">{c.subject}</div>
                        <div
                          className={`message-body-snippet ${expandedMessageId === c.id ? 'expanded' : ''}`}
                          onClick={() => setExpandedMessageId(expandedMessageId === c.id ? null : c.id)}
                          title="Click to view full message"
                        >
                          {c.message}
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill pill-${c.status || 'unread'}`}>
                          {c.status || 'unread'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions-cluster">
                          <select
                            className="status-dropdown"
                            value={c.status || 'unread'}
                            onChange={(e) => handleUpdateContactStatus(c.id, e.target.value)}
                          >
                            <option value="unread">Unread</option>
                            <option value="read">Read</option>
                            <option value="replied">Replied</option>
                          </select>

                          <button
                            type="button"
                            className="btn-table-delete"
                            onClick={() => handleDeleteContact(c.id)}
                            title="Delete inquiry"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: USER FEEDBACK ── */}
      {activeTab === 'feedbacks' && (
        <div className="admin-content-card glass-card">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-section-title">Product & Feature Feedback</h2>
              <p className="admin-section-sub">
                Overall Rating: <strong>{avgRating} ★ / 5.0</strong> ({data.feedbacks.length} total entries)
              </p>
            </div>

            <div className="admin-filter-row">
              {['all', '5', '4', 'low'].map(f => (
                <button
                  key={f}
                  type="button"
                  className={`admin-filter-pill ${feedbackRatingFilter === f ? 'active' : ''}`}
                  onClick={() => setFeedbackRatingFilter(f)}
                >
                  {f === 'all' ? 'ALL RATINGS' : f === '5' ? '5 ★' : f === '4' ? '4 ★' : '≤ 3 ★'}
                </button>
              ))}
            </div>
          </div>

          {filteredFeedbacks.length === 0 ? (
            <div className="admin-empty-state">
              <div className="empty-icon">💡</div>
              <h3>No feedback records</h3>
              <p>No feedback entries match this filter.</p>
            </div>
          ) : (
            <div className="admin-feedback-cards-grid">
              {filteredFeedbacks.map(f => (
                <div key={f.id} className="feedback-admin-card">
                  <div className="feedback-card-top">
                    <div className="feedback-stars">
                      {'★'.repeat(f.rating || 5)}{'☆'.repeat(Math.max(0, 5 - (f.rating || 5)))}
                    </div>
                    <span className="badge-category">{f.category || 'General'}</span>
                    <button
                      type="button"
                      className="btn-feedback-delete"
                      onClick={() => handleDeleteFeedback(f.id)}
                      title="Delete entry"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="feedback-card-body">
                    <p className="feedback-text">"{f.feedback || f.message}"</p>
                  </div>

                  <div className="feedback-card-footer">
                    <div className="feedback-user-info">
                      <span className="user-name">{f.name || 'Anonymous User'}</span>
                      {f.email && <span className="user-email"> • {f.email}</span>}
                    </div>
                    <span className="tool-tag">{f.tool || 'General'}</span>
                    <span className="feedback-date">{new Date(f.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: USERS & DOCUMENTS (SUPABASE) ── */}
      {activeTab === 'users' && (
        <div className="admin-content-card glass-card">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-section-title">Registered User Directory</h2>
              <p className="admin-section-sub">Profiles from Supabase database and their formatted document counts.</p>
            </div>
            <span className="admin-status-badge-healthy">
              Total Profiles: {data.users.length}
            </span>
          </div>

          {data.users.length === 0 ? (
            <div className="admin-empty-state">
              <div className="empty-icon">👥</div>
              <h3>No users in database</h3>
              <p>Registered accounts will appear here once users sign up via Supabase Auth.</p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Organization</th>
                    <th>Documents Formatted</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map(u => (
                    <tr key={u.id}>
                      <td className="cell-mono"><small>{u.id.slice(0, 8)}…</small></td>
                      <td><strong>{u.name}</strong></td>
                      <td><a href={`mailto:${u.email}`} className="cell-email-link">{u.email}</a></td>
                      <td>
                        <span className={`plan-badge plan-${u.plan || 'free'}`}>
                          {(u.plan || 'free').toUpperCase()}
                        </span>
                      </td>
                      <td>{u.org || '—'}</td>
                      <td><strong>{u.documentCount}</strong> documents</td>
                      <td className="cell-date">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
