import React from 'react';
import { PRICING_PLANS } from '../constants/data';
import PricingCard from '../components/ui/PricingCard';

export default function Pricing({ navTo }) {
  return (
    <div className="pricing-page">
      <section className="pricing-section">
        <div className="section-container">
          <div className="section-header-center">
            <div className="section-eyebrow">Flexible Plans</div>
            <h1 className="section-title">
              Simple, transparent pricing
            </h1>
            <p className="section-subtitle">
              Start with our free scholar plan, or upgrade for unlimited formatting and dedicated institutional support.
            </p>
          </div>
          
          <div className="pricing-grid">
            {PRICING_PLANS.map(plan => (
              <PricingCard key={plan.id} plan={plan} navTo={navTo} />
            ))}
          </div>

          {/* FAQ Box */}
          <div className="pricing-faq-box">
            <div className="faq-grid">
              {[
                { q: 'What payment methods are supported?', a: 'All major UPI apps (GPay, PhonePe, Paytm), credit/debit cards, and Net Banking via Razorpay. Immediate activation upon checkout.' },
                { q: 'Can I cancel anytime?', a: 'Yes. You can manage or cancel your subscription anytime directly from your dashboard. Pro benefits remain active until the end of your billing cycle.' },
                { q: 'Are GST invoices provided?', a: 'Yes. Institution and Pro plan subscribers receive automated GST-compliant tax invoices on every successful renewal.' },
              ].map((item, i) => (
                <div key={i} className="faq-item">
                  <div className="faq-question">{item.q}</div>
                  <div className="faq-answer">{item.a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
