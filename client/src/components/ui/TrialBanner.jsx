import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePayment } from '../../hooks/usePayment';

export default function TrialBanner() {
  const { user, userPlan, docsCount } = useAuth();
  const { handlePayment } = usePayment();

  // Only show for logged in users on the free plan who have formatted 2 or more documents
  if (!user || userPlan !== 'free' || docsCount < 2) return null;

  const docsLeft = Math.max(0, 3 - docsCount);

  return (
    <div className="trial-banner-container">
      <div className="trial-banner-text">
        ⚡ You have <strong>{docsLeft} {docsLeft === 1 ? 'document' : 'documents'}</strong> left on the free Scholar plan.
      </div>
      <button className="trial-banner-btn" onClick={() => handlePayment()}>
        Upgrade to Pro for Unlimited →
      </button>
    </div>
  );
}
