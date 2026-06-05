'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

function VoiceInner() {
  const { isLoaded } = useUser();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<{role: string; content: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [doctrine, setDoctrine] = useState('');
  const [jobs, setJobs] = useState<{id: string; customer_name: string; address: string; notes: string; status: string}[]>([]);
  const [activeJob, setActiveJob] = useState<{id: string; customer_name: string; address: string; notes: string; status: string} | null>(null);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [pendingAudio, setPendingAudio] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const initialized = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isLoaded || initialized.current) return;
    initialized.current = true;
    init();
  }, [isLoaded]);

  const init = async () => {
    const { data: docData } = await supabase.from('doctrine').select('content').eq('active', true);
    const docText = docData ? docData.map((d: {content: string}) => d.content).join('\n') : '';
    setDoctrine(docText);

    const { data: jobData } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    const allJobs = jobData || [];
    setJobs(allJobs);

    const jobId = searchParams.get('jobId');

    if (jobId && allJobs.length > 0) {
      const found = allJobs.find((j: {id: string}) => j.id === jobId);
      if (found) {
        setActiveJob(found);
        const briefPrompt = `Brief me fast. Pulling up to ${found.customer_name}${found.address ? ` at ${found.address}` : ''}${found.notes ? `. Notes: ${found.notes}` : ''}.`;
        await doSend(briefPrompt, [], docText, found);
        return;
      }
    }

    setMessages([{ role: 'assistant', content: `Hey. I am Remy. Select a job above and I will brief you before you knock. Or just tell me what you are walking into.` }]);
  };

  const playAudio = async (url: string) => {
    setSpeaking(true);
    setPendingAudio(null);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
    audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
    try {
      await audio.play();
    } catch {
      setSpeaking(false);
      setPendingAudio(url);
    }
  };

  const speak = async (text: string) => {
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      await playAudio(url);
    } catch { setSpeaking(false); }
  };

  const doSend = async (
    text: string,
    currentMessages: {role: string; content: string}[],
    currentDoctrine: string,
    currentJob: {id: string; customer_name: string; address: string; notes: string} | null
  ) => {
    if (!text.trim()) return;
    const jobContext = currentJob
      ? `Customer: ${currentJob.customer_name}\nAddress: ${currentJob.address || 'Not provided'}\nNotes: ${currentJob.notes || 'None'}`
      : '';
    const newMessages = [...currentMessages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, doctrine: currentDoctrine, jobContext }),
      });
      const data = await res.json();
      const reply = data.message || 'Something went wrong.';
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
      await speak(reply);
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Connection issue. Try again.' }]);
    }
    setLoading(false);
  };

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const text = input;
    setInput('');
    doSend(text, messages, doctrine, activeJob);
  };

  const startListening = () => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    if (speaking) { audioRef.current?.pause(); setSpeaking(false); }
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { alert('Use Chrome for voice.'); return; }
    const r = new SR();
    recognitionRef.current = r;
    r.continuous = false;
    r.interimResults = false;
    r.lang = 'en-US';
    setListening(true);
    r.start();
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setListening(false);
      doSend(t, messages, doctrine, activeJob);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
  };

  const selectJob = (job: {id: string; customer_name: string; address: string; notes: string; status: string}) => {
    setActiveJob(job);
    setShowJobPicker(false);
    doSend(
      `Brief me fast. Pulling up to ${job.customer_name}${job.address ? ` at ${job.address}` : ''}${job.notes ? `. Notes: ${job.notes}` : ''}.`,
      messages, doctrine, job
    );
  };

  return (
    <div style={{ background: '#0b0f14', height: '100dvh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(240,122,46,0.4)} 50%{box-shadow:0 0 50px rgba(240,122,46,0.9)} }
        @keyframes ripple { 0%{transform:scale(1);opacity:0.5} 100%{transform:scale(2.8);opacity:0} }
        @keyframes bounce { 0%,80%,100%{transform:scale(0.8);opacity:0.5} 40%{transform:scale(1.2);opacity:1} }
        .mic-wrap { position:relative; width:52px; height:52px; flex-shrink:0; }
        .mic-btn { width:52px; height:52px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; border:none; font-size:0.8rem; font-weight:600; letter-spacing:0.05em; transition:all 0.2s; position:relative; z-index:1; font-family:'DM Sans',sans-serif; }
        .mic-idle { background:rgba(240,122,46,0.1); border:1.5px solid rgba(240,122,46,0.35); color:#f07a2e; }
        .mic-on { background:#f07a2e; animation:glow 1s ease-in-out infinite; color:#fff; border:none; }
        .ripple-ring { position:absolute; inset:-4px; border-radius:50%; border:2px solid #f07a2e; animation:ripple 1.2s ease-out infinite; pointer-events:none; }
        .msg-input { flex:1; background:#111820; border:1px solid rgba(255,255,255,0.07); border-radius:28px; padding:13px 18px; color:#e8edf2; font-family:'DM Sans',sans-serif; font-size:0.9rem; outline:none; }
        .msg-input::placeholder { color:#2d3f52; }
        .send-btn { padding:13px 20px; background:#f07a2e; border:none; border-radius:28px; color:#fff; font-family:'DM Sans',sans-serif; font-size:0.85rem; font-weight:500; cursor:pointer; flex-shrink:0; }
        .send-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .job-item { padding:10px 14px; background:#0b0f14; border:1px solid rgba(255,255,255,0.05); border-radius:8px; cursor:pointer; }
        .job-item:hover { border-color:rgba(240,122,46,0.3); }
      `}</style>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(11,15,20,0.98)', flexShrink:0, gap:'10px' }}>
        <Link href="/dashboard" style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.1rem', fontWeight:800, textDecoration:'none', color:'#e8edf2', flexShrink:0 }}>
          Remy<span style={{ color:'#f07a2e' }}>.</span>
        </Link>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {speaking && <span style={{ fontSize:'0.65rem', color:'#3daf76', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' }}>Speaking</span>}
          {listening && <span style={{ fontSize:'0.65rem', color:'#f07a2e', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' }}>Listening</span>}
          <div onClick={() => setShowJobPicker(!showJobPicker)} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(240,122,46,0.08)', border:'1px solid rgba(240,122,46,0.2)', borderRadius:'100px', padding:'6px 14px', fontSize:'0.72rem', color:'#f07a2e', cursor:'pointer', fontWeight:500, whiteSpace:'nowrap' }}>
            {activeJob ? `Job: ${activeJob.customer_name}` : '+ Select Job'}
          </div>
        </div>
        <Link href="/dashboard" style={{ fontSize:'0.75rem', color:'#2d3f52', textDecoration:'none', flexShrink:0 }}>Back</Link>
      </div>

      {showJobPicker && (
        <div style={{ background:'#111820', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'14px 16px', flexShrink:0 }}>
          <div style={{ fontSize:'0.65rem', color:'#2d3f52', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'0.12em' }}>Select Job</div>
          {jobs.length === 0 ? (
            <div style={{ fontSize:'0.82rem', color:'#3d5268' }}>No jobs found. <Link href="/dashboard/jobs" style={{ color:'#f07a2e', textDecoration:'none' }}>Create one</Link></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {jobs.map(job => (
                <div key={job.id} className="job-item" onClick={() => selectJob(job)}>
                  <div style={{ fontWeight:500, fontSize:'0.88rem' }}>{job.customer_name}</div>
                  {job.address && <div style={{ fontSize:'0.72rem', color:'#3d5268', marginTop:'2px' }}>{job.address}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pendingAudio && (
        <div onClick={() => playAudio(pendingAudio)} style={{ background:'rgba(240,122,46,0.1)', borderBottom:'1px solid rgba(240,122,46,0.2)', padding:'10px 16px', textAlign:'center', cursor:'pointer', fontSize:'0.8rem', color:'#f07a2e', flexShrink:0, fontWeight:500 }}>
          Tap to hear Remy
        </div>
      )}

      <div style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:'14px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display:'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems:'flex-end', gap:'8px' }}>
            {m.role === 'assistant' && (
              <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:'rgba(240,122,46,0.15)', border:'1px solid rgba(240,122,46,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', color:'#f07a2e', fontWeight:700, flexShrink:0 }}>R</div>
            )}
            <div style={{ maxWidth:'80%', padding:'11px 15px', borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: m.role === 'user' ? '#1a2535' : 'rgba(240,122,46,0.06)', border: m.role === 'user' ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(240,122,46,0.15)', fontSize:'0.88rem', lineHeight:1.65, color: m.role === 'user' ? '#8a9db5' : '#e8edf2' }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', alignItems:'flex-end', gap:'8px' }}>
            <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:'rgba(240,122,46,0.15)', border:'1px solid rgba(240,122,46,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', color:'#f07a2e', fontWeight:700 }}>R</div>
            <div style={{ padding:'12px 16px', borderRadius:'18px 18px 18px 4px', background:'rgba(240,122,46,0.06)', border:'1px solid rgba(240,122,46,0.15)', display:'flex', gap:'4px', alignItems:'center' }}>
              {[0,1,2].map(i => <span key={i} style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#f07a2e', display:'inline-block', animation:`bounce 1.2s ease-in-out ${i*0.16}s infinite` }}></span>)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(11,15,20,0.98)', flexShrink:0, paddingBottom:'max(12px, env(safe-area-inset-bottom))' }}>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <div className="mic-wrap">
            <button className={`mic-btn ${listening ? 'mic-on' : 'mic-idle'}`} onClick={startListening}>
              {listening ? 'Stop' : 'Mic'}
            </button>
            {listening && <div className="ripple-ring"></div>}
          </div>
          <input className="msg-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSend(); }} placeholder={listening ? 'Listening...' : 'Type or tap mic...'} disabled={listening} />
          <button className="send-btn" onClick={handleSend} disabled={loading || listening || !input.trim()}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default function VoicePage() {
  return (
    <Suspense fallback={<div style={{ background: '#0b0f14', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d5268', fontFamily: 'monospace' }}>Loading...</div>}>
      <VoiceInner />
    </Suspense>
  );
}