'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useUser } from '@clerk/nextjs';

const PLANS = [
  {
    id: 'solo',
    name: 'Solo',
    price: 199,
    description: 'For the independent rep or owner-operator',
    features: [
      'One user',
      'Unlimited jobs',
      'Voice briefings and coaching',
      'Weather and places intel',
      'GPS co-pilot',
      'Company doctrine',
      'Mobile app',
    ],
    color: '#f07a2e',
    popular: false,
  },
  {
    id: 'command',
    name: 'Command',
    price: 799,
    description: 'For small teams of up to 5 reps',
    features: [
      'Up to 5 users',
      'Everything in Solo',
      'Boss Command Center',
      'Team invite system',
      'Broadcast to all reps',
      'Conversation summaries',
      'Weekly performance email',
    ],
    color: '#4a9fd4',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 1499,
    description: 'For larger teams and multi-location businesses',
    features: [
      'Up to 15 users',
      'Everything in Command',
      'Priority support',
      'Custom doctrine setup',
      'CRM webhook integration',
      'Dedicated onboarding',
      'Custom voice training',
    ],
    color: '#9b59b6',
    popular: false,
  },
];

export default function PricingPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState<string | null>(null);

  const checkout = async (planId: string) => {
    setLoading(planId);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, email: user?.primaryEmailAddress?.emailAddress, clerkId: user?.id }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setLoading(null);
    } catch { setLoading(null); }
  };

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .plan-card { background:#111820; border:1px solid rgba(255,255,255,0.07); border-radius:16px; padding:32px; display:flex; flex-direction:column; gap:20px; transition:border-color 0.2s; }
        .plan-card.popular { border-color:rgba(74,159,212,0.4); }
        .feature-item { display:flex; align-items:center; gap:10px; font-size:0.88rem; color:#7a8fa4; font-weight:300; }
        .check { width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:10px; font-weight:700; }
        .plan-btn { width:100%; padding:14px; border-radius:10px; border:none; font-family:"DM Sans",sans-serif; font-size:0.95rem; font-weight:600; cursor:pointer; transition:opacity 0.2s; }
      `}</style>

      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 40px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(11,15,20,0.95)', position:'sticky', top:0, zIndex:100 }}>
        <Link href="/" style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.4rem', fontWeight:800, textDecoration:'none', color:'#e8edf2' }}>Remy<span style={{ color:'#f07a2e' }}>.</span></Link>
        <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
          {user ? (
            <Link href="/dashboard" style={{ background:'#f07a2e', color:'#fff', padding:'10px 20px', borderRadius:'8px', textDecoration:'none', fontSize:'0.88rem', fontWeight:600 }}>Dashboard</Link>
          ) : (
            <Link href="/auth" style={{ background:'#f07a2e', color:'#fff', padding:'10px 20px', borderRadius:'8px', textDecoration:'none', fontSize:'0.88rem', fontWeight:600 }}>Get Started</Link>
          )}
        </div>
      </nav>

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'80px 24px' }}>
        <div style={{ textAlign:'center', marginBottom:'60px' }}>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'clamp(2rem, 5vw, 3.5rem)', fontWeight:900, marginBottom:'16px' }}>
            Simple, transparent pricing
          </h1>
          <p style={{ color:'#7a8fa4', fontSize:'1.05rem', fontWeight:300 }}>
            No setup fees. No contracts. Cancel anytime.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'20px', alignItems:'start' }}>
          {PLANS.map(plan => (
            <div key={plan.id} className={`plan-card ${plan.popular ? 'popular' : ''}`}>
              {plan.popular && (
                <div style={{ background:'rgba(74,159,212,0.1)', border:'1px solid rgba(74,159,212,0.3)', borderRadius:'20px', padding:'4px 12px', fontSize:'0.72rem', fontWeight:600, color:'#4a9fd4', textTransform:'uppercase', letterSpacing:'0.1em', alignSelf:'flex-start' }}>
                  Most Popular
                </div>
              )}
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.3rem', fontWeight:800, marginBottom:'6px', color: plan.color }}>{plan.name}</div>
                <div style={{ fontSize:'0.85rem', color:'#3d5268', fontWeight:300 }}>{plan.description}</div>
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:'4px' }}>
                <span style={{ fontFamily:"'Syne',sans-serif", fontSize:'2.8rem', fontWeight:900, color:'#e8edf2' }}>${plan.price}</span>
                <span style={{ color:'#3d5268', fontSize:'0.88rem' }}>/mo</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px', flex:1 }}>
                {plan.features.map(f => (
                  <div key={f} className="feature-item">
                    <div className="check" style={{ background: plan.color + '22', color: plan.color }}>&#10003;</div>
                    {f}
                  </div>
                ))}
              </div>
              <button
                className="plan-btn"
                onClick={() => checkout(plan.id)}
                disabled={loading === plan.id}
                style={{ background: plan.popular ? plan.color : 'rgba(255,255,255,0.06)', color: plan.popular ? '#fff' : '#e8edf2', opacity: loading === plan.id ? 0.6 : 1 }}
              >
                {loading === plan.id ? 'Loading...' : `Start ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        <div style={{ textAlign:'center', marginTop:'60px', padding:'40px', background:'rgba(240,122,46,0.04)', border:'1px solid rgba(240,122,46,0.1)', borderRadius:'16px' }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.3rem', fontWeight:800, marginBottom:'10px' }}>Need something bigger?</div>
          <div style={{ color:'#7a8fa4', fontSize:'0.9rem', fontWeight:300, marginBottom:'20px' }}>Enterprise pricing for large teams, custom integrations, and dedicated support.</div>
          <a href="mailto:hello@getremy.dev" style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.15)', color:'#e8edf2', padding:'12px 28px', borderRadius:'10px', textDecoration:'none', fontSize:'0.9rem', fontWeight:500 }}>Contact Us</a>
        </div>
      </div>
    </div>
  );
}
