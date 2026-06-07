import Link from 'next/link';
import dynamic from 'next/dynamic';
const RemyCore = dynamic(() => import('../components/RemyCore'), { ssr: false });

export default function LandingPage() {
  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .hero-grad { background: radial-gradient(ellipse at 50% 0%, rgba(240,122,46,0.12) 0%, transparent 70%); }
        .feature-card { background:#111820; border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:24px; }
        .feature-card:hover { border-color:rgba(240,122,46,0.2); }
        .cta-btn { display:inline-block; background:#f07a2e; color:#fff; padding:14px 32px; border-radius:10px; font-family:"DM Sans",sans-serif; font-size:1rem; font-weight:600; text-decoration:none; transition:opacity 0.2s; }
        .cta-btn:hover { opacity:0.9; }
        .cta-btn-outline { display:inline-block; background:transparent; color:#e8edf2; padding:14px 32px; border-radius:10px; font-family:"DM Sans",sans-serif; font-size:1rem; font-weight:500; text-decoration:none; border:1px solid rgba(255,255,255,0.15); }
        .stat { font-family:"Syne",sans-serif; font-size:2.5rem; font-weight:900; color:#f07a2e; }
        .quote-card { background:rgba(240,122,46,0.04); border:1px solid rgba(240,122,46,0.15); border-radius:14px; padding:28px; }
      `}</style>

      {/* Nav */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 40px', borderBottom:'1px solid rgba(255,255,255,0.06)', position:'sticky', top:0, background:'rgba(11,15,20,0.95)', backdropFilter:'blur(10px)', zIndex:100 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.4rem', fontWeight:800 }}>Remy<span style={{ color:'#f07a2e' }}>.</span></div>
        <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
          <Link href="/pricing" style={{ color:'#7a8fa4', textDecoration:'none', fontSize:'0.9rem' }}>Pricing</Link>
          <Link href="/auth" style={{ color:'#7a8fa4', textDecoration:'none', fontSize:'0.9rem' }}>Sign In</Link>
          <Link href="/onboard" className="cta-btn" style={{ padding:'10px 20px', fontSize:'0.88rem' }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="hero-grad" style={{ padding:'100px 40px 80px', textAlign:'center', maxWidth:'900px', margin:'0 auto' }}>
        <div style={{ display:'inline-block', background:'rgba(240,122,46,0.1)', border:'1px solid rgba(240,122,46,0.25)', borderRadius:'100px', padding:'6px 16px', fontSize:'0.78rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#f07a2e', marginBottom:'28px' }}>
          AI Co-Pilot for Home Services Reps
        </div>
        <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'clamp(2.2rem, 5vw, 4rem)', fontWeight:900, lineHeight:1.1, marginBottom:'24px', letterSpacing:'-0.02em' }}>
          The AI co-pilot built for<br /><span style={{ color:'#f07a2e' }}>home services reps.</span>
        </h1>
        <p style={{ fontSize:'1.15rem', color:'#7a8fa4', fontWeight:300, lineHeight:1.7, marginBottom:'40px', maxWidth:'600px', margin:'0 auto 40px' }}>
          Remy rides along with your field reps. Pre-job briefs, live objection coaching, weather intel, and proactive suggestions. All hands-free, all voice-first.
        </p>
        <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/onboard" className="cta-btn">Start Free Trial</Link>
          <Link href="/pricing" className="cta-btn-outline">See Pricing</Link>
        </div>
      </div>

      {/* Social proof bar */}
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'32px 40px', display:'flex', justifyContent:'center', gap:'60px', flexWrap:'wrap' }}>
        {[
          { stat: '2 min', label: 'avg time to first brief' },
          { stat: '40%', label: 'faster objection response' },
          { stat: '0', label: 'CRM inputs required' },
        ].map(item => (
          <div key={item.label} style={{ textAlign:'center' }}>
            <div className="stat">{item.stat}</div>
            <div style={{ fontSize:'0.82rem', color:'#3d5268', marginTop:'4px', fontWeight:300 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Arc Reactor Visual */}
      <div style={{ padding:'60px 40px 20px', textAlign:'center' }}>
        <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'#f07a2e', marginBottom:'32px' }}>Field Intelligence Network</div>
        <div style={{ maxWidth:'700px', margin:'0 auto', borderRadius:'16px', overflow:'hidden', border:'1px solid rgba(240,122,46,0.12)' }}>
          <RemyCore />
        </div>
        <div style={{ fontSize:'0.78rem', color:'#2d3f52', marginTop:'16px', fontWeight:300 }}>6 integrated systems. Zero CRM inputs required.</div>
      </div>

      {/* Features */}
      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'80px 40px' }}>
        <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:'2rem', fontWeight:800, textAlign:'center', marginBottom:'48px' }}>
          Built for reps who are always on the move
        </h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'16px' }}>
          {[
            { title: 'Pre-Job Brief', desc: 'Pull up to a job and Remy briefs you in 10 seconds. Customer intel, weather, objections to expect, and your opening line.', icon: 'MIC' },
            { title: 'Live Objection Coaching', desc: 'Customer says the price is too high. You say nothing. Remy gives you the exact words to respond with before you open your mouth.', icon: 'ACT' },
            { title: 'GPS Co-Pilot', desc: 'Remy watches where you are. Arrive at a job and she briefs you. Leave a job and she tells you what is nearby and what is next.', icon: 'GPS' },
            { title: 'Boss Command Center', desc: 'See every rep, every job, every conversation from one dashboard. Broadcast updates to the whole team instantly.', icon: 'CMD' },
            { title: 'Company Doctrine', desc: 'Upload your pricing, scripts, and objection playbooks. Every rep gets the same training, enforced by Remy on every call.', icon: 'DOC' },
            { title: 'Works Hands-Free', desc: 'Voice-first design. Reps talk, Remy responds and speaks back. No tapping, no typing, no CRM inputs required.', icon: 'VOC' },
          ].map(f => (
            <div key={f.title} className="feature-card">
              <div style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.12em', color:'#f07a2e', background:'rgba(240,122,46,0.08)', padding:'4px 10px', borderRadius:'4px', display:'inline-block', marginBottom:'14px' }}>{f.icon}</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'1.05rem', marginBottom:'10px' }}>{f.title}</div>
              <div style={{ color:'#7a8fa4', fontSize:'0.88rem', fontWeight:300, lineHeight:1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quote */}
      <div style={{ maxWidth:'700px', margin:'0 auto', padding:'0 40px 80px' }}>
        <div className="quote-card">
          <div style={{ fontSize:'1.2rem', lineHeight:1.7, color:'#e8edf2', fontWeight:300, marginBottom:'20px' }}>
            I pulled up to a roofing job and before I got out of the truck, Remy told me there was a storm coming Thursday and gave me the exact line to use at the door. Signed the deal in 20 minutes.
          </div>
          <div style={{ fontSize:'0.82rem', color:'#3d5268' }}>Field rep, residential roofing â€” South Florida</div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ background:'rgba(240,122,46,0.04)', borderTop:'1px solid rgba(240,122,46,0.1)', padding:'80px 40px', textAlign:'center' }}>
        <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:'2.2rem', fontWeight:800, marginBottom:'16px' }}>Ready to put Remy in the truck?</h2>
        <p style={{ color:'#7a8fa4', marginBottom:'32px', fontWeight:300 }}>Set up your company in 2 minutes. No credit card required to start.</p>
        <Link href="/onboard" className="cta-btn" style={{ fontSize:'1.05rem', padding:'16px 40px' }}>Get Started Free</Link>
      </div>

      {/* Footer */}
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'24px 40px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'1rem' }}>Remy<span style={{ color:'#f07a2e' }}>.</span></div>
        <div style={{ fontSize:'0.78rem', color:'#2d3f52' }}>Built for home services. Powered by AI.</div>
        <div style={{ display:'flex', gap:'20px' }}>
          <Link href="/pricing" style={{ color:'#3d5268', textDecoration:'none', fontSize:'0.78rem' }}>Pricing</Link>
          <Link href="/auth" style={{ color:'#3d5268', textDecoration:'none', fontSize:'0.78rem' }}>Sign In</Link>
        </div>
      </div>
    </div>
  );
}
