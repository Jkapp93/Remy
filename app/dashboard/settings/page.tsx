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
  const { isLoaded, isSignedIn, user } = useUser();
  const [selectedVoice, setSelectedVoice] = useState('f786b574-daa5-4673-aa0c-cbe3e8534c02');
  const [testing, setTesting] = useState<string | null>(null);
  const [shareConversations, setShareConversations] = useState(true);
  const [savingShare, setSavingShare] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [agentName, setAgentName] = useState('Remy');
  const [savingAgent, setSavingAgent] = useState(false);
  const [agentSaved, setAgentSaved] = useState(false);
  const [crmWebhook, setCrmWebhook] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookSaved, setWebhookSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('remy_voice');
    if (saved) setSelectedVoice(saved);
    loadSharePref();
  }, [user]);

  const loadSharePref = async () => {
    if (!user) return;
    const res = await fetch(`/api/profile?clerkId=${user.id}`);
    const data = await res.json();
    if (data.profile) {
      setShareConversations(data.profile.share_conversations ?? true);
      setPlan(data.profile.companies?.plan || null);
      setAgentName(data.profile.companies?.agent_name || 'Remy');
      setCrmWebhook(data.profile.companies?.crm_webhook_url || '');
    }
  };

  const saveAgentName = async () => {
    if (!user || !agentName.trim()) return;
    setSavingAgent(true);
    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clerkId: user.id, agentName: agentName.trim() }),
    });
    setSavingAgent(false);
    setAgentSaved(true);
    setTimeout(() => setAgentSaved(false), 2000);
  };

  const saveWebhook = async () => {
    if (!user) return;
    setSavingWebhook(true);
    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clerkId: user.id, crmWebhookUrl: crmWebhook.trim() }),
    });
    setSavingWebhook(false);
    setWebhookSaved(true);
    setTimeout(() => setWebhookSaved(false), 2500);
  };

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing-portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    setPortalLoading(false);
  };

  const toggleShare = async () => {
    if (!user) return;
    setSavingShare(true);
    const newVal = !shareConversations;
    setShareConversations(newVal);
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clerkId: user.id, share_conversations: newVal }),
    });
    setSavingShare(false);
  };

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

        {/* Agent Name */}
        <div style={{ marginBottom:'32px' }}>
          <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#f07a2e', marginBottom:'14px' }}>Agent Name</div>
          <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'18px 20px' }}>
            <div style={{ fontSize:'0.82rem', color:'#7a8fa4', fontWeight:300, marginBottom:'12px' }}>This is what your AI field partner is called. Every rep on your team will use this name.</div>
            <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
              <input
                value={agentName}
                onChange={e => setAgentName(e.target.value)}
                maxLength={20}
                placeholder="Remy"
                style={{ flex:1, background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'11px 14px', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.9rem', outline:'none' }}
              />
              <button
                onClick={saveAgentName}
                disabled={savingAgent}
                style={{ padding:'11px 20px', background: agentSaved ? 'rgba(61,175,118,0.15)' : '#f07a2e', border: agentSaved ? '1px solid rgba(61,175,118,0.4)' : 'none', borderRadius:'8px', color: agentSaved ? '#3daf76' : '#fff', fontFamily:"'DM Sans',sans-serif", fontSize:'0.82rem', fontWeight:600, cursor:'pointer', flexShrink:0, transition:'all 0.2s' }}
              >
                {agentSaved ? 'Saved ✓' : savingAgent ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>

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

        {/* Conversation Sharing */}
        <div style={{ marginBottom:'32px' }}>
          <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>Privacy</div>
          <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'18px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'20px' }}>
            <div>
              <div style={{ fontWeight:500, fontSize:'0.9rem', marginBottom:'4px' }}>Share conversations with my boss</div>
              <div style={{ fontSize:'0.78rem', color:'#3d5268', fontWeight:300, lineHeight:1.5 }}>Allow your admin to see conversation summaries for coaching and training. Your full transcript is never shared.</div>
            </div>
            <button
              onClick={toggleShare}
              disabled={savingShare}
              style={{ flexShrink:0, width:'52px', height:'28px', borderRadius:'14px', border:'none', background: shareConversations ? '#f07a2e' : 'rgba(255,255,255,0.08)', cursor:'pointer', position:'relative', transition:'background 0.2s' }}
            >
              <div style={{ position:'absolute', top:'3px', left: shareConversations ? '27px' : '3px', width:'22px', height:'22px', borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
            </button>
          </div>
        </div>

        {/* CRM Webhook */}
        {plan && plan !== 'free' && (
          <div style={{ marginBottom:'32px' }}>
            <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>CRM Webhook</div>
            <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'18px 20px' }}>
              <div style={{ fontSize:'0.82rem', color:'#7a8fa4', fontWeight:300, marginBottom:'12px' }}>When Remy logs a note or outcome, it POSTs a JSON payload to this URL. Pipe it into your CRM, Zapier, or Make.</div>
              <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                <input
                  value={crmWebhook}
                  onChange={e => setCrmWebhook(e.target.value)}
                  placeholder="https://hooks.zapier.com/..."
                  style={{ flex:1, background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'11px 14px', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.88rem', outline:'none' }}
                />
                <button
                  onClick={saveWebhook}
                  disabled={savingWebhook}
                  style={{ padding:'11px 20px', background: webhookSaved ? 'rgba(61,175,118,0.15)' : '#f07a2e', border: webhookSaved ? '1px solid rgba(61,175,118,0.4)' : 'none', borderRadius:'8px', color: webhookSaved ? '#3daf76' : '#fff', fontFamily:"'DM Sans',sans-serif", fontSize:'0.82rem', fontWeight:600, cursor:'pointer', flexShrink:0, transition:'all 0.2s' }}
                >
                  {webhookSaved ? 'Saved ✓' : savingWebhook ? 'Saving...' : 'Save'}
                </button>
              </div>
              <div style={{ fontSize:'0.72rem', color:'#2d3f52', marginTop:'10px' }}>Payload includes: job_id, rep_id, note summary, quote amount, follow-up date, outcome.</div>
            </div>
          </div>
        )}

        {/* Billing */}
        <div style={{ marginBottom:'32px' }}>
          <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>Billing</div>
          <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'18px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'20px' }}>
            <div>
              <div style={{ fontWeight:500, fontSize:'0.9rem', marginBottom:'4px' }}>
                {plan ? `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan` : 'Free Plan'}
              </div>
              <div style={{ fontSize:'0.78rem', color:'#3d5268', fontWeight:300 }}>
                {plan && plan !== 'free' ? 'Manage subscription, invoices, and payment method.' : 'Upgrade to unlock more messages and team features.'}
              </div>
            </div>
            {plan && plan !== 'free' ? (
              <button
                onClick={openBillingPortal}
                disabled={portalLoading}
                style={{ flexShrink:0, padding:'8px 18px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.8rem', fontWeight:500, cursor:'pointer', opacity: portalLoading ? 0.5 : 1 }}
              >
                {portalLoading ? 'Opening...' : 'Manage'}
              </button>
            ) : (
              <a
                href="/pricing"
                style={{ flexShrink:0, padding:'8px 18px', borderRadius:'8px', border:'none', background:'#f07a2e', color:'#fff', fontFamily:"'DM Sans',sans-serif", fontSize:'0.8rem', fontWeight:500, textDecoration:'none' }}
              >
                Upgrade
              </a>
            )}
          </div>
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
