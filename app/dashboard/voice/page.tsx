'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

function VoiceInner() {
  const { isLoaded, user } = useUser();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<{role: string; content: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [doctrine, setDoctrine] = useState('');
  const [memories, setMemories] = useState<{content: string}[]>([]);
  const [jobs, setJobs] = useState<{id: string; customer_name: string; address: string; notes: string; status: string}[]>([]);
  const [activeJob, setActiveJob] = useState<{id: string; customer_name: string; address: string; notes: string; status: string} | null>(null);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const initialized = useRef(false);
  const messagesRef = useRef(messages);
  const doctrineRef = useRef(doctrine);
  const activeJobRef = useRef(activeJob);
  const memoriesRef = useRef(memories);

  // Keep refs in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { doctrineRef.current = doctrine; }, [doctrine]);
  useEffect(() => { activeJobRef.current = activeJob; }, [activeJob]);
  useEffect(() => { memoriesRef.current = memories; }, [memories]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isLoaded || initialized.current) return;
    initialized.current = true;
    init();
  }, [isLoaded]);

  // Auto-save session when user leaves
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && messagesRef.current.length >= 4) {
        autoSaveSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopAudio();
      if (recognitionRef.current) recognitionRef.current.stop();
      // Auto-save on unmount if enough messages
      if (messagesRef.current.length >= 4) autoSaveSession();
    };
  }, []);

  const autoSaveSession = async () => {
    if (sessionSaved || messagesRef.current.length < 4) return;
    try {
      const jobContext = activeJobRef.current ? `Job: ${activeJobRef.current.customer_name}` : '';
      
      // Save to memory (summarized)
      const memRes = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesRef.current,
          repId: user?.id,
          jobContext,
        }),
      });
      const memData = await memRes.json();

      // Save full conversation log to conversations table
      await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: activeJobRef.current?.id || null,
          repId: user?.id || null,
          messages: messagesRef.current,
          summary: memData.summary || null,
        }),
      });

      setSessionSaved(true);
    } catch { /* silent */ }
  };

  const init = async () => {
    const { data: docData } = await supabase.from('doctrine').select('content').eq('active', true);
    const docText = docData ? docData.map((d: {content: string}) => d.content).join('\n') : '';
    setDoctrine(docText);

    const { data: jobData } = await supabase.from('jobs').select('*').eq('status', 'active').order('created_at', { ascending: false });
    const allJobs = jobData || [];
    setJobs(allJobs);

    let repMemories: {content: string}[] = [];
    if (user?.id) {
      try {
        const memRes = await fetch(`/api/memory?repId=${user.id}`);
        const memData = await memRes.json();
        repMemories = memData.memories || [];
        setMemories(repMemories);
      } catch { /* no memories yet */ }
    }

    const jobId = searchParams.get('jobId');
    if (jobId && allJobs.length > 0) {
      const found = allJobs.find((j: {id: string}) => j.id === jobId);
      if (found) {
        setActiveJob(found);
        await doSend(
          `Brief me fast. Pulling up to ${found.customer_name}${found.address ? ` at ${found.address}` : ''}${found.notes ? `. Notes: ${found.notes}` : ''}.`,
          [], docText, found, repMemories
        );
        return;
      }
    }

    // Morning brief if jobs exist
    if (allJobs.length > 0) {
      const jobList = allJobs.slice(0, 5).map((j: {customer_name: string; address: string}) => `${j.customer_name}${j.address ? ` at ${j.address}` : ''}`).join(', ');
      const morningPrompt = `Give me a quick morning brief. I have ${allJobs.length} active job${allJobs.length > 1 ? 's' : ''} today: ${jobList}. What should I know to start the day strong?`;
      await doSend(morningPrompt, [], docText, null, repMemories);
      return;
    }

    setMessages([{ role: 'assistant', content: `Hey. I am Remy. No active jobs yet. Create one in Jobs and I will brief you before you knock. Or just tell me what you are walking into.` }]);
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if ((window as any).__remyAudio) {
      (window as any).__remyAudio.pause();
      (window as any).__remyAudio = null;
    }
    setSpeaking(false);
  };

  const playAudioUrl = async (url: string) => {
    stopAudio();
    setSpeaking(true);
    const audio = new Audio(url);
    audioRef.current = audio;
    (window as any).__remyAudio = audio;
    audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); audioRef.current = null; (window as any).__remyAudio = null; };
    audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
    try {
      await audio.play();
      setAudioReady(true);
    } catch {
      setSpeaking(false);
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
      await playAudioUrl(URL.createObjectURL(blob));
    } catch { setSpeaking(false); }
  };

  const doSend = async (
    text: string,
    currentMessages: {role: string; content: string}[],
    currentDoctrine: string,
    currentJob: {id: string; customer_name: string; address: string; notes: string} | null,
    currentMemories: {content: string}[]
  ) => {
    if (!text.trim()) return;
    const jobContext = currentJob ? `Customer: ${currentJob.customer_name}\nAddress: ${currentJob.address || 'Not provided'}\nNotes: ${currentJob.notes || 'None'}` : '';
    const newMessages = [...currentMessages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, doctrine: currentDoctrine, jobContext, memories: currentMemories }),
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
    doSend(text, messages, doctrine, activeJob, memories);
  };

  const startListening = () => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    if (speaking) stopAudio();
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
      doSend(t, messages, doctrine, activeJob, memories);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
  };

  const selectJob = (job: {id: string; customer_name: string; address: string; notes: string; status: string}) => {
    setActiveJob(job);
    setShowJobPicker(false);
    doSend(
      `Brief me fast. Pulling up to ${job.customer_name}${job.address ? ` at ${job.address}` : ''}${job.notes ? `. Notes: ${job.notes}` : ''}.`,
      messages, doctrine, job, memories
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
        .mic-btn { width:56px; height:56px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; border:none; font-size:0.75rem; font-weight:600; transition:all 0.2s; font-family:'DM Sans',sans-serif; flex-shrink:0; -webkit-tap-highlight-color:transparent; }
        .mic-idle { background:rgba(240,122,46,0.1); border:1.5px solid rgba(240,122,46,0.35); color:#f07a2e; }
        .mic-on { background:#f07a2e; animation:glow 1s ease-in-out infinite; color:#fff; border:none; position:relative; }
        .mic-on::after { content:''; position:absolute; inset:-6px; border-radius:50%; border:2px solid rgba(240,122,46,0.5); animation:ripple 1.2s ease-out infinite; pointer-events:none; }
        .msg-input { flex:1; background:#111820; border:1px solid rgba(255,255,255,0.07); border-radius:28px; padding:14px 18px; color:#e8edf2; font-family:'DM Sans',sans-serif; font-size:16px; outline:none; -webkit-appearance:none; }
        .msg-input::placeholder { color:#2d3f52; }
        .send-btn { padding:14px 20px; background:#f07a2e; border:none; border-radius:28px; color:#fff; font-family:'DM Sans',sans-serif; font-size:0.85rem; font-weight:500; cursor:pointer; flex-shrink:0; -webkit-tap-highlight-color:transparent; }
        .send-btn:disabled { opacity:0.4; }
        .job-item { padding:12px 14px; background:#0b0f14; border:1px solid rgba(255,255,255,0.05); border-radius:8px; cursor:pointer; margin-bottom:6px; -webkit-tap-highlight-color:transparent; }
        .job-item:hover { border-color:rgba(240,122,46,0.3); }
        .save-btn { padding:7px 14px; background:rgba(61,175,118,0.1); border:1px solid rgba(61,175,118,0.25); color:#3daf76; border-radius:20px; font-family:'DM Sans',sans-serif; font-size:0.68rem; font-weight:500; cursor:pointer; white-space:nowrap; -webkit-tap-highlight-color:transparent; }
        .save-btn:disabled { opacity:0.4; }
      `}</style>

      {/* Topbar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(11,15,20,0.98)', flexShrink:0, gap:'8px' }}>
        <Link href="/dashboard" style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.1rem', fontWeight:800, textDecoration:'none', color:'#e8edf2', flexShrink:0 }}>
          Remy<span style={{ color:'#f07a2e' }}>.</span>
        </Link>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', flex:1, justifyContent:'center', overflow:'hidden' }}>
          {speaking && (
            <button onClick={stopAudio} style={{ fontSize:'0.62rem', color:'#3daf76', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', flexShrink:0, background:'none', border:'none', cursor:'pointer', padding:'4px 8px' }}>
              Speaking (stop)
            </button>
          )}
          {listening && <span style={{ fontSize:'0.62rem', color:'#f07a2e', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', flexShrink:0 }}>Listening...</span>}
          {!speaking && !listening && (
            <div onClick={() => setShowJobPicker(!showJobPicker)} style={{ display:'inline-flex', alignItems:'center', gap:'5px', background:'rgba(240,122,46,0.08)', border:'1px solid rgba(240,122,46,0.2)', borderRadius:'100px', padding:'6px 14px', fontSize:'0.72rem', color:'#f07a2e', cursor:'pointer', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'160px' }}>
              {activeJob ? activeJob.customer_name : '+ Select Job'}
            </div>
          )}
          <button className="save-btn" onClick={autoSaveSession} disabled={sessionSaved || messages.length < 4}>
            {sessionSaved ? 'Saved' : 'Save'}
          </button>
        </div>
        <Link href="/dashboard" style={{ fontSize:'0.72rem', color:'#2d3f52', textDecoration:'none', flexShrink:0 }}>Back</Link>
      </div>

      {/* Job Picker */}
      {showJobPicker && (
        <div style={{ background:'#111820', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'14px 16px', flexShrink:0, maxHeight:'50vh', overflowY:'auto' }}>
          <div style={{ fontSize:'0.65rem', color:'#2d3f52', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'0.12em' }}>Select Job</div>
          {jobs.length === 0 ? (
            <div style={{ fontSize:'0.82rem', color:'#3d5268' }}>No active jobs. <Link href="/dashboard/jobs" style={{ color:'#f07a2e', textDecoration:'none' }}>Create one</Link></div>
          ) : jobs.map(job => (
            <div key={job.id} className="job-item" onClick={() => selectJob(job)}>
              <div style={{ fontWeight:500, fontSize:'0.9rem' }}>{job.customer_name}</div>
              {job.address && <div style={{ fontSize:'0.75rem', color:'#3d5268', marginTop:'3px' }}>{job.address}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:'14px', WebkitOverflowScrolling:'touch' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display:'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems:'flex-end', gap:'8px' }}>
            {m.role === 'assistant' && (
              <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'rgba(240,122,46,0.15)', border:'1px solid rgba(240,122,46,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', color:'#f07a2e', fontWeight:700, flexShrink:0 }}>R</div>
            )}
            <div style={{ maxWidth:'82%', padding:'12px 16px', borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: m.role === 'user' ? '#1a2535' : 'rgba(240,122,46,0.06)', border: m.role === 'user' ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(240,122,46,0.15)', fontSize:'0.9rem', lineHeight:1.65, color: m.role === 'user' ? '#8a9db5' : '#e8edf2' }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', alignItems:'flex-end', gap:'8px' }}>
            <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'rgba(240,122,46,0.15)', border:'1px solid rgba(240,122,46,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', color:'#f07a2e', fontWeight:700 }}>R</div>
            <div style={{ padding:'12px 16px', borderRadius:'18px 18px 18px 4px', background:'rgba(240,122,46,0.06)', border:'1px solid rgba(240,122,46,0.15)', display:'flex', gap:'5px', alignItems:'center' }}>
              {[0,1,2].map(i => <span key={i} style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#f07a2e', display:'inline-block', animation:`bounce 1.2s ease-in-out ${i*0.16}s infinite` }}></span>)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(11,15,20,0.98)', flexShrink:0, paddingBottom:'max(16px, env(safe-area-inset-bottom))' }}>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <button className={`mic-btn ${listening ? 'mic-on' : 'mic-idle'}`} onClick={startListening}>
            {listening ? 'Stop' : 'Mic'}
          </button>
          <input
            className="msg-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder={listening ? 'Listening...' : speaking ? 'Remy is speaking...' : 'Type or tap mic...'}
            disabled={listening}
          />
          <button className="send-btn" onClick={handleSend} disabled={loading || listening || !input.trim()}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default function VoicePage() {
  return (
    <Suspense fallback={<div style={{ background:'#0b0f14', height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', color:'#3d5268', fontFamily:'monospace' }}>Loading...</div>}>
      <VoiceInner />
    </Suspense>
  );
}
