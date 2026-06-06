import Link from 'next/link';

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
        <div style={{ maxWidth:'560px', margin:'0 auto', borderRadius:'16px', overflow:'hidden', border:'1px solid rgba(240,122,46,0.12)', background:'#030810' }}>
          <canvas id="remyCore" style={{ width:'100%', height:'420px', display:'block' }} />
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

      {/* Arc Reactor Script */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          function initCore() {
            const cv = document.getElementById('remyCore');
            if (!cv) return;
            const ctx = cv.getContext('2d');
            function rs() { cv.width = cv.offsetWidth * devicePixelRatio; cv.height = cv.offsetHeight * devicePixelRatio; ctx.scale(devicePixelRatio, devicePixelRatio); }
            rs();
            window.addEventListener('resize', rs);
            const W = () => cv.offsetWidth, H = () => cv.offsetHeight;
            const CX = () => W()/2, CY = () => H()/2;
            const r2d = d => d * Math.PI / 180;
            const NODES = [
              { label: ['Voice','Brief'], a: -90, col: '#f07a2e', r: 155 },
              { label: ['GPS','Co-Pilot'], a: -30, col: '#00cfff', r: 155 },
              { label: ['Weather','Intel'], a: 30, col: '#3daf76', r: 155 },
              { label: ['Job','Notes'], a: 90, col: '#b47aff', r: 155 },
              { label: ['CRM','Sync'], a: 150, col: '#ff6b6b', r: 155 },
              { label: ['Live','Coaching'], a: 210, col: '#ffd166', r: 155 },
            ];
            const PARTICLES = Array.from({length:40}, () => ({ angle: Math.random()*360, orbitR: 70+Math.random()*110, speed: (0.2+Math.random()*0.5)*(Math.random()>0.5?1:-1), alpha: 0.1+Math.random()*0.35, size: 0.5+Math.random()*1.2, col: ['#f07a2e','#00cfff','#3daf76','#b47aff'][Math.floor(Math.random()*4)] }));
            let t = 0;
            function drawRing(x,y,rad,lw,col,alpha,dash,offset,speed) { ctx.save(); ctx.globalAlpha=alpha; ctx.strokeStyle=col; ctx.lineWidth=lw; if(dash>0){ctx.setLineDash([dash,dash*1.5]);ctx.lineDashOffset=-offset*speed;} ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
            function drawCore(x,y) {
              const pulse=(Math.sin(t*2)+1)/2; const r=46;
              ctx.save(); ctx.globalAlpha=0.05+pulse*0.04; ctx.fillStyle='#f07a2e'; ctx.beginPath(); ctx.arc(x,y,r+32,0,Math.PI*2); ctx.fill(); ctx.restore();
              for(let i=0;i<12;i++){const a=r2d(i*30+t*20);ctx.save();ctx.strokeStyle='#f07a2e';ctx.lineWidth=i%3===0?2.5:1;ctx.globalAlpha=i%3===0?0.9:0.35;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*(r-12),y+Math.sin(a)*(r-12));ctx.lineTo(x+Math.cos(a)*(r-3),y+Math.sin(a)*(r-3));ctx.stroke();ctx.restore();}
              ctx.save(); ctx.fillStyle='#070e18'; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#f07a2e'; ctx.lineWidth=2; ctx.globalAlpha=0.9; ctx.stroke(); ctx.restore();
              ctx.save(); ctx.fillStyle='#f07a2e'; ctx.globalAlpha=0.95; ctx.font="800 11px 'DM Sans',sans-serif"; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('REMY',x,y-5); ctx.globalAlpha=0.4; ctx.font="300 7px 'DM Sans',sans-serif"; ctx.fillText('AI CORE',x,y+6); ctx.restore();
              const scanA=r2d(t*60); ctx.save(); ctx.globalAlpha=0.06; ctx.fillStyle='#f07a2e'; ctx.beginPath(); ctx.moveTo(x,y); ctx.arc(x,y,195,scanA,scanA+r2d(35)); ctx.closePath(); ctx.fill(); ctx.restore();
            }
            function drawNode(x,y,node,i) {
              const a=r2d(node.a)+t*0.25+Math.sin(t*1.5+i*1.1)*0.03;
              const nx=x+Math.cos(a)*node.r, ny=y+Math.sin(a)*node.r;
              const pulse=(Math.sin(t*2.5+i*1.3)+1)/2; const nr=25;
              ctx.save(); ctx.strokeStyle=node.col; ctx.lineWidth=0.5; ctx.globalAlpha=0.15; ctx.setLineDash([3,5]); ctx.beginPath(); ctx.moveTo(x+Math.cos(a)*63,y+Math.sin(a)*63); ctx.lineTo(nx-Math.cos(a)*nr,ny-Math.sin(a)*nr); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
              ctx.save(); ctx.globalAlpha=0.07+pulse*0.06; ctx.fillStyle=node.col; ctx.beginPath(); ctx.arc(nx,ny,nr+10,0,Math.PI*2); ctx.fill(); ctx.restore();
              ctx.save(); ctx.fillStyle='#0a1520'; ctx.beginPath(); ctx.arc(nx,ny,nr,0,Math.PI*2); ctx.fill(); ctx.restore();
              ctx.save(); ctx.strokeStyle=node.col; ctx.lineWidth=1.5; ctx.globalAlpha=0.85; ctx.beginPath(); ctx.arc(nx,ny,nr,0,Math.PI*2); ctx.stroke(); ctx.restore();
              const arcS=r2d(-t*80); ctx.save(); ctx.strokeStyle=node.col; ctx.lineWidth=2; ctx.globalAlpha=0.6; ctx.beginPath(); ctx.arc(nx,ny,nr+5,arcS,arcS+r2d(90)); ctx.stroke(); ctx.restore();
              const dotA=r2d(t*150+i*60); ctx.save(); ctx.fillStyle=node.col; ctx.globalAlpha=1; ctx.beginPath(); ctx.arc(nx+Math.cos(dotA)*(nr+2),ny+Math.sin(dotA)*(nr+2),2,0,Math.PI*2); ctx.fill(); ctx.restore();
              ctx.save(); ctx.fillStyle=node.col; ctx.globalAlpha=0.95; ctx.font="600 8px 'DM Sans',sans-serif"; ctx.textAlign='center'; ctx.textBaseline='middle';
              node.label.forEach((line,li)=>ctx.fillText(line,nx,ny+(li-(node.label.length-1)/2)*9));
              ctx.restore();
            }
            function frame() {
              const w=W(),h=H(),x=CX(),y=CY();
              ctx.clearRect(0,0,w,h); ctx.fillStyle='#030810'; ctx.fillRect(0,0,w,h);
              PARTICLES.forEach(p=>{ p.angle+=p.speed*0.3; const px=x+Math.cos(r2d(p.angle))*p.orbitR,py=y+Math.sin(r2d(p.angle))*p.orbitR; ctx.save(); ctx.globalAlpha=p.alpha*(0.6+0.4*Math.sin(t*2+p.angle)); ctx.fillStyle=p.col; ctx.beginPath(); ctx.arc(px,py,p.size,0,Math.PI*2); ctx.fill(); ctx.restore(); });
              drawRing(x,y,63,0.5,'#f07a2e',0.15,8,t,30);
              drawRing(x,y,92,0.5,'#00cfff',0.08,5,t,-20);
              drawRing(x,y,122,1,'#f07a2e',0.1,0,0,0);
              drawRing(x,y,135,0.5,'#f07a2e',0.06,12,t,15);
              drawRing(x,y,185,0.5,'#00cfff',0.05,6,t,-8);
              for(let i=0;i<3;i++){const progress=((t*0.4+i*0.33)%1);const a=r2d(-90+i*120+t*15);const pr=63+(185-63)*progress;ctx.save();ctx.fillStyle='#f07a2e';ctx.globalAlpha=(1-progress)*0.5;ctx.beginPath();ctx.arc(x+Math.cos(a)*pr,y+Math.sin(a)*pr,2,0,Math.PI*2);ctx.fill();ctx.restore();}
              NODES.forEach((node,i)=>drawNode(x,y,node,i));
              drawCore(x,y);
              t+=0.003; requestAnimationFrame(frame);
            }
            frame();
          }
          if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCore);
          else initCore();
        })();
      `}} />

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
