'use client';
import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

const TRADES = [
  { id: 'roofing', label: 'Roofing', icon: 'ROOF' },
  { id: 'restoration', label: 'Restoration', icon: 'REST' },
  { id: 'fencing', label: 'Fencing', icon: 'FENC' },
  { id: 'painting', label: 'Painting', icon: 'PANT' },
  { id: 'hvac', label: 'HVAC', icon: 'HVAC' },
  { id: 'plumbing', label: 'Plumbing', icon: 'PLMB' },
  { id: 'solar', label: 'Solar', icon: 'SOLR' },
  { id: 'other', label: 'Other', icon: 'OTH' },
];

function RemyOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const cx = cv.getContext('2d')!;
    let animId: number;
    let t = 0;
    const ORANGE = '#f07a2e';
    const rd = (d: number) => d * Math.PI / 180;

    function rs() {
      if (!cv) return;
      cv.width = cv.offsetWidth * devicePixelRatio;
      cv.height = cv.offsetHeight * devicePixelRatio;
      cx.scale(devicePixelRatio, devicePixelRatio);
    }
    rs();

    function ring(x: number, y: number, r: number, lw: number, col: string, alpha: number, dash?: number[], off?: number) {
      if (r <= 0) return;
      cx.save(); cx.strokeStyle = col; cx.lineWidth = lw; cx.globalAlpha = alpha;
      if (dash) { cx.setLineDash(dash); cx.lineDashOffset = off || 0; }
      cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.stroke();
      cx.setLineDash([]); cx.restore();
    }

    function frame() {
      if (!cv) return;
      const w = cv.offsetWidth, h = cv.offsetHeight;
      const x = w / 2, y = h / 2;
      cx.clearRect(0, 0, w, h);

      // Outer glow
      const pulse = (Math.sin(t * 1.5) + 1) / 2;
      const glow = cx.createRadialGradient(x, y, 0, x, y, 180);
      glow.addColorStop(0, `rgba(240,122,46,${0.12 + pulse * 0.06})`);
      glow.addColorStop(0.5, `rgba(240,122,46,0.04)`);
      glow.addColorStop(1, 'transparent');
      cx.save(); cx.fillStyle = glow; cx.beginPath(); cx.arc(x, y, 180, 0, Math.PI * 2); cx.fill(); cx.restore();

      // Rotating outer rings
      ring(x, y, 140, 0.5, ORANGE, 0.08, [4, 8], -t * 20);
      ring(x, y, 120, 0.5, ORANGE, 0.06, [2, 6], t * 15);

      // Spinning arc segments
      for (let i = 0; i < 3; i++) {
        const startA = rd(t * 60 + i * 120);
        cx.save(); cx.strokeStyle = ORANGE; cx.lineWidth = 8; cx.globalAlpha = 0.12 + i * 0.04; cx.lineCap = 'round';
        cx.beginPath(); cx.arc(x, y, 100 - i * 12, startA, startA + rd(70)); cx.stroke(); cx.restore();
        cx.save(); cx.strokeStyle = ORANGE; cx.lineWidth = 2; cx.globalAlpha = 0.6 - i * 0.1; cx.lineCap = 'round';
        cx.beginPath(); cx.arc(x, y, 100 - i * 12, startA, startA + rd(70)); cx.stroke(); cx.restore();
      }

      // Counter-rotating arcs
      const counterA = rd(-t * 45);
      cx.save(); cx.strokeStyle = ORANGE; cx.lineWidth = 6; cx.globalAlpha = 0.15; cx.lineCap = 'round';
      cx.beginPath(); cx.arc(x, y, 76, counterA, counterA + rd(110)); cx.stroke(); cx.restore();
      cx.save(); cx.strokeStyle = ORANGE; cx.lineWidth = 1.5; cx.globalAlpha = 0.7; cx.lineCap = 'round';
      cx.beginPath(); cx.arc(x, y, 76, counterA, counterA + rd(110)); cx.stroke(); cx.restore();

      // Tick marks
      for (let i = 0; i < 48; i++) {
        const a = rd(i * 7.5 + t * 10);
        const big = i % 6 === 0;
        cx.save(); cx.strokeStyle = ORANGE; cx.lineWidth = big ? 1.2 : 0.4; cx.globalAlpha = big ? 0.5 : 0.15;
        cx.beginPath();
        cx.moveTo(x + Math.cos(a) * (58 - (big ? 7 : 3)), y + Math.sin(a) * (58 - (big ? 7 : 3)));
        cx.lineTo(x + Math.cos(a) * 58, y + Math.sin(a) * 58);
        cx.stroke(); cx.restore();
      }

      // Core disc
      cx.save(); cx.fillStyle = '#010407'; cx.beginPath(); cx.arc(x, y, 48, 0, Math.PI * 2); cx.fill(); cx.restore();
      ring(x, y, 48, 2, ORANGE, 0.9);
      ring(x, y, 42, 0.5, ORANGE, 0.15);

      // Inner pulse ring
      const innerR = 28 + pulse * 4;
      ring(x, y, innerR, 1, ORANGE, 0.2 + pulse * 0.1, [2, 4], -t * 30);

      // REMY text
      cx.save(); cx.fillStyle = ORANGE; cx.globalAlpha = 1;
      cx.font = "900 14px 'Syne', sans-serif"; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText('REMY', x, y - 6);
      cx.globalAlpha = 0.3; cx.font = "300 4.5px 'Share Tech Mono', monospace";
      cx.fillText('FIELD INTELLIGENCE', x, y + 8); cx.restore();

      // Center dot pulse
      cx.save(); cx.fillStyle = ORANGE; cx.globalAlpha = 0.9 + pulse * 0.1;
      cx.beginPath(); cx.arc(x, y + 18, 2 + pulse, 0, Math.PI * 2); cx.fill(); cx.restore();

      // Orbiting dot
      const orbitA = rd(t * 80);
      cx.save(); cx.fillStyle = ORANGE; cx.globalAlpha = 0.8;
      cx.beginPath(); cx.arc(x + Math.cos(orbitA) * 48, y + Math.sin(orbitA) * 48, 3, 0, Math.PI * 2); cx.fill();
      cx.restore();

      t += 0.004;
      animId = requestAnimationFrame(frame);
    }
    frame();
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} style={{ width: '280px', height: '280px', display: 'block' }} />;
}

export default function OnboardPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [trade, setTrade] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isLoaded || !user) return;
    fetch('/api/onboard-check?clerkId=' + user.id)
      .then(r => r.json())
      .then(d => { if (d.onboarded) router.push(d.redirect); })
      .catch(() => {});
  }, [isLoaded, user]);

  const save = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: user.id,
          email: user.emailAddresses[0]?.emailAddress,
          fullName: user.fullName,
          companyName: companyName || `${user.firstName || 'My'} Company`,
          trade,
          role: 'owner',
        }),
      });
      const data = await res.json();
      // Fire-and-forget: generate doctrine from website in background
      if (websiteUrl && data.companyId) {
        fetch('/api/onboard-doctrine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ websiteUrl, companyId: data.companyId, trade }),
        }).catch(() => {});
      }
      setStep(3);
      setTimeout(() => router.push('/dashboard/voice'), 2500);
    } catch { setSaving(false); }
  };

  const name = user?.firstName || '';

  return (
    <div style={{ background: '#010407', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500;600&family=Share+Tech+Mono&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .fade-up { animation: fadeUp 0.6s ease forwards; }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        .trade-btn { background: #0d1117; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px 16px; cursor: pointer; color: #e8edf2; font-family: 'DM Sans', sans-serif; font-weight: 500; font-size: 0.88rem; text-align: left; display: flex; align-items: center; gap: 10px; transition: all 0.15s; }
        .trade-btn:hover { border-color: rgba(240,122,46,0.3); }
        .trade-btn.selected { background: rgba(240,122,46,0.1); border-color: #f07a2e; color: #f07a2e; }
      `}</style>

      {/* Background grid */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(240,122,46,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(240,122,46,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />

      {/* Step 0 â€” Hero landing */}
      {step === 0 && (
        <div className="fade-up" style={{ textAlign: 'center', maxWidth: '520px', width: '100%' }}>
          {mounted && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <RemyOrb />
            </div>
          )}
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 'clamp(2rem, 6vw, 3rem)', lineHeight: 1.1, marginBottom: '16px' }}>
            Remy rides<br /><span style={{ color: '#f07a2e' }}>with you.</span>
          </div>
          <div style={{ color: '#7a8fa4', fontSize: '0.95rem', fontWeight: 300, lineHeight: 1.8, marginBottom: '16px' }}>
            The AI field partner built for reps who close.<br />
            Pre-job briefs. Live coaching. Zero admin.
          </div>
          {name && (
            <div style={{ color: '#f07a2e', fontSize: '0.82rem', fontWeight: 500, letterSpacing: '0.05em', marginBottom: '32px' }}>
              Welcome, {name}.
            </div>
          )}
          <button onClick={() => setStep(1)}
            style={{ background: '#f07a2e', color: '#fff', border: 'none', borderRadius: '14px', padding: '18px 48px', fontFamily: "'Syne',sans-serif", fontSize: '1rem', fontWeight: 800, cursor: 'pointer', width: '100%', letterSpacing: '0.05em', boxShadow: '0 0 40px rgba(240,122,46,0.3)' }}>
            GET STARTED
          </button>
          <div style={{ color: '#2d3f52', fontSize: '0.72rem', marginTop: '16px', fontWeight: 300 }}>
            Takes 60 seconds. No credit card required.
          </div>
        </div>
      )}

      {/* Step 1 â€” Trade */}
      {step === 1 && (
        <div className="fade-up" style={{ maxWidth: '480px', width: '100%' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.6rem', marginBottom: '6px', textAlign: 'center' }}>
            What is your trade?
          </div>
          <div style={{ color: '#7a8fa4', fontSize: '0.85rem', fontWeight: 300, textAlign: 'center', marginBottom: '28px', lineHeight: 1.6 }}>
            Remy loads the right playbook for your field.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
            {TRADES.map(t => (
              <button key={t.id} onClick={() => setTrade(t.id)} className={'trade-btn' + (trade === t.id ? ' selected' : '')}>
                <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '3px 6px', borderRadius: '3px', background: trade === t.id ? 'rgba(240,122,46,0.2)' : 'rgba(255,255,255,0.05)', color: trade === t.id ? '#f07a2e' : '#3d5268', flexShrink: 0 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => trade && setStep(2)} disabled={!trade}
            style={{ background: trade ? '#f07a2e' : 'rgba(255,255,255,0.04)', color: trade ? '#fff' : '#2d3f52', border: 'none', borderRadius: '12px', padding: '16px', fontFamily: "'Syne',sans-serif", fontSize: '0.95rem', fontWeight: 700, cursor: trade ? 'pointer' : 'default', width: '100%', transition: 'all 0.2s' }}>
            Continue
          </button>
        </div>
      )}

      {/* Step 2 â€” Company */}
      {step === 2 && (
        <div className="fade-up" style={{ maxWidth: '480px', width: '100%' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.6rem', marginBottom: '6px', textAlign: 'center' }}>
            What is your company?
          </div>
          <div style={{ color: '#7a8fa4', fontSize: '0.85rem', fontWeight: 300, textAlign: 'center', marginBottom: '28px' }}>
            Remy puts your name on every proposal.
          </div>
          <input value={companyName} onChange={e => setCompanyName(e.target.value)}
            placeholder="Giza Roofing Solutions"
            style={{ width: '100%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '18px', color: '#e8edf2', fontFamily: "'DM Sans',sans-serif", fontSize: '1rem', fontWeight: 300, outline: 'none', marginBottom: '12px' }}
          />
          <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)}
            placeholder="yoursite.com (optional — Remy will read it)"
            style={{ width: '100%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '18px', color: '#e8edf2', fontFamily: "'DM Sans',sans-serif", fontSize: '1rem', fontWeight: 300, outline: 'none', marginBottom: '16px' }}
          />
          <button onClick={save} disabled={saving}
            style={{ background: '#f07a2e', color: '#fff', border: 'none', borderRadius: '12px', padding: '16px', fontFamily: "'Syne',sans-serif", fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', width: '100%', opacity: saving ? 0.6 : 1, marginBottom: '12px' }}>
            {saving ? 'Setting up Remy...' : 'Finish Setup'}
          </button>
          <button onClick={() => setStep(1)} style={{ background: 'transparent', border: 'none', color: '#2d3f52', fontSize: '0.82rem', cursor: 'pointer', width: '100%', padding: '8px' }}>
            Back
          </button>
        </div>
      )}

      {/* Step 3 â€” Done */}
      {step === 3 && (
        <div className="fade-up" style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          {mounted && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <RemyOrb />
            </div>
          )}
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: '2.4rem', color: '#f07a2e', marginBottom: '8px' }}>
            Ready.
          </div>
          <div style={{ color: '#7a8fa4', fontSize: '0.9rem', fontWeight: 300, lineHeight: 1.8, marginBottom: '36px' }}>
            Remy is loaded and ready to ride with you.<br />
            Add your first job and get your brief before you knock.
          </div>
          <button onClick={() => router.push('/dashboard')}
            style={{ background: '#f07a2e', color: '#fff', border: 'none', borderRadius: '14px', padding: '18px 48px', fontFamily: "'Syne',sans-serif", fontSize: '1rem', fontWeight: 800, cursor: 'pointer', width: '100%', boxShadow: '0 0 40px rgba(240,122,46,0.3)', letterSpacing: '0.05em' }}>
            OPEN DASHBOARD
          </button>
        </div>
      )}

      {/* Progress */}
      {step > 0 && step < 3 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '36px' }}>
          {[1, 2].map(i => (
            <div key={i} style={{ width: i === step ? '24px' : '6px', height: '6px', borderRadius: '3px', background: i === step ? '#f07a2e' : i < step ? 'rgba(240,122,46,0.4)' : 'rgba(255,255,255,0.08)', transition: 'all 0.3s' }} />
          ))}
        </div>
      )}
    </div>
  );
}
