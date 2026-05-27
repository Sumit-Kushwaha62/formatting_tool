import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePayment } from '../../hooks/usePayment';

export default function PricingCard({ plan, navTo }) {
  const { user, openModal } = useAuth();
  const { handlePayment } = usePayment();

  const handleCardCTA = () => {
    if (plan.id === 'pro') {
      if (!user) {
        openModal('signup');
      } else {
        handlePayment(() => navTo('dashboard'));
      }
    } else if (plan.id === 'team') {
      navTo('contact');
    } else {
      navTo('tool');
    }
  };

  return (
    <div className={`pricing-card ${plan.highlight ? 'highlight' : ''}`}>
      <div className="pricing-badge">
        {plan.highlight ? '✦ Most Popular' : plan.tag || plan.name}
      </div>
      <div className="pricing-name">{plan.name}</div>
      <div className="pricing-desc">{plan.desc}</div>
      <div className="pricing-price">{plan.price}</div>
      <div className="pricing-period">{plan.period}</div>
      
      <div className="pricing-divider" />
      
      <ul className="pricing-features">
        {plan.features.map((feature, i) => (
          <li className="pricing-feature" key={i}>
            <span className="pricing-feature-check">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      
      <button
        className={`pricing-cta ${plan.highlight ? 'pricing-cta-solid' : 'pricing-cta-ghost'}`}
        onClick={handleCardCTA}
      >
        {plan.cta}
      </button>
    </div>
  );
}
