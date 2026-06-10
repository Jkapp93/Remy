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
        .feature-card { background:#111820; border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:24px; transition:border-color 0.2s; }
        .feature-card:hover { border-color:rgba(240,122,46,0.2); }
        .cta-btn { display:inline-block; background:#f07a2e; color:#fff; padding:14px 32px; border-radius:10px; font-family:"DM Sans",sans-serif; font-size:1rem; font-weight:600; text-decoration:none; transition:opacity 0.2s; }
        .cta-btn:hover { opacity:0.9; }
        .cta-btn-outline { display:inline-block; background:transparent; color:#e8edf2; padding:14px 32px; border-radius:10px; font-family:"DM Sans",sans-serif; font-size:1rem; font-weight:500; text-decoration:none; border:1px solid rgba(255,255,255,0.15); transition:border-color 0.2s; }
        .cta-btn-outline:hover { border-color:rgba(255,255,255,0.3); }
        .stat { font-family:"Syne",sans-serif; font-size:2.5rem; font-weight:900; color:#f07a2e; }
        .quote-card { background:rgba(240,122,46,0.04); border:1px solid rgba(240,122,46,0.15); border-radius:14px; padding:28px; }
        .trust-card { background:#111820; border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:28px 24px; text-align:center; }
        .step-connector { width:40px; height:2px; background:linear-gradient(90deg, rgba(240,122,46,0.4), rgba(240,122,46,0.1)); flex-shrink:0; margin-top:28px; }
        details { background:#111820; border:1px solid rgba(255,255,255,0.07); border-radius:12px; overflow:hidden; transition:border-color 0.2s; }
        details[open] { border-color:rgba(240,122,46,0.25); }
        details summary { padding:20px 24px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; font-weight:500; font-size:0.95rem; list-style:none; gap:12px; }
        details summary::-webkit-details-marker { display:none; }
        details summary::after { content:'+'; color:#f07a2e; font-size:1.2rem; font-weight:300; flex-shrink:0; transition:transform 0.2s; }
        details[open] summary::after { content:'−'; }
        details summary:hover { color:#f07a2e; }
        .faq-body { padding:0 24px 20px; color:#7a8fa4; font-weight:300; line-height:1.7; font-size:0.9rem; }
        @media (max-width:768px) {
          .hide-mobile { display:none; }
          .step-connector { display:none; }
        }
      `}</style>

      {/* Nav */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 40px', borderBottom:'1px solid rgba(255,255,255,0.06)', position:'sticky', top:0, background:'rgba(11,15,20,0.95)', backdropFilter:'blur(10px)', zIndex:100 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.4rem', fontWeight:800 }}>Remy<span style={{ color:'#f07a2e' }}>.</span></div>
        <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
          <Link href="/pricing" style={{ color:'#7a8fa4', textDecoration:'none', fontSize:'0.9rem' }}>Pricing</Link>
          <Link href="/auth" style={{ color:'#7a8fa4', textDecoration:'none', fontSize:'0.9rem' }}>Sign In</Link>
          <Link href="/demo" style={{ color:'#f07a2e', textDecoration:'none', fontSize:'0.88rem', fontWeight:600, border:'1px solid rgba(240,122,46,0.3)', padding:'10px 20px', borderRadius:'10px' }}>Try Demo</Link>
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
          <Link href="/demo" className="cta-btn">See Remy Live</Link>
          <Link href="/onboard" className="cta-btn-outline">Start Free Trial</Link>
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

      {/* How it works — 3 steps */}
      <div style={{ maxWidth:'900px', margin:'0 auto', padding:'80px 40px 40px' }}>
        <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'#f07a2e', textAlign:'center', marginBottom:'16px' }}>How it works</div>
        <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.9rem', fontWeight:800, textAlign:'center', marginBottom:'52px' }}>
          From truck to signed contract in three moves
        </h2>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'center', gap:'0', flexWrap:'wrap', rowGap:'32px' }}>
          {[
            { num: '01', title: 'Load your job', body: 'Tap the job in Remy and say "brief me." In 10 seconds you have the customer\'s situation, what objections to expect, and your opening line.' },
            { num: '02', title: 'Remy coaches you live', body: 'Price objection? Competitor bid? Spouse isn\'t home? Say it out loud and Remy gives you the exact response — in your ear before you open your mouth.' },
            { num: '03', title: 'Log the outcome', body: 'One tap. Won it, lost it, or follow up. Remy saves the note, updates the job, and schedules the call back — all without touching a CRM.' },
          ].map((step, i) => (
            <div key={step.num} style={{ display:'flex', alignItems:'flex-start', gap:'0' }}>
              <div style={{ maxWidth:'240px', textAlign:'center', padding:'0 16px' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'2rem', fontWeight:900, color:'rgba(240,122,46,0.25)', marginBottom:'12px' }}>{step.num}</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'10px', color:'#e8edf2' }}>{step.title}</div>
                <div style={{ color:'#7a8fa4', fontSize:'0.85rem', fontWeight:300, lineHeight:1.7 }}>{step.body}</div>
              </div>
              {i < 2 && <div className="step-connector hide-mobile" />}
            </div>
          ))}
        </div>
      </div>

      {/* Arc Reactor Visual */}
      <div style={{ padding:'40px 40px 20px', textAlign:'center' }}>
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

      {/* Team doctrine story */}
      <div style={{ background:'rgba(240,122,46,0.03)', borderTop:'1px solid rgba(240,122,46,0.08)', borderBottom:'1px solid rgba(240,122,46,0.08)', padding:'80px 40px' }}>
        <div style={{ maxWidth:'1000px', margin:'0 auto' }}>
          <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'#f07a2e', textAlign:'center', marginBottom:'16px' }}>For your whole team</div>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.9rem', fontWeight:800, textAlign:'center', marginBottom:'16px' }}>
            Your best rep&#39;s playbook, in every rep&#39;s ear
          </h2>
          <p style={{ color:'#7a8fa4', textAlign:'center', fontWeight:300, lineHeight:1.7, marginBottom:'52px', maxWidth:'560px', margin:'0 auto 52px' }}>
            Write your scripts once. Remy enforces them on every knock, for every rep, every day.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:'16px' }}>
            {[
              { step: '1', title: 'Manager writes the playbook', body: 'Add your pricing, rebuttals, objection scripts, and company standards in plain English. Takes 10 minutes.' },
              { step: '2', title: 'Remy learns it instantly', body: 'Every rep on your team gets the updated doctrine the moment you save it. No training session required.' },
              { step: '3', title: 'Reps sell the same way', body: 'Remy enforces your best-performing script in real time, on every call, without you being in the truck.' },
            ].map(item => (
              <div key={item.step} style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'28px 24px' }}>
                <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'rgba(240,122,46,0.12)', border:'1px solid rgba(240,122,46,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'0.88rem', color:'#f07a2e', marginBottom:'16px' }}>{item.step}</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'10px' }}>{item.title}</div>
                <div style={{ color:'#7a8fa4', fontSize:'0.85rem', fontWeight:300, lineHeight:1.7 }}>{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quote */}
      <div style={{ maxWidth:'700px', margin:'0 auto', padding:'80px 40px 40px' }}>
        <div className="quote-card">
          <div style={{ fontSize:'1.2rem', lineHeight:1.7, color:'#e8edf2', fontWeight:300, marginBottom:'20px' }}>
            I pulled up to a roofing job and before I got out of the truck, Remy told me there was a storm coming Thursday and gave me the exact line to use at the door. Signed the deal in 20 minutes.
          </div>
          <div style={{ fontSize:'0.82rem', color:'#3d5268' }}>Field rep, residential roofing — South Florida</div>
        </div>
      </div>

      {/* Trust section */}
      <div style={{ maxWidth:'1000px', margin:'0 auto', padding:'40px 40px 80px' }}>
        <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'#3d5268', textAlign:'center', marginBottom:'16px' }}>Built to last</div>
        <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.7rem', fontWeight:800, textAlign:'center', marginBottom:'40px' }}>
          You&#39;re in good hands
        </h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(210px, 1fr))', gap:'12px' }}>
          {[
            { icon: '📱', title: 'Any phone, any OS', body: 'iOS, Android, or browser. No app install required. Works in the truck with one bar of signal.' },
            { icon: '🔒', title: 'Your data stays yours', body: 'Company doctrine and rep conversations are isolated per account. No cross-tenant data access — ever.' },
            { icon: '☁️', title: 'Nothing to install', body: 'Remy runs entirely in the cloud. No hardware, no downloads, no IT team required to get started.' },
            { icon: '⚡', title: 'Up in 2 minutes', body: 'Create your company, invite your first rep, add your doctrine. That is the entire setup.' },
          ].map(item => (
            <div key={item.title} className="trust-card">
              <div style={{ fontSize:'1.8rem', marginBottom:'12px' }}>{item.icon}</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'0.95rem', marginBottom:'8px' }}>{item.title}</div>
              <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300, lineHeight:1.6 }}>{item.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth:'720px', margin:'0 auto', padding:'0 40px 80px' }}>
        <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'#3d5268', textAlign:'center', marginBottom:'16px' }}>FAQ</div>
        <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.7rem', fontWeight:800, textAlign:'center', marginBottom:'32px' }}>
          Common questions
        </h2>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <details>
            <summary>Does Remy work on iPhone and Android?</summary>
            <div className="faq-body">Yes. Remy runs in the browser so there is nothing to install. It works on any smartphone — iPhone, Android, or tablet. The voice feature uses your phone&apos;s built-in microphone and speaker, including AirPods and Bluetooth headsets.</div>
          </details>
          <details>
            <summary>Do my reps need to be tech-savvy?</summary>
            <div className="faq-body">No. If they can make a phone call, they can use Remy. The whole interface is voice-first — reps tap one button to talk and Remy talks back. We built it specifically for people who hate apps and CRMs.</div>
          </details>
          <details>
            <summary>What trades does Remy work for?</summary>
            <div className="faq-body">Remy works for any home services trade: roofing, HVAC, plumbing, fencing, solar, painting, restoration, pest control, and more. The Company Doctrine feature lets you customize Remy for your specific trade, pricing, and objections.</div>
          </details>
          <details>
            <summary>How does team sharing work?</summary>
            <div className="faq-body">Owners invite reps via email. Reps join the company and immediately get access to the shared playbook. Managers can see all rep activity, broadcast messages to the whole team, and update the doctrine any time — all from the Boss Command Center.</div>
          </details>
          <details>
            <summary>Is my company data secure?</summary>
            <div className="faq-body">Yes. Every company has fully isolated data — no rep or manager can see another company&apos;s information. All data is encrypted in transit and at rest. We use enterprise-grade infrastructure via Supabase and Clerk for authentication.</div>
          </details>
          <details>
            <summary>What does it cost?</summary>
            <div className="faq-body">Remy starts free with 20 messages per day. Paid plans unlock more daily messages, team features, and the Boss Command Center. See the <Link href="/pricing" style={{ color:'#f07a2e', textDecoration:'none' }}>pricing page</Link> for full details. No credit card required to start.</div>
          </details>
        </div>
      </div>

      {/* Final CTA */}
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
