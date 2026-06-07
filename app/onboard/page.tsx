'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

import { useEffect } from 'react';
export default function OnboardPage() {
  const { user, isLoaded } = useUser();
  useEffect(() => { if (!isLoaded) return; if (!user) return; fetch('/api/onboard-check?clerkId=' + user.id).then(r => r.json()).then(d => { if (d.onboarded) window.location.href = d.redirect; }); }, [isLoaded, user]);

  const router = useRouter();
  const [role, setRole] = useState<'owner' | 'rep'>('owner');
  const [companyName, setCompanyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch(`/api/onboard-check?clerkId=${user.id}`)
      .then(r => r.json())
      .then(data => { if (data.onboarded) router.push(data.redirect); else setChecking(false); })
      .catch(() => setChecking(false));
  }, [isLoaded, user]);

  if (!isLoaded || checking) return (
    <div style={{ background:'#0b0f14', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#3d5268', fontFamily:'monospace' }}>Loading...</div>
  );

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: user.id,
          companyName: role === 'owner' ? companyName : undefined,
          inviteToken: role === 'rep' ? inviteCode : undefined,
          fullName: user.fullName || '',
          email: user.primaryEmailAddress?.emailAddress || '',
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setSaving(false); return; }
      router.push(data.redirect);
    } catch {
      setError('Something went wrong. Try again.');
      setSaving(false);
    }
  };

  return (
    <div style={{ background:'#0b0f14', minHeight:'100vh', color:'#e8edf2', fontFamily:"'DM Sans', sans-serif", display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap'); * { box-sizing:border-box; margin:0; padding:0; }`}</style>
      <div style={{ width:'100%', maxWidth:'440px' }}>
        <div style={{ textAlign:'center', marginBottom:'40px' }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'2rem', fontWeight:800, marginBottom:'8px' }}>
            Remy<span style={{ color:'#f07a2e' }}>.</span>
          </div>
          <div style={{ color:'#7a8fa4', fontSize:'0.9rem', fontWeight:300 }}>Lets get you set up</div>
        </div>

        <div style={{ display:'flex', gap:'10px', marginBottom:'28px' }}>
          <button onClick={() => setRole('owner')} style={{ flex:1, padding:'14px', borderRadius:'10px', border: role === 'owner' ? '2px solid #f07a2e' : '1px solid rgba(255,255,255,0.08)', background: role === 'owner' ? 'rgba(240,122,46,0.05)' : '#111820', color: role === 'owner' ? '#f07a2e' : '#7a8fa4', fontFamily:"'DM Sans',sans-serif", fontSize:'0.88rem', fontWeight:500, cursor:'pointer', textAlign:'center' as const }}>
            <div style={{ fontSize:'1.2rem', marginBottom:'4px' }}>&#128084;</div>
            <div>I own a company</div>
          </button>
          <button onClick={() => setRole('rep')} style={{ flex:1, padding:'14px', borderRadius:'10px', border: role === 'rep' ? '2px solid #f07a2e' : '1px solid rgba(255,255,255,0.08)', background: role === 'rep' ? 'rgba(240,122,46,0.05)' : '#111820', color: role === 'rep' ? '#f07a2e' : '#7a8fa4', fontFamily:"'DM Sans',sans-serif", fontSize:'0.88rem', fontWeight:500, cursor:'pointer', textAlign:'center' as const }}>
            <div style={{ fontSize:'1.2rem', marginBottom:'4px' }}>&#128296;</div>
            <div>I am a field rep</div>
          </button>
        </div>

        {role === 'owner' && (
          <div>
            <div style={{ fontSize:'0.72rem', fontWeight:500, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:'#3d5268', marginBottom:'10px' }}>Company Name</div>
            <input
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder="e.g. Giza Roofing"
              style={{ width:'100%', background:'#111820', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'14px 16px', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.95rem', outline:'none', marginBottom:'12px' }}
              autoFocus
            />
          </div>
        )}

        {role === 'rep' && (
          <div>
            <div style={{ fontSize:'0.72rem', fontWeight:500, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:'#3d5268', marginBottom:'10px' }}>Invite Code</div>
            <input
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder="Enter your invite code"
              style={{ width:'100%', background:'#111820', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'14px 16px', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.95rem', outline:'none', marginBottom:'12px' }}
              autoFocus
            />
            <div style={{ fontSize:'0.78rem', color:'#3d5268', marginBottom:'12px' }}>Ask your boss for an invite code</div>
          </div>
        )}

        {error && <div style={{ color:'#c84a4a', fontSize:'0.82rem', marginBottom:'10px' }}>{error}</div>}

        <button
          onClick={submit}
          disabled={saving || (role === 'owner' ? !companyName.trim() : !inviteCode.trim())}
          style={{ width:'100%', padding:'14px', background:'#f07a2e', border:'none', borderRadius:'10px', color:'#fff', fontFamily:"'DM Sans',sans-serif", fontSize:'0.95rem', fontWeight:600, cursor:'pointer', opacity: saving || (role === 'owner' ? !companyName.trim() : !inviteCode.trim()) ? 0.5 : 1 }}
        >
          {saving ? 'Setting up...' : role === 'owner' ? 'Create Company' : 'Join Team'}
        </button>
      </div>
    </div>
  );
}
