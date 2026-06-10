'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useUser } from '@clerk/nextjs';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    label: '$0',
    sublabel: 'forever',
    description: 'Try Remy before you commit',
    features: ['1 user', '20 messages per day', 'Voice briefings & coaching', 'Objection handling', 'GPS co-pilot', 'Company doctrine'],
    color: '#7a8fa4',
    popular: false,
    cta: 'Start Free',
    ctaHref: '/onboard',
  },
  {
    id: 'solo',
    name: 'Solo',
    price: 199,
    label: '$199',
    sublabel: '/mo',
    description: 'For the independent rep or owner-operator',
    features: ['1 user', '150 messages per day', 'Everything in Free', 'Deal value tracking', 'Rep performance stats', 'Field notes & follow-ups'],
    color: '#f07a2e',
    popular: false,
    cta: 'Start Solo',
    ctaHref: null,
  },
  {
    id: 'command',
    name: 'Command',
    price: 799,
    label: '$799',
    sublabel: '/mo',
    description: 'For small teams of up to 5 reps',
    features: ['Up to 5 users', '500 messages/day per rep', 'Everything in Solo', 'Boss Command Center', 'Team invite system', 'Broadcast to all reps', 'Weekly performance email'],
    color: '#4a9fd4',
    popular: true,
    cta: 'Start Command',
    ctaHref: null,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 1499,
    label: '$1,499',
    sublabel: '/mo',
    description: 'For larger teams and multi-location businesses',
    features: ['Up to 15 users', 'Unlimited messages', 'Everything in Command', 'CRM webhook integration', 'Priority support', 'Custom doctrine setup', 'Dedicated onboarding'],
    color: '#9b59b6',
    popular: false,
    cta: 'Start Enterprise',
    ctaHref: null,
  },
];

const COMPARE_ROWS = [
  { label: 'Messages per day',    free: '20',   solo: '150',   command: '500',    enterprise: 'Unlimited' },
  { label: 'Users',               free: '1',    solo: '1',     command: 'Up to 5', enterprise: 'Up to 15' },
  { label: 'Voice briefings',     free: true,   solo: true,    command: true,     enterprise: true },
  { label: 'Objection coaching',  free: true,   solo: true,    command: true,     enterprise: true },
  { label: 'Company doctrine',    free: true,   solo: true,    command: true,     enterprise: true },
  { label: 'GPS co-pilot',        free: true,   solo: true,    command: true,     enterprise: true },
  { label: 'Deal value tracking', free: false,  solo: true,    command: true,     enterprise: true },
  { label: 'Rep stats dashboard', free: false,  solo: true,    command: true,     enterprise: true },
  { label: 'Boss Command Center', free: false,  solo: false,   command: true,     enterprise: true },
  { label: 'Team broadcasts',     free: false,  solo: false,   command: true,     enterprise: true },
  { label: 'Weekly email reports',free: false,  solo: false,   command: true,     enterprise: true },
  { label: 'CRM webhook',         free: false,  solo: false,   command: false,    enterprise: true },
  { label: 'Priority support',    free: false,  solo: false,   command: false,    enterprise: true },
  { label: 'Custom onboarding',   free: false,  solo: false,   command: false,    enterprise: true },
];

function Cell({ val, color }: { val: boolean | string; color: string }) {
  if (typeof val === 'string') return <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.82rem', color: '#e8edf2', fontWeight: 500 }}>{val}</td>;
  return (
    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
      {val
        ? <span style={{ color, fontSize: '1rem', fontWeight: 700 }}>✓</span>
        : <span style={{ color: '#2d3f52', fontSize: '0.9rem' }}>—</span>}
    </td>
  );
}

export default function PricingPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState<string | null>(null);

  const checkout = async (planId: string, href: string | null) => {
    if (href) { window.location.href = href; return; }
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
        .plan-card.popular { border-color:rgba(74,159,212,0.4); box-shadow:0 0 40px rgba(74,159,212,0.06); }
        .feature-item { display:flex; align-items:center; gap:10px; font-size:0.85rem; color:#7a8fa4; font-weight:300; }
        .check { width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:10px; font-weight:700; }
        .plan-btn { width:100%; padding:14px; border-radius:10px; border:none; font-family:"DM Sans",sans-serif; font-size:0.95rem; font-weight:600; cursor:pointer; transition:all 0.2s; }
        .plan-btn:hover { opacity:0.85; }
        .compare-table { width:100%; border-collapse:collapse; }
        .compare-table th { padding:14px 16px; text-align:center; font-size:0.78rem; font-weight:600; color:#7a8fa4; letter-spacing:0.08em; text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,0.06); }
        .compare-table th:first-child { text-align:left; }
        .compare-table tr:nth-child(even) { background:rgba(255,255,255,0.015); }
        .compare-table td:first-child { padding:12px 16px; font-size:0.85rem; color:#7a8fa4; font-weight:300; text-align:left; }
        details { background:#111820; border:1px solid rgba(255,255,255,0.07); border-radius:12px; overflow:hidden; }
        details[open] { border-color:rgba(240,122,46,0.25); }
        details summary { padding:18px 22px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; font-weight:500; font-size:0.92rem; list-style:none; gap:12px; }
        details summary::-webkit-details-marker { display:none; }
        details summary::after { content:'+'; color:#f07a2e; font-size:1.1rem; font-weight:300; flex-shrink:0; }
        details[open] summary::after { content:'−'; }
        details summary:hover { color:#f07a2e; }
        .faq-body { padding:0 22px 18px; color:#7a8fa4; font-weight:300; line-height:1.7; font-size:0.88rem; }
      `}</style>

      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 40px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(11,15,20,0.95)', position:'sticky', top:0, zIndex:100, backdropFilter:'blur(10px)' }}>
        <Link href="/" style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.4rem', fontWeight:800, textDecoration:'none', color:'#e8edf2' }}>Remy<span style={{ color:'#f07a2e' }}>.</span></Link>
        <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
          {user ? (
            <Link href="/dashboard" style={{ background:'#f07a2e', color:'#fff', padding:'10px 20px', borderRadius:'8px', textDecoration:'none', fontSize:'0.88rem', fontWeight:600 }}>Dashboard</Link>
          ) : (
            <>
              <Link href="/auth" style={{ color:'#7a8fa4', textDecoration:'none', fontSize:'0.88rem' }}>Sign In</Link>
              <Link href="/onboard" style={{ background:'#f07a2e', color:'#fff', padding:'10px 20px', borderRadius:'8px', textDecoration:'none', fontSize:'0.88rem', fontWeight:600 }}>Get Started</Link>
            </>
          )}
        </div>
      </nav>

      <div style={{ maxWidth:'1160px', margin:'0 auto', padding:'72px 24px 80px' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:'64px' }}>
          <div style={{ display:'inline-block', background:'rgba(240,122,46,0.1)', border:'1px solid rgba(240,122,46,0.2)', borderRadius:'100px', padding:'5px 16px', fontSize:'0.72rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#f07a2e', marginBottom:'20px' }}>Pricing</div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'clamp(2rem, 5vw, 3.2rem)', fontWeight:900, marginBottom:'16px', letterSpacing:'-0.02em' }}>
            Simple, transparent pricing
          </h1>
          <p style={{ color:'#7a8fa4', fontSize:'1rem', fontWeight:300, lineHeight:1.7 }}>
            No setup fees. No contracts. Cancel anytime. One subscription covers your whole team.
          </p>
        </div>

        {/* Plan cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'16px', alignItems:'start', marginBottom:'80px' }}>
          {PLANS.map(plan => (
            <div key={plan.id} className={`plan-card ${plan.popular ? 'popular' : ''}`}>
              {plan.popular && (
                <div style={{ background:'rgba(74,159,212,0.1)', border:'1px solid rgba(74,159,212,0.3)', borderRadius:'20px', padding:'4px 12px', fontSize:'0.68rem', fontWeight:600, color:'#4a9fd4', textTransform:'uppercase', letterSpacing:'0.1em', alignSelf:'flex-start' }}>
                  Most Popular
                </div>
              )}
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.2rem', fontWeight:800, marginBottom:'4px', color: plan.color }}>{plan.name}</div>
                <div style={{ fontSize:'0.8rem', color:'#3d5268', fontWeight:300 }}>{plan.description}</div>
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:'4px' }}>
                <span style={{ fontFamily:"'Syne',sans-serif", fontSize:'2.6rem', fontWeight:900, color:'#e8edf2' }}>{plan.label}</span>
                <span style={{ color:'#3d5268', fontSize:'0.85rem' }}>{plan.sublabel}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'9px', flex:1 }}>
                {plan.features.map(f => (
                  <div key={f} className="feature-item">
                    <div className="check" style={{ background: plan.color + '22', color: plan.color }}>✓</div>
                    {f}
                  </div>
                ))}
              </div>
              <button
                className="plan-btn"
                onClick={() => checkout(plan.id, plan.ctaHref)}
                disabled={loading === plan.id}
                style={{ background: plan.popular ? plan.color : plan.id === 'free' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.06)', color: plan.popular ? '#fff' : '#e8edf2', border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.1)', opacity: loading === plan.id ? 0.6 : 1 }}
              >
                {loading === plan.id ? 'Loading...' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Feature comparison */}
        <div style={{ marginBottom:'80px' }}>
          <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'#3d5268', textAlign:'center', marginBottom:'14px' }}>Full comparison</div>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.6rem', fontWeight:800, textAlign:'center', marginBottom:'32px' }}>What you get on each plan</h2>
          <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', overflow:'auto' }}>
            <table className="compare-table">
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                  <th style={{ textAlign:'left', padding:'16px', width:'35%' }}></th>
                  {PLANS.map(p => (
                    <th key={p.id} style={{ color: p.color }}>
                      {p.name}
                      <div style={{ fontSize:'0.62rem', color:'#3d5268', fontWeight:300, marginTop:'2px', letterSpacing:0, textTransform:'none' }}>{p.label}{p.sublabel}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map(row => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <Cell val={row.free} color={PLANS[0].color} />
                    <Cell val={row.solo} color={PLANS[1].color} />
                    <Cell val={row.command} color={PLANS[2].color} />
                    <Cell val={row.enterprise} color={PLANS[3].color} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trust signals */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'12px', marginBottom:'80px' }}>
          {[
            { icon: '🔒', label: 'Secure payments via Stripe' },
            { icon: '↩️', label: 'Cancel anytime, no questions' },
            { icon: '⚡', label: 'Live in under 2 minutes' },
            { icon: '📱', label: 'Works on any phone' },
          ].map(item => (
            <div key={item.label} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'10px', padding:'16px 20px', display:'flex', alignItems:'center', gap:'12px' }}>
              <span style={{ fontSize:'1.2rem' }}>{item.icon}</span>
              <span style={{ fontSize:'0.82rem', color:'#7a8fa4', fontWeight:300 }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div style={{ maxWidth:'680px', margin:'0 auto', marginBottom:'80px' }}>
          <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'#3d5268', textAlign:'center', marginBottom:'14px' }}>FAQ</div>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.6rem', fontWeight:800, textAlign:'center', marginBottom:'28px' }}>Pricing questions</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            <details>
              <summary>Does one subscription cover my whole team?</summary>
              <div className="faq-body">Yes. You pay one flat monthly fee and invite your reps up to the limit on your plan. Each rep gets their own login and message allowance — you don&apos;t pay per seat on top of the plan price.</div>
            </details>
            <details>
              <summary>What counts as a &quot;message&quot;?</summary>
              <div className="faq-body">Every time a rep sends a message or voice prompt to Remy and gets a response, that counts as one message. Morning briefs, objection coaching, follow-up reminders — each exchange is one message. Limits reset at midnight every day.</div>
            </details>
            <details>
              <summary>Can I upgrade or downgrade anytime?</summary>
              <div className="faq-body">Yes. Upgrades take effect immediately — your new message limits apply right away. Downgrades take effect at the end of your current billing period. No penalties either way.</div>
            </details>
            <details>
              <summary>Is there a contract or commitment?</summary>
              <div className="faq-body">None. Remy is month-to-month. Cancel from your account settings any time and you won&apos;t be charged again. We don&apos;t do annual lock-ins or cancellation fees.</div>
            </details>
            <details>
              <summary>What payment methods do you accept?</summary>
              <div className="faq-body">All major credit and debit cards via Stripe. We do not accept checks, wire transfers, or purchase orders at this time. Enterprise customers can contact us for invoicing options.</div>
            </details>
            <details>
              <summary>Do I need to install anything?</summary>
              <div className="faq-body">No. Remy runs in the browser on any phone or computer. Reps can add it to their home screen for an app-like experience, but there is nothing to download from the App Store or Google Play.</div>
            </details>
          </div>
        </div>

        {/* Enterprise CTA */}
        <div style={{ textAlign:'center', padding:'48px', background:'rgba(240,122,46,0.04)', border:'1px solid rgba(240,122,46,0.1)', borderRadius:'16px' }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.4rem', fontWeight:800, marginBottom:'10px' }}>Team larger than 15?</div>
          <div style={{ color:'#7a8fa4', fontSize:'0.9rem', fontWeight:300, marginBottom:'24px', lineHeight:1.7 }}>Custom pricing for large teams, multi-location operations, and franchise networks.<br />We&apos;ll set up your doctrine, onboard your team, and be your dedicated support contact.</div>
          <a href="mailto:hello@getremy.dev" style={{ display:'inline-block', background:'transparent', border:'1px solid rgba(255,255,255,0.15)', color:'#e8edf2', padding:'13px 32px', borderRadius:'10px', textDecoration:'none', fontSize:'0.9rem', fontWeight:500 }}>Contact Us</a>
        </div>
      </div>
    </div>
  );
}
