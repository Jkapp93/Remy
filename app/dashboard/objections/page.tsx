'use client';
import { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useProfile } from '../../../lib/useProfile';
import Link from 'next/link';

const COMMON_OBJECTIONS: Record<string, string[]> = {
  all: [
    "Your price is too high",
    "I need to talk to my spouse first",
    "I'm going to get a few more quotes",
    "I don't have the budget right now",
    "I need to think about it",
    "The neighbor used someone else and paid less",
  ],
  roofing: [
    "My roof looks fine to me",
    "Insurance already denied my claim",
    "I'll just patch it myself",
    "I heard your company had bad reviews",
  ],
  fencing: [
    "I'll just fix the existing fence",
    "My neighbor and I will split it later",
    "Wood is cheaper, I'll just do wood",
  ],
  painting: [
    "I can just do it myself",
    "I'll wait until next season",
    "The previous paint job lasted 3 years, I want to wait",
  ],
  hvac: [
    "The unit still runs, I'll wait until it breaks",
    "I saw a cheaper unit at Home Depot",
    "Can I just recharge the refrigerant?",
  ],
};

export default function ObjectionsPage() {
  const { user, isLoaded } = useUser();
  const { profile } = useProfile();
  const [trade, setTrade] = useState<string>('all');
  const [customObjection, setCustomObjection] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeObjection, setActiveObjection] = useState('');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const objections = [...(COMMON_OBJECTIONS.all), ...(COMMON_OBJECTIONS[trade] || [])];

  const handleObjection = async (text: string) => {
    if (!text.trim() || !user) return;
    setActiveObjection(text);
    setResponse('');
    setLoading(true);

    try {
      const docRes = await fetch(`/api/doctrine-list?clerkId=${user.id}`).then(r => r.json()).catch(() => ({ doctrine: '' }));
      const doctrine = docRes.doctrine || '';

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `OBJECTION MODE. The customer just said: "${text}". Give me a sharp, confident, 2-3 sentence rebuttal I can say RIGHT NOW. Be direct. No fluff. Trade context: ${trade === 'all' ? 'home services' : trade}.`,
          }],
          repId: user.id,
          systemOverride: `You are an elite home services sales coach. The rep needs a quick, confident rebuttal they can say immediately. Be sharp and specific. ${doctrine ? `Company context: ${doctrine.slice(0, 300)}` : ''}`,
        }),
      });

      if (!res.body) { setLoading(false); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      setLoading(false);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        full += chunk;
        setResponse(full);
      }

      // Auto-play via TTS
      if (full.trim()) {
        setSpeaking(true);
        try {
          const voiceId = localStorage.getItem('remy_voice') || 'f786b574-daa5-4673-aa0c-cbe3e8534c02';
          const ttsRes = await fetch('/api/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: full, voiceId }),
          });
          if (ttsRes.ok) {
            const blob = await ttsRes.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
            audio.onerror = () => setSpeaking(false);
            await audio.play();
          }
        } catch { setSpeaking(false); }
      }
    } catch {
      setLoading(false);
      setResponse('Failed to generate rebuttal. Try again.');
    }
  };

  const stopAudio = () => {
    audioRef.current?.pause();
    setSpeaking(false);
  };

  const startListening = () => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { alert('Use Chrome for voice input.'); return; }
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = false;
    recognitionRef.current = r;
    setListening(true);
    r.start();
    r.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setCustomObjection(text);
      setListening(false);
      handleObjection(text);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
  };

  const TRADES = ['all', 'roofing', 'fencing', 'painting', 'hvac'];

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .obj-card { background: #111820; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; font-size: 0.88rem; color: #e8edf2; font-weight: 300; text-align: left; width: 100%; font-family: 'DM Sans', sans-serif; }
        .obj-card:hover { border-color: rgba(240,122,46,0.3); color: #f07a2e; }
        .obj-card.active { border-color: rgba(240,122,46,0.5); background: rgba(240,122,46,0.05); color: #f07a2e; }
        .trade-pill { padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); background: transparent; color: #7a8fa4; font-family: 'DM Sans', sans-serif; font-size: 0.75rem; cursor: pointer; }
        .trade-pill.active { background: #f07a2e; border-color: #f07a2e; color: #fff; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(11,15,20,0.98)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/dashboard" style={{ color: '#3d5268', textDecoration: 'none', fontSize: '0.88rem' }}>Back</Link>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.1rem' }}>Objection Coach</div>
        </div>
        {speaking && (
          <button onClick={stopAudio} style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(240,122,46,0.4)', background: 'rgba(240,122,46,0.08)', color: '#f07a2e', fontFamily: "'DM Sans',sans-serif", fontSize: '0.72rem', cursor: 'pointer' }}>Stop</button>
        )}
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Panic Buttons — most common objections, 1-tap at the door */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c84a4a', marginBottom: '10px' }}>At the door right now</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[
              { label: 'Too Expensive', obj: 'Your price is too high' },
              { label: 'Need to Think', obj: 'I need to think about it' },
              { label: 'Competitor Bid', obj: 'I already have a lower bid from a competitor' },
              { label: 'Ask Spouse', obj: 'I need to talk to my spouse first' },
              { label: 'Bad Timing', obj: "The timing isn't right, maybe next year" },
              { label: 'Get More Quotes', obj: "I'm going to get a few more quotes first" },
            ].map(({ label, obj }) => (
              <button
                key={label}
                onClick={() => handleObjection(obj)}
                disabled={loading}
                style={{ padding: '12px 8px', background: activeObjection === obj ? 'rgba(200,74,74,0.15)' : 'rgba(200,74,74,0.06)', border: `1px solid ${activeObjection === obj ? 'rgba(200,74,74,0.5)' : 'rgba(200,74,74,0.2)'}`, borderRadius: '10px', color: activeObjection === obj ? '#e87878' : '#c84a4a', fontFamily: "'DM Sans',sans-serif", fontSize: '0.78rem', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', lineHeight: 1.3, transition: 'all 0.15s' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Trade filter */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '20px' }}>
          {TRADES.map(t => (
            <button key={t} className={'trade-pill' + (trade === t ? ' active' : '')} onClick={() => setTrade(t)}>
              {t === 'all' ? 'All Trades' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Voice input */}
        <div style={{ background: '#111820', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3d5268', marginBottom: '10px' }}>Customer just said...</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={customObjection}
              onChange={e => setCustomObjection(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleObjection(customObjection)}
              placeholder="Type or speak the objection..."
              style={{ flex: 1, background: '#0b0f14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 14px', color: '#e8edf2', fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', outline: 'none' }}
            />
            <button
              onClick={startListening}
              style={{ padding: '10px 14px', borderRadius: '8px', border: `1px solid ${listening ? 'rgba(240,122,46,0.5)' : 'rgba(255,255,255,0.08)'}`, background: listening ? 'rgba(240,122,46,0.1)' : 'transparent', color: listening ? '#f07a2e' : '#7a8fa4', cursor: 'pointer', fontSize: '1rem', animation: listening ? 'pulse 1s infinite' : 'none' }}
            >
              {listening ? '●' : '🎤'}
            </button>
            <button
              onClick={() => handleObjection(customObjection)}
              disabled={!customObjection.trim() || loading}
              style={{ padding: '10px 18px', background: '#f07a2e', border: 'none', borderRadius: '8px', color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', opacity: !customObjection.trim() || loading ? 0.5 : 1 }}
            >
              Coach
            </button>
          </div>
        </div>

        {/* Response */}
        {(loading || response) && (
          <div style={{ background: 'rgba(240,122,46,0.05)', border: '1px solid rgba(240,122,46,0.2)', borderRadius: '12px', padding: '18px 20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f07a2e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Remy&apos;s Rebuttal
              {speaking && <span style={{ animation: 'pulse 1s infinite', fontWeight: 400 }}>● Speaking</span>}
            </div>
            {loading ? (
              <div style={{ color: '#3d5268', fontSize: '0.88rem', animation: 'pulse 1s infinite' }}>Coaching...</div>
            ) : (
              <div style={{ fontSize: '0.95rem', fontWeight: 400, lineHeight: 1.65, color: '#e8edf2' }}>{response}</div>
            )}
          </div>
        )}

        {/* Common objections */}
        <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3d5268', marginBottom: '12px' }}>Common Objections — tap for instant rebuttal</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {objections.map((obj, i) => (
            <button key={i} className={'obj-card' + (activeObjection === obj ? ' active' : '')} onClick={() => handleObjection(obj)}>
              &quot;{obj}&quot;
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
