'use client';
import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function OnboardPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [step, setStep] = useState<'company' | 'role' | 'done'>('company');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState<'owner' | 'rep'>('owner');
  const [inviteCode, setInviteCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const createCompany = async () => {
    if (!companyName.trim() || !user) return;
    setSaving(true);
    setError('');
    try {
      // Create company
      const { data: company, error: companyErr } = await supabase
        .from('companies')
        .insert({ name: companyName, owner_id: user.id, plan: 'solo' })
        .select()
        .single();

      if (companyErr || !company) throw new Error('Failed to create company');

      // Create profile as owner
      await supabase.from('profiles').upsert({
        clerk_id: user.id,
        company_id: company.id,
        role: 'owner',
        full_name: user.fullName || '',
        email: user.primaryEmailAddress?.emailAddress || '',
      });

      router.push('/boss');
    } catch (e) {
      setError('Something went wrong. Try again.');
      setSaving(false);
    }
  };

  const joinWithCode = async () => {
    if (!inviteCode.trim() || !user) return;
    setSaving(true);
    setError('');
    try {
      const { data: invite } = await supabase
        .from('invites')
        .select('*, companies(*)')
        .eq('token', inviteCode.trim())
        .eq('accepted', false)
        .single();

      if (!invite) { setError('Invalid or expired invite code.'); setSaving(false); return; }

      await supabase.from('profiles').upsert({
        clerk_id: user.id,
        company_id: invite.company_id,
        role: invite.role,
        full_name: user.fullName || '',
        email: user.primaryEmailAddress?.emailAddress || '',
      });

      await supabase.from('invites').update({ accepted: true }).eq('id', invite.id);

      router.push('/dashboard/voice');
    } catch {
      setError('Something went wrong. Try again.');
      setSaving(false);
    }
  };

  if (!isLoaded) return (
    <div style={{ background:'#0b0f14', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#3d5268', fontFamily:'monospace' }}>Loading...</div>
  );

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

        {step === 'company' && (
          <div>
            <div style={{ display:'flex', gap:'10px', marginBottom:'28px' }}>
              <button onClick={() => setRole('owner')} style={{ flex:1, padding:'14px', borderRadius:'10px', border: role === 'owner' ? '2px solid #f07a2e' : '1px solid rgba(255,255,255,0.08)', background: role === 'owner' ? 'rgba(240,122,46,0.05)' : '#111820', color: role === 'owner' ? '#f07a2e' : '#7a8fa4', fontFamily:"'DM Sans',sans-serif", fontSize:'0.88rem', fontWeight:500, cursor:'pointer', textAlign:'center' }}>
                <div style={{ fontSize:'1.2rem', marginBottom:'4px' }}>ðŸ‘”</div>
                <div>I own a company</div>
              </button>
              <button onClick={() => setRole('rep')} style={{ flex:1, padding:'14px', borderRadius:'10px', border: role === 'rep' ? '2px solid #f07a2e' : '1px solid rgba(255,255,255,0.08)', background: role === 'rep' ? 'rgba(240,122,46,0.05)' : '#111820', color: role === 'rep' ? '#f07a2e' : '#7a8fa4', fontFamily:"'DM Sans',sans-serif", fontSize:'0.88rem', fontWeight:500, cursor:'pointer', textAlign:'center' }}>
                <div style={{ fontSize:'1.2rem', marginBottom:'4px' }}>ðŸ”¨</div>
                <div>I am a field rep</div>
              </button>
            </div>

            {role === 'owner' && (
              <div>
                <div style={{ fontSize:'0.72rem', fontWeight:500, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'10px' }}>Company Name</div>
                <input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createCompany(); }}
                  placeholder="e.g. Giza Roofing"
                  style={{ width:'100%', background:'#111820', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'14px 16px', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.95rem', outline:'none', marginBottom:'12px' }}
                  autoFocus
                />
                {error && <div style={{ color:'#c84a4a', fontSize:'0.82rem', marginBottom:'10px' }}>{error}</div>}
                <button onClick={createCompany} disabled={saving || !companyName.trim()} style={{ width:'100%', padding:'14px', background:'#f07a2e', border:'none', borderRadius:'10px', color:'#fff', fontFamily:"'DM Sans',sans-serif", fontSize:'0.95rem', fontWeight:600, cursor:'pointer', opacity: saving || !companyName.trim() ? 0.5 : 1 }}>
                  {saving ? 'Setting up...' : 'Create Company'}
                </button>
              </div>
            )}

            {role === 'rep' && (
              <div>
                <div style={{ fontSize:'0.72rem', fontWeight:500, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'10px' }}>Invite Code</div>
                <input
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') joinWithCode(); }}
                  placeholder="Enter your invite code"
                  style={{ width:'100%', background:'#111820', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'14px 16px', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.95rem', outline:'none', marginBottom:'12px' }}
                  autoFocus
                />
                {error && <div style={{ color:'#c84a4a', fontSize:'0.82rem', marginBottom:'10px' }}>{error}</div>}
                <button onClick={joinWithCode} disabled={saving || !inviteCode.trim()} style={{ width:'100%', padding:'14px', background:'#f07a2e', border:'none', borderRadius:'10px', color:'#fff', fontFamily:"'DM Sans',sans-serif", fontSize:'0.95rem', fontWeight:600, cursor:'pointer', opacity: saving || !inviteCode.trim() ? 0.5 : 1 }}>
                  {saving ? 'Joining...' : 'Join Team'}
                </button>
                <div style={{ textAlign:'center', marginTop:'12px', fontSize:'0.78rem', color:'#3d5268' }}>Ask your boss for an invite code</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
