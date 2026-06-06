'use client';
import { UserProfile, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const VOICES = [
  { id: 'f786b574-daa5-4673-aa0c-cbe3e8534c02', name: 'Remy', description: 'Default voice' },
  { id: '30894953-bcce-41fe-892c-15ce19c843ff', name: 'Parker', description: 'Confident, clear' },
  { id: '692846ad-1a6b-49b8-bfc5-86421fd41a19', name: 'Thandi', description: 'Warm, professional' },
  { id: 'ed9ccfa4-8fa1-40f8-bfb2-cb7d67d2f9cd', name: 'Ruby', description: 'Sharp, energetic' },
  { id: 'ef191366-f52f-447a-a398-ed8c0f2943a1', name: 'Archie', description: 'Deep, authoritative' },
  { id: '34575e71-908f-4ab6-ab54-b08c95d6597d', name: 'Joey', description: 'Friendly, casual' },
];

export default function SettingsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [selectedVoice, setSelectedVoice] = useState('f786b574-daa5-4673-aa0c-cbe3e8534c02');
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('remy_voice');
    if (saved) setSelectedVoice(saved);
  }, []);

  const selectVoice = (id: string) => {
    setSelectedVoice(id);
    localStorage.setItem('remy_voice', id);
  };

  const testVoice = async (voice: typeof VOICES[0]) => {
    setTesting(voice.id);
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Hey, I am ${voice.name}. I am ready to help you close more deals in the field.`, voiceId: voice.id }),
      });
      if (!res.ok) { setTesting(null); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setTesting(null); URL.revokeObjectURL(url); };
      audio.onerror = () => setTesting(null);
      await audio.play();
    } catch { setTesting(null); }
  };

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .voice-card { background:#111820; border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:14px 16px; cursor:pointer; transition:all 0.2s; display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .voice-card:hover { border-color:rgba(240,122,46,0.3); }
        .voice-card.active { border-color:rgba(240,122,46,0.5); background:rgba(240,122,46,0.05); }
        .test-btn { padding:6px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#7a8fa4; font-family:'DM Sans',sans-serif; font-size:0.75rem; cursor:pointer; white-space:nowrap; }
        .test-btn:hover { border-color:rgba(240,122,46,0.3); color:#f07a2e; }
        .test-btn.playing { border-color:rgba(240,122,46,0.5); color:#f07a2e; background:rgba(240,122,46,0.05); }
      `}</style>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(11,15,20,0.95)', position:'sticky', top:0, zIndex:100 }}>
        <Link href="/dashboard" style={{ fontFamily:"'Syne', sans-serif", fontSize:'1.1rem', fontWeight:800, textDecoration:'none', color:'#e8edf2' }}>Remy<span style={{ color:'#f07a2e' }}>.</span></Link>
        <Link href="/dashboard" style={{ fontSize:'0.8rem', color:'#7a8fa4', textDecoration:'none' }}>Back</Link>
      </div>

      <div style={{ maxWidth:'720px', margin:'0 auto', padding:'32px 24px' }}>
        <h1 style={{ fontFamily:"'Syne', sans-serif", fontSize:'1.8rem', fontWeight:800, marginBottom:'28px' }}>Settings</h1>

        {/* Voice Picker */}
        <div style={{ marginBottom:'32px' }}>
          <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#f07a2e', marginBottom:'14px' }}>Remy Voice</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {VOICES.map(voice => (
              <div key={voice.id} className={`voice-card ${selectedVoice === voice.id ? 'active' : ''}`} onClick={() => selectVoice(voice.id)}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'10px', height:'10px', borderRadius:'50%', background: selectedVoice === voice.id ? '#f07a2e' : 'rgba(255,255,255,0.1)', flexShrink:0, transition:'background 0.2s' }} />
                  <div>
                    <div style={{ fontWeight:500, fontSize:'0.9rem' }}>{voice.name}</div>
                    <div style={{ fontSize:'0.75rem', color:'#3d5268', marginTop:'2px' }}>{voice.description}</div>
                  </div>
                </div>
                <button
                  className={`test-btn ${testing === voice.id ? 'playing' : ''}`}
                  onClick={e => { e.stopPropagation(); testVoice(voice); }}
                  disabled={testing !== null}
                >
                  {testing === voice.id ? 'Playing...' : 'Preview'}
                </button>
              </div>
            ))}
          </div>
          <div style={{ fontSize:'0.72rem', color:'#2d3f52', marginTop:'10px' }}>Voice selection saves automatically and applies to all future conversations.</div>
        </div>

        {/* Account */}
        <div>
          <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>Account</div>
          {isLoaded && isSignedIn && (
            <UserProfile appearance={{ variables: { colorBackground: '#111820', colorText: '#e8edf2', colorPrimary: '#f07a2e' } }} />
          )}
          {isLoaded && !isSignedIn && (
            <div style={{ color:'#3d5268', fontSize:'0.88rem' }}>Please <Link href="/auth" style={{ color:'#f07a2e' }}>sign in</Link> to view account settings.</div>
          )}
        </div>
      </div>
    </div>
  );
}
