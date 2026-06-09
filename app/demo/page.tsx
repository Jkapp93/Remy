'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

type Message = { role: 'user' | 'assistant'; content: string };

const DEMO_JOB = {
  customer_name: 'Mike Thompson',
  address: '2847 Oak Ridge Dr, Dallas TX',
  notes: 'Called about missing shingles after last week\'s hailstorm. Has a 10-year-old roof.',
  job_type: 'roofing',
};

const DEMO_DOCTRINE = `
Company: Storm Shield Roofing. We specialize in storm damage restoration and full roof replacements.
Pricing: Shingle replacement starts at $850/square. Full replacement from $12,000.
Financing: GreenSky and Synchrony available — as low as $97/month.
Warranty: Lifetime labor warranty on all full replacements.
Key talking point: Insurance often covers full replacement after hail damage — we handle the claim process for free.
`.trim();

const OPENER = `Brief me fast. Pulling up to Mike Thompson at 2847 Oak Ridge Dr. He called about hail damage. What do I need to know before I knock?`;

const DEMO_LIMIT = 6;

export default function DemoPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const speak = async (text: string) => {
    try {
      const voiceId = 'f786b574-daa5-4673-aa0c-cbe3e8534c02';
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 300), voiceId }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); }
      const audio = new Audio(url);
      audioRef.current = audio;
      setSpeaking(true);
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => setSpeaking(false);
      await audio.play();
    } catch {}
  };

  const send = async (text: string, existingMessages: Message[]) => {
    if (!text.trim() || loading) return;
    unlockAudio();
    const userMsg: Message = { role: 'user', content: text };
    const withPlaceholder: Message[] = [...existingMessages, userMsg, { role: 'assistant' as const, content: '' }];
    setMessages(withPlaceholder);
    setInput('');
    setLoading(true);
    setMsgCount(c => c + 1);

    const jobContext = `Customer: ${DEMO_JOB.customer_name}\nAddress: ${DEMO_JOB.address}\nNotes: ${DEMO_JOB.notes}\nJob type: ${DEMO_JOB.job_type}`;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...existingMessages, userMsg],
          doctrine: DEMO_DOCTRINE,
          jobContext,
          memories: [],
        }),
      });

      if (!res.ok || !res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages([...existingMessages, userMsg, { role: 'assistant', content: full }]);
      }

      speak(full);
      setMessages([...existingMessages, userMsg, { role: 'assistant', content: full }]);
    } catch {
      setMessages([...existingMessages, userMsg, { role: 'assistant', content: 'Something went wrong. Try again.' }]);
    }
    setLoading(false);
  };

  const unlockAudio = () => {
    if (audioUnlockedRef.current) return;
    const silent = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    silent.play().catch(() => {});
    audioUnlockedRef.current = true;
  };

  const startDemo = async () => {
    unlockAudio();
    setStarted(true);
    await send(OPENER, []);
  };

  const hitLimit = msgCount >= DEMO_LIMIT;

  return (
    <div style={{ background: '#0b0f14', height: '100vh', display: 'flex', flexDirection: 'column', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .msg-user { background:rgba(240,122,46,0.08); border:1px solid rgba(240,122,46,0.15); border-radius:12px 12px 4px 12px; padding:12px 16px; max-width:80%; align-self:flex-end; font-size:0.88rem; line-height:1.6; }
        .msg-remy { background:#111820; border:1px solid rgba(255,255,255,0.06); border-radius:12px 12px 12px 4px; padding:12px 16px; max-width:85%; font-size:0.88rem; line-height:1.7; font-weight:300; color:#d4dce6; }
        .demo-badge { background:rgba(61,175,118,0.1); border:1px solid rgba(61,175,118,0.25); border-radius:20px; padding:4px 12px; font-size:0.68rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:#3daf76; }
        .quick-btn { background:rgba(240,122,46,0.06); border:1px solid rgba(240,122,46,0.2); border-radius:20px; padding:8px 16px; color:#f07a2e; font-family:'DM Sans',sans-serif; font-size:0.78rem; font-weight:500; cursor:pointer; white-space:nowrap; transition:all 0.15s; }
        .quick-btn:hover { background:rgba(240,122,46,0.12); }
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid rgba(240,122,46,0.15)', background:'rgba(11,15,20,0.98)', flexShrink:0 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.1rem', fontWeight:800 }}>
          Remy<span style={{ color:'#f07a2e' }}>.</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <span className="demo-badge">Live Demo</span>
          <Link href="/pricing" style={{ padding:'7px 18px', borderRadius:'20px', background:'#f07a2e', color:'#fff', fontFamily:"'DM Sans',sans-serif", fontSize:'0.78rem', fontWeight:600, textDecoration:'none' }}>
            Get Access
          </Link>
        </div>
      </div>

      {/* Job context bar */}
      <div style={{ padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(240,122,46,0.03)', display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
        <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#f07a2e', flexShrink:0 }} />
        <div style={{ fontSize:'0.78rem', color:'#f07a2e', fontWeight:500 }}>{DEMO_JOB.customer_name}</div>
        <div style={{ fontSize:'0.72rem', color:'#3d5268' }}>{DEMO_JOB.address}</div>
        <div style={{ marginLeft:'auto', fontSize:'0.68rem', color:'#2d3f52', fontWeight:300 }}>Demo scenario — Storm Shield Roofing</div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'20px', display:'flex', flexDirection:'column', gap:'12px' }}>
        {!started ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', gap:'24px', padding:'20px' }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.6rem', fontWeight:800, lineHeight:1.2 }}>
              See Remy in action.<br /><span style={{ color:'#f07a2e' }}>No signup needed.</span>
            </div>
            <div style={{ color:'#7a8fa4', fontSize:'0.88rem', fontWeight:300, lineHeight:1.8, maxWidth:'360px' }}>
              You&apos;re a roofing rep about to knock on Mike Thompson&apos;s door after a hailstorm. Remy has already pulled the job, the weather, and your company playbook.
            </div>
            <button
              onClick={startDemo}
              style={{ background:'#f07a2e', color:'#fff', border:'none', borderRadius:'14px', padding:'16px 40px', fontFamily:"'Syne',sans-serif", fontSize:'1rem', fontWeight:800, cursor:'pointer', boxShadow:'0 0 30px rgba(240,122,46,0.3)', letterSpacing:'0.04em' }}
            >
              START DEMO
            </button>
            <div style={{ fontSize:'0.72rem', color:'#2d3f52' }}>6 free messages · No account required</div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.role === 'assistant' && (
                  <div style={{ fontSize:'0.62rem', color:'#3d5268', marginBottom:'4px', paddingLeft:'4px', letterSpacing:'0.06em', textTransform:'uppercase' }}>Remy</div>
                )}
                <div className={m.role === 'user' ? 'msg-user' : 'msg-remy'}>
                  {m.content || (loading && i === messages.length - 1 ? <span style={{ animation:'pulse 1s infinite', display:'inline-block' }}>...</span> : '')}
                </div>
              </div>
            ))}
            {hitLimit && (
              <div style={{ background:'rgba(240,122,46,0.06)', border:'1px solid rgba(240,122,46,0.2)', borderRadius:'14px', padding:'24px', textAlign:'center', marginTop:'8px' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'1.1rem', marginBottom:'8px' }}>Ready for the real thing?</div>
                <div style={{ color:'#7a8fa4', fontSize:'0.85rem', fontWeight:300, marginBottom:'20px', lineHeight:1.6 }}>
                  Remy works with your real jobs, your doctrine, your team.<br />Setup takes 60 seconds.
                </div>
                <Link href="/pricing" style={{ display:'inline-block', background:'#f07a2e', color:'#fff', border:'none', borderRadius:'10px', padding:'14px 36px', fontFamily:"'Syne',sans-serif", fontSize:'0.95rem', fontWeight:800, textDecoration:'none', boxShadow:'0 0 20px rgba(240,122,46,0.3)' }}>
                  GET STARTED FREE
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick prompts */}
      {started && !hitLimit && messages.length > 0 && !loading && (
        <div style={{ padding:'0 20px 12px', display:'flex', gap:'8px', overflowX:'auto', flexShrink:0 }}>
          {[
            'What should I say first?',
            'Customer says the price is too high',
            'He wants to think about it',
            'What financing options do I have?',
          ].map(q => (
            <button key={q} className="quick-btn" onClick={() => send(q, messages.filter(m => m.content))}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {started && !hitLimit && (
        <div style={{ padding:'12px 20px 20px', borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(11,15,20,0.98)', flexShrink:0 }}>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && input.trim()) send(input, messages.filter(m => m.content)); }}
              placeholder="Ask Remy anything..."
              disabled={loading}
              style={{ flex:1, background:'#111820', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'13px 16px', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.9rem', outline:'none' }}
            />
            <button
              onClick={() => send(input, messages.filter(m => m.content))}
              disabled={loading || !input.trim()}
              style={{ padding:'13px 20px', background:'#f07a2e', border:'none', borderRadius:'10px', color:'#fff', fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:'0.85rem', cursor:'pointer', opacity: loading || !input.trim() ? 0.5 : 1, flexShrink:0 }}
            >
              {loading ? '...' : 'Send'}
            </button>
            {speaking && (
              <button onClick={() => { audioRef.current?.pause(); setSpeaking(false); }} style={{ padding:'13px 16px', background:'rgba(240,122,46,0.1)', border:'1px solid rgba(240,122,46,0.3)', borderRadius:'10px', color:'#f07a2e', fontFamily:"'DM Sans',sans-serif", fontSize:'0.78rem', cursor:'pointer', flexShrink:0 }}>
                Stop
              </button>
            )}
          </div>
          <div style={{ textAlign:'center', marginTop:'8px', fontSize:'0.68rem', color:'#2d3f52' }}>
            {DEMO_LIMIT - msgCount} message{DEMO_LIMIT - msgCount !== 1 ? 's' : ''} remaining in demo
          </div>
        </div>
      )}
    </div>
  );
}
