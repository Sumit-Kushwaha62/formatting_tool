import React from 'react';
import { PRICING_PLANS } from '../constants/data';
import PricingCard from '../components/ui/PricingCard';

export default function Pricing({ navTo }) {
  return (
    <div style={{ paddingTop: 60 }}>
      <section className="section">
        <div className="section-inner">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className="section-label" style={{ justifyContent: 'center' }}>Pricing</div>
            <h1 className="section-title" style={{ maxWidth: 480, margin: '0 auto 12px' }}>
              Simple, <em>transparent</em> pricing
            </h1>
            <p className="section-desc" style={{ margin: '0 auto', textAlign: 'center' }}>
              Start free, upgrade when you need. Cancel anytime.
            </p>
          </div>
          
          <div className="pricing-grid">
            {PRICING_PLANS.map(plan => (
              <PricingCard key={plan.id} plan={plan} navTo={navTo} />
            ))}
          </div>

          {/* FAQ Box */}
          <div style={{ marginTop: 48, padding: '28px 32px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
            <div className="faq-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32 }}>
              {[
                { q: 'What payment methods?', a: 'UPI, all Indian debit/credit cards, net banking via Razorpay. Instant activation.' },
                { q: 'Can I cancel anytime?', a: 'Yes — cancel from your dashboard. You keep Pro access until the period ends.' },
                { q: 'GST invoice available?', a: 'Yes. Institution plan includes GST-compliant invoices for university accounts.' },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontFamily: "'EB Garamond', serif", fontSize: 16, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>{item.q}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{item.a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
