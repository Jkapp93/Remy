'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

const PLANS = [
  {
    name: 'Solo',
    price: 149,
    period: 'mo',
    description: 'One rep, full Remy.',
    features: [
      '1 field rep',
      'Voice + text with Remy',
      'Job briefings',
      'Doctrine injection',
      'Session memory',
      'API tokens included',
    ],
    priceId: 'price_solo',
    cta: 'Get Started',
    featured: false,
  },
  {
    name: 'Team',
    price: 499,
    period: 'mo',
    description: 'Your whole crew, one brain.',
    features: [
      'Up to 5 field reps',
      'Boss injection dashboard',
      'Full memory per rep',
      'Morning briefs',
      'PDF doctrine upload',
      'Usage analytics',
      'API tokens included',
    ],
    priceId: 'price_team',
    cta: 'Get Started',
    featured: true,
  },
  {
    name: 'Company',
    price: 1299,
    period: 'mo',
    description: 'Scale across your entire operation.',
    features: [
      'Up to 20 reps',
      'Full admin control',
      'CRM webhook integration',
      'Custom doctrine layers',
      'Broadcast to all reps',
      'Priority support',
      'API tokens included',
    ],
    priceId: 'price_company',
    cta: 'Get Started',
    featured: false,
  },
  {
    name: 'Enterprise',
    price: 0,
    period: 'mo',
    description: 'White label, custom integrations, unlimited reps.',
    features: [
      'Unlimited reps',
      'White label option',
      'Custom CRM integrations',
      'Dedicated support',
      'Custom onboarding',
      'SLA guarantee',
    ],
    priceId: 'price_enterprise',
    cta: 'Contact Us',
    featured: false,
  },
];

export default function PricingPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (plan: typeof PLANS[0]) => {
    if (plan.name === 'Enterprise') {
      window.location.href = 'mailto:joseph@getremy.ai?subject=Enterprise Plan';
      return;
    }
    if (!user) {
      window.location.href = '/auth';
      return;
    }
    setLoading(plan.priceId);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: plan.priceId, planName: plan.name }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert('Something went wrong. Try again.');
    }
    setLoading(null);
  };

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(240,122,46,0.2)} 50%{box-shadow:0 0 40px rgba(240,122,46,0.4)} }
      `}</style>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 28px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(11,15,20,0.95)', position:'sticky', top:0, zIndex:100 }}>
        <Link href="/" style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.2rem', fontWeight:800, textDecoration:'none', color:'#e8edf2' }}>Remy<span style={{ color:'#f07a2e' }}>.</span></Link>
        <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
          {user ? (
            <Link href="/dashboard" style={{ padding:'8px 18px', background:'#f07a2e', borderRadius:'6px', textDecoration:'none', color:'#fff', fontSize:'0.85rem', fontWeight:500 }}>Dashboard</Link>
          ) : (
            <Link href="/auth" style={{ padding:'8px 18px', background:'#f07a2e', borderRadius:'6px', textDecoration:'none', color:'#fff', fontSize:'0.85rem', fontWeight:500 }}>Get Started</Link>
          )}
        </div>
      </div>

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'60px 24px' }}>
        <div style={{ textAlign:'center', marginBottom:'60px' }}>
          <div style={{ fontSize:'0.72rem', fontWeight:500, letterSpacing:'0.15em', textTransform:'uppercase', color:'#f07a2e', marginBottom:'16px' }}>Pricing</div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'clamp(2rem,5vw,3.5rem)', fontWeight:800, letterSpacing:'-0.02em', marginBottom:'16px' }}>
            Pay for results.<br />Not headcount.
          </h1>
          <p style={{ color:'#7a8fa4', fontSize:'1.05rem', fontWeight:300, maxWidth:'480px', margin:'0 auto' }}>
            One rep closing one extra job a week pays for Remy 10x over. Cancel any time.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'16px', alignItems:'start' }}>
          {PLANS.map(plan => (
            <div key={plan.name} style={{
              background: plan.featured ? 'rgba(240,122,46,0.05)' : '#111820',
              border: plan.featured ? '1px solid rgba(240,122,46,0.35)' : '1px solid rgba(255,255,255,0.07)',
              borderRadius:'14px',
              padding:'32px 28px',
              position:'relative',
              animation: plan.featured ? 'glow 3s ease-in-out infinite' : 'none',
            }}>
              {plan.featured && (
                <div style={{ position:'absolute', top:'-1px', left:'50%', transform:'translateX(-50%)', background:'#f07a2e', color:'#fff', fontSize:'0.6rem', fontWeight:600, letterSpacing:'0.1em', padding:'4px 14px', borderRadius:'0 0 8px 8px' }}>
                  MOST POPULAR
                </div>
              )}

              <div style={{ fontSize:'0.72rem', fontWeight:500, letterSpacing:'0.15em', textTransform:'uppercase', color:'#7a8fa4', marginBottom:'12px' }}>{plan.name}</div>

              {plan.price > 0 ? (
                <div style={{ marginBottom:'6px' }}>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontSize:'2.8rem', fontWeight:800, color:'#e8edf2' }}>${plan.price}</span>
                  <span style={{ color:'#3d5268', fontSize:'0.85rem' }}>/mo</span>
                </div>
              ) : (
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'2rem', fontWeight:800, color:'#e8edf2', marginBottom:'6px' }}>Custom</div>
              )}

              <div style={{ color:'#7a8fa4', fontSize:'0.85rem', fontWeight:300, marginBottom:'24px' }}>{plan.description}</div>

              <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:'10px', marginBottom:'28px' }}>
                {plan.features.map(f => (
                  <li key={f} style={{ fontSize:'0.85rem', color:'#7a8fa4', display:'flex', alignItems:'flex-start', gap:'8px', fontWeight:300 }}>
                    <span style={{ color:'#3daf76', fontWeight:500, flexShrink:0 }}>+</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan)}
                disabled={loading === plan.priceId}
                style={{
                  width:'100%',
                  padding:'13px',
                  borderRadius:'8px',
                  border:'none',
                  background: plan.featured ? '#f07a2e' : 'rgba(255,255,255,0.06)',
                  color: plan.featured ? '#fff' : '#e8edf2',
                  fontFamily:"'DM Sans',sans-serif",
                  fontSize:'0.9rem',
                  fontWeight:500,
                  cursor:'pointer',
                  opacity: loading === plan.priceId ? 0.6 : 1,
                }}
              >
                {loading === plan.priceId ? 'Loading...' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div style={{ textAlign:'center', marginTop:'48px', color:'#3d5268', fontSize:'0.82rem', fontWeight:300 }}>
          All plans include a 14-day free trial. No credit card required to start.
        </div>
      </div>
    </div>
  );
}
