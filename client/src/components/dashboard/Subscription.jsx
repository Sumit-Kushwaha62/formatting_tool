import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';

export default function Subscription({ navTo }) {
  const { user, userPlan, docsCount, refreshPlanAndDocs } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    
    refreshPlanAndDocs();

    supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching payments:', error);
        } else if (data) {
          setPayments(data);
        }
        setLoadingHistory(false);
      });
  }, [user]);

  const activePlanName = userPlan === 'pro' ? 'Professional' : userPlan === 'team' ? 'Institution' : 'Scholar';
  const activePlanPrice = userPlan === 'pro' ? '₹199/month' : userPlan === 'team' ? '₹999/month' : '₹0/forever';
  const activePlanRenew = userPlan === 'pro' ? 'Next billing: 8 June 2026' : 'Active free plan';

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

  const formatAmount = (amount) => {
    if (!amount) return 199;
    return amount >= 1000 ? Math.round(amount / 100) : amount;
  };

  return (
    <>
      <div className="dash-page-title">Subscription</div>
      <div className="dash-page-sub">Manage your plan and billing.</div>
      
      <div className="plan-banner" style={{ marginBottom: 20 }}>
        <div>
          <div className="plan-badge-lrg">✦ Active Plan</div>
          <div className="plan-name-lrg">{activePlanName}</div>
          <div className="plan-renew">{activePlanRenew} · {activePlanPrice}</div>
        </div>
        <div className="plan-actions">
          {userPlan === 'free' && (
            <button className="btn-plan-upgrade" onClick={() => navTo('pricing')}>Change Plan</button>
          )}
          <button className="btn-plan-cancel">Cancel Subscription</button>
        </div>
      </div>
      
      <div className="dash-section-title">Usage This Month</div>
      <div className="profile-form" style={{ marginBottom: 24 }}>
        <div className="usage-bar-wrap">
          <div className="usage-bar-top">
            <span className="usage-bar-label">Documents Formatted</span>
            <span className="usage-bar-count">
              {docsCount} / {userPlan === 'free' ? '3 docs' : 'Unlimited'}
            </span>
          </div>
          <div className="usage-bar-track">
            <div 
              className="usage-bar-fill" 
              style={{ width: userPlan === 'free' ? `${Math.min(100, (docsCount / 3) * 100)}%` : '100%' }} 
            />
          </div>
        </div>
        <div className="usage-bar-wrap">
          <div className="usage-bar-top">
            <span className="usage-bar-label">Cloud Storage Used</span>
            <span className="usage-bar-count">1.4 MB / 500 MB</span>
          </div>
          <div className="usage-bar-track">
            <div className="usage-bar-fill" style={{ width: '0.28%' }} />
          </div>
        </div>
      </div>
      
      <div className="dash-section-title">Billing History</div>
      <div className="activity-list">
        {loadingHistory ? (
          <div style={{ padding: '24px', textAlign: 'center' }}><div className="spinner" style={{ width: 24, height: 24 }} /></div>
        ) : payments.length > 0 ? (
          payments.map((p, i) => (
            <div className="activity-row" key={p.id || i}>
              <div className="activity-icon">🧾</div>
              <div>
                <div className="activity-name">Professional Plan — Payment ID: {p.payment_id || 'N/A'}</div>
                <div className="activity-meta">{formatDate(p.created_at)}</div>
              </div>
              <div className="activity-spacer" />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: 'var(--navy)', fontWeight: 600 }}>
                ₹{formatAmount(p.amount)}
              </span>
              <span className="activity-badge badge-done" style={{ marginLeft: 10 }}>Paid</span>
            </div>
          ))
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontFamily: "'DM Sans', sans-serif", fontSize: '13px' }}>
            No billing records found.
          </div>
        )}
      </div>
    </>
  );
}
