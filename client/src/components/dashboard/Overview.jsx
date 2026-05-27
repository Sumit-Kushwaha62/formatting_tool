import React from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';

export default function Overview({ navTo, setDashTab }) {
  const { user, userPlan, realDocs, docsCount, refreshPlanAndDocs } = useAuth();
  const [documentsCount, setDocumentsCount] = React.useState(docsCount || 0);

  React.useEffect(() => {
    if (user?.id) {
      refreshPlanAndDocs(user.id);
      supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then(({ count, error }) => {
          if (error) {
            console.error('Error fetching documents count:', error);
            return;
          }
          setDocumentsCount(count || 0);
        });
    }
  }, [user?.id]);

  React.useEffect(() => {
    setDocumentsCount(docsCount || 0);
  }, [docsCount]);

  const activePlanName = userPlan === 'pro' ? 'Professional' : userPlan === 'team' ? 'Institution' : 'Scholar';
  const activePlanPrice = userPlan === 'pro' ? '₹199/month' : userPlan === 'team' ? '₹999/month' : '₹0/forever';

  // Format date helper
  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <div className="dash-page-title">Welcome back, <span>{user?.name}</span></div>
      <div className="dash-page-sub">Here is your account overview for this month.</div>
      
      <div className="plan-banner">
        <div>
          <div className="plan-badge-lrg">✦ Current Plan</div>
          <div className="plan-name-lrg">{activePlanName} — {activePlanPrice}</div>
          <div className="plan-renew">
            {userPlan === 'pro' ? 'Renews on 8 June 2026' : 'Active and ready to use'}
          </div>
        </div>
        <div className="plan-actions">
          {userPlan === 'free' && (
            <button className="btn-plan-upgrade" onClick={() => navTo('pricing')}>Upgrade Plan</button>
          )}
          <button className="btn-plan-cancel">Manage</button>
        </div>
      </div>
      
      <div className="dash-grid">
        <div className="dash-stat-card">
          <div className="dash-stat-label">Documents Formatted</div>
          <div className="dash-stat-val">{documentsCount}</div>
          <div className="dash-stat-sub">
            {userPlan === 'free' ? '3 document limit' : 'Unlimited formatting active'}
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">Member Since</div>
          <div className="dash-stat-val" style={{ fontSize: 22, marginTop: 6 }}>May 2026</div>
          <div className="dash-stat-sub">Active account status</div>
        </div>
      </div>
      
      <div className="dash-section-title">Recent Activity</div>
      
      <div className="activity-list">
        {realDocs.length > 0 ? (
          realDocs.slice(0, 3).map((doc, i) => {
            const icon = doc.doc_type === 'book' ? '📖' : doc.doc_type === 'thesis' ? '🎓' : doc.doc_type === 'research' ? '🔬' : '✉️';
            const name = `${doc.doc_type.charAt(0).toUpperCase() + doc.doc_type.slice(1)} — ${doc.file_name}`;
            return (
              <div className="activity-row" key={doc.id || i}>
                <div className="activity-icon">{icon}</div>
                <div>
                  <div className="activity-name">{name}</div>
                  <div className="activity-meta">{formatDate(doc.created_at)}</div>
                </div>
                <div className="activity-spacer" />
                <span className={`activity-badge ${doc.status === 'done' ? 'badge-done' : 'badge-fail'}`}>
                  {doc.status === 'done' ? 'Success' : 'Failed'}
                </span>
              </div>
            );
          })
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontFamily: "'DM Sans', sans-serif", fontSize: '13px' }}>
            No documents formatted yet. <span style={{ color: 'var(--navy)', cursor: 'pointer', fontWeight: 600 }} onClick={() => navTo('tool')}>Format your first document →</span>
          </div>
        )}
      </div>
      
      {realDocs.length > 3 && (
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button className="btn-secondary" style={{ fontSize: 12, minHeight: '36px' }} onClick={() => setDashTab('activity')}>
            View all activity →
          </button>
        </div>
      )}
    </>
  );
}
