'use client';
import { useState, useEffect } from 'react';
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

const STEPS = ['welcome', 'trade', 'company', 'done'];

export default function OnboardPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [trade, setTrade] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [saving, setSaving] = useState(false);
  const [remyGreeting, setRemyGreeting] = useState('');

  useEffect(() => {
    if (!isLoaded || !user) return;
    // Check if already onboarded
    fetch('/api/onboard-check?clerkId=' + user.id)
      .then(r => r.json())
      .then(d => { if (d.onboarded) router.push(d.redirect); })
      .catch(() => {});
    // Generate personalized greeting
    const name = user.firstName || 'there';
    setRemyGreeting(`${name}, good to meet you. I am Remy â€” your AI field partner. I will ride along with you on every job, brief you before you knock, and handle all the stuff that slows you down. Tell me about your trade and I will get set up for you.`);
  }, [isLoaded, user]);

  const save = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      await fetch('/api/onboard', {
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
      setStep(3);
    } catch { setSaving(false); }
  };

  const finish = () => router.push('/dashboard');

  if (!isLoaded) return null;

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500;600&display=swap'); * { box-sizing:border-box; margin:0; padding:0; }`}</style>

      {/* Step 0 â€” Welcome */}
      {step === 0 && (
        <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: '2.2rem', color: '#f07a2e', marginBottom: '8px' }}>Remy.</div>
          <div style={{ width: '40px', height: '2px', background: '#f07a2e', margin: '0 auto 28px' }} />
          <div style={{ fontSize: '1rem', color: '#c8d8e8', fontWeight: 300, lineHeight: 1.8, marginBottom: '40px' }}>
            {remyGreeting || 'Welcome. Tell me about your trade and I will get set up for you.'}
          </div>
          <button onClick={() => setStep(1)} style={{ background: '#f07a2e', color: '#fff', border: 'none', borderRadius: '12px', padding: '16px 40px', fontFamily: "'DM Sans',sans-serif", fontSize: '1rem', fontWeight: 600, cursor: 'pointer', width: '100%' }}>
            Get Started
          </button>
        </div>
      )}

      {/* Step 1 â€” Trade */}
      {step === 1 && (
        <div style={{ maxWidth: '480px', width: '100%' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.4rem', marginBottom: '8px', textAlign: 'center' }}>What trade are you in?</div>
          <div style={{ color: '#7a8fa4', fontSize: '0.85rem', fontWeight: 300, textAlign: 'center', marginBottom: '32px' }}>Remy will load the right intelligence for your field.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
            {TRADES.map(t => (
              <button key={t.id} onClick={() => setTrade(t.id)}
                style={{ background: trade === t.id ? 'rgba(240,122,46,0.15)' : '#111820', border: `1.5px solid ${trade === t.id ? '#f07a2e' : 'rgba(255,255,255,0.07)'}`, borderRadius: '12px', padding: '16px', cursor: 'pointer', color: trade === t.id ? '#f07a2e' : '#e8edf2', fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: '0.9rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: trade === t.id ? '#f07a2e' : '#3d5268', background: trade === t.id ? 'rgba(240,122,46,0.15)' : 'rgba(255,255,255,0.05)', padding: '4px 6px', borderRadius: '4px' }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => trade && setStep(2)} disabled={!trade}
            style={{ background: trade ? '#f07a2e' : 'rgba(255,255,255,0.05)', color: trade ? '#fff' : '#3d5268', border: 'none', borderRadius: '12px', padding: '16px', fontFamily: "'DM Sans',sans-serif", fontSize: '1rem', fontWeight: 600, cursor: trade ? 'pointer' : 'default', width: '100%' }}>
            Continue
          </button>
        </div>
      )}

      {/* Step 2 â€” Company */}
      {step === 2 && (
        <div style={{ maxWidth: '480px', width: '100%' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.4rem', marginBottom: '8px', textAlign: 'center' }}>What is your company called?</div>
          <div style={{ color: '#7a8fa4', fontSize: '0.85rem', fontWeight: 300, textAlign: 'center', marginBottom: '32px' }}>Remy will use this in proposals and reports.</div>
          <input
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="Giza Roofing Solutions"
            style={{ width: '100%', background: '#111820', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', color: '#e8edf2', fontFamily: "'DM Sans',sans-serif", fontSize: '1rem', fontWeight: 300, outline: 'none', marginBottom: '16px' }}
          />
          <button onClick={save} disabled={saving}
            style={{ background: '#f07a2e', color: '#fff', border: 'none', borderRadius: '12px', padding: '16px', fontFamily: "'DM Sans',sans-serif", fontSize: '1rem', fontWeight: 600, cursor: 'pointer', width: '100%', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Setting up Remy...' : 'Finish Setup'}
          </button>
          <button onClick={() => setStep(1)} style={{ background: 'transparent', border: 'none', color: '#3d5268', fontSize: '0.82rem', cursor: 'pointer', width: '100%', marginTop: '12px', padding: '8px' }}>
            Back
          </button>
        </div>
      )}

      {/* Step 3 â€” Done */}
      {step === 3 && (
        <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px', color: '#f07a2e', fontFamily: "'Syne',sans-serif", fontWeight: 900 }}>Ready.</div>
          <div style={{ color: '#c8d8e8', fontSize: '0.95rem', fontWeight: 300, lineHeight: 1.8, marginBottom: '40px' }}>
            Remy is loaded up and ready to ride. Add your first job and tap Talk to Remy to get your brief before you knock.
          </div>
          <button onClick={finish} style={{ background: '#f07a2e', color: '#fff', border: 'none', borderRadius: '12px', padding: '16px 40px', fontFamily: "'DM Sans',sans-serif", fontSize: '1rem', fontWeight: 600, cursor: 'pointer', width: '100%' }}>
            Open Dashboard
          </button>
        </div>
      )}

      {/* Progress dots */}
      {step < 3 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '40px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: i === step ? '20px' : '6px', height: '6px', borderRadius: '3px', background: i === step ? '#f07a2e' : 'rgba(255,255,255,0.1)', transition: 'all 0.3s' }} />
          ))}
        </div>
      )}
    </div>
  );
}
