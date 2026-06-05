'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

export default function VoicePage() {
  const { user } = useUser();
  const router = useRouter();
  const [messages, setMessages] = useState<{role: string; content: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [doctrine, setDoctrine] = useState('');
  const [jobs, setJobs] = useState<{id: string; customer_name: string; address: string; notes: string}[]>([]);
  const [activeJob, setActiveJob] = useState<{id: string; customer_name: string; address: string; notes: string} | null>(null);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [pendingAudio, setPendingAudio] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user) return;
    loadContext();
  }, [user]);

  useEffect(() => {
    if (isFirstLoad.current && user && messages.length === 0) {
      isFirstLoad.current = false;
      const greeting = `Hey${user?.firstName ? ` ${user.firstName}` : ''}. I am Remy. Select a job from the top and I will brief you before you knock. Or just tell me what you are walking into.`;
      setMessages([{ role: 'assistant', content: greeting }]);
    }
  }, [user]);

  const loadContext = async () => {
    const { data: docData } = await supabase.from('doctrine').select('content').eq('active', true);
    if (docData) setDoctrine(docData.map((d: {content: string}) => d.content).join('\n'));
    const { data: jobData } = await supabase.from('jobs').select('*').eq('status', 'active').order('created_at', { ascending: false });
    if (jobData) setJobs(jobData);
  };

  const playAudio = async (url: string) => {
    setSpeaking(true);
    setPendingAudio(null);
    if (audioRef.current) {
      audioRef.current.pause();
    }
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
    } catch {
      setSpeaking(false);
    }
  };

  const send = useCallback(async (text: string, isAutomatic = false) => {
    if (!text.trim() || loading) return;
    const jobContext = activeJob
      ? `Customer: ${activeJob.customer_name}\nAddress: ${activeJob.address || 'Not provided'}\nNotes: ${activeJob.notes || 'None'}`
      : '';
    const newMessages = isAutomatic
      ? messages
      : [...messages, { role: 'user', content: text }];
    if (!isAutomatic) setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: isAutomatic
            ? [...newMessages, { role: 'user', content: text }]
            : newMessages.map(m => ({ role: m.role, content: m.content })),
          doctrine,
          jobContext,
        }),
      });
      const data = await res.json();
      const reply = data.message || 'Something went wrong.';
      const updatedMessages = isAutomatic
        ? [...newMessages, { role: 'user', content: text }, { role: 'assistant', content: reply }]
        : [...newMessages, { role: 'assistant', content: reply }];
      setMessages(updatedMessages);
      await speak(reply);
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Connection issue. Try again.' }]);
    }
    setLoading(false);
  }, [messages, loading, doctrine, activeJob]);

  const startListening = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    if (speaking) {
      audioRef.current?.pause();
      setSpeaking(false);
    }
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      alert('Use Chrome for voice support.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    setListening(true);
    recognition.start();
    recognition.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setListening(false);
      send(t);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
  }, [listening, speaking, send]);

  const selectJob = useCallback((job: {id: string; customer_name: string; address: string; notes: string}) => {
    setActiveJob(job);
    setShowJobPicker(false);
    const briefPrompt = `I am about to pull up to ${job.customer_name}${job.address ? ` at ${job.address}` : ''}${job.notes ? `. Here is what I know: ${job.notes}` : ''}. Brief me fast before I knock.`;
    send(briefPrompt, true);
  }, [send]);

  return (
    <div style={{ background: '#0b0f14', height: '100dvh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.1)} }
        @keyframes ripple { 0%{transform:scale(1);opacity:0.5} 100%{transform:scale(2.8);opacity:0} }
        @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(240,122,46,0.4)} 50%{box-shadow:0 0 50px rgba(240,122,46,0.9)} }
        @keyframes speakglow { 0%,100%{box-shadow:0 0 15px rgba(61,175,118,0.4)} 50%{box-shadow:0 0 35px rgba(61,175,118,0.8)} }
        @keyframes dotbounce { 0%,80%,100%{transform:scale(0.8);opacity:0.5} 40%{transform:scale(1.2);opacity:1} }
        .mic-wrap { position:relative; width:64px; height:64px; flex-shrink:0; }
        .mic-btn { width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; border:none; font-size:1.5rem; transition:all 0.2s; position:relative; z-index:1; }
        .mic-idle { background:rgba(240,122,46,0.1); border:1.5px solid rgba(240,122,46,0.35); }
        .mic-listening { background:#f07a2e; animation:glow 1s ease-in-out infinite; }
        .mic-speaking { background:rgba(61,175,118,0.15); border:1.5px solid rgba(61,175,118,0.5); animation:speakglow 1.5s ease-in-out infinite; }
        .ripple-ring { position:absolute; inset:-4px; border-radius:50%; border:2px solid #f07a2e; animation:ripple 1.2s ease-out infinite; pointer-events:none; }
        .msg-input { flex:1; background:#111820; border:1px solid rgba(255,255,255,0.07); border-radius:28px; padding:14px 20px; color:#e8edf2; font-family:'DM Sans',sans-serif; font-size:0.92rem; outline:none; -webkit-appearance:none; transition:border-color 0.2s; }
        .msg-input:focus { border-color:rgba(240,122,46,0.3); }
        .msg-input::placeholder { color:#2d3f52; }
        .send-btn { padding:14px 22px; background:#f07a2e; border:none; border-radius:28px; color:#fff; font-family:'DM Sans',sans-serif; font-size:0.88rem; font-weight:500; cursor:pointer; flex-shrink:0; transition:background 0.2s; }
        .send-btn:hover { background:#ff8f40; }
        .send-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .job-pill { display:inline-flex; align-items:center; gap:6px; background:rgba(240,122,46,0.08); border:1px solid rgba(240,122,46,0.2); border-radius:100px; padding:6px 14px; font-size:0.72rem; color:#f07a2e; cursor:pointer; font-weight:500; transition:all 0.2s; white-space:nowrap; }
        .job-pill:hover { background:rgba(240,122,46,0.15); }
        .status-badge { display:flex; align-items:center; gap:5px; font-size:0.68rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; }
      `}</style>

      {/* Topbar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(11,15,20,0.98)', backdropFilter:'blur(20px)', flexShrink:0, gap:'10px' }}>
        <Link href="/dashboard" style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.1rem', fontWeight:800, textDecoration:'none', color:'#e8edf2', flexShrink:0 }}>
          Remy<span style={{ color:'#f07a2e' }}>.</span>
        </Link>

        <div style={{ display:'flex', alignItems:'center', gap:'8px', flex:1, justifyContent:'center', overflow:'hidden' }}>
          {speaking && <div className="status-badge" style={{ color:'#3daf76' }}><span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#3daf76', display:'inline-block', animation:'pulse 1.5s ease-in-out infinite' }}></span>Speaking</div>}
          {listening && <div className="status-badge" style={{ color:'#f07a2e' }}><span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#f07a2e', display:'inline-block', animation:'pulse 1s ease-in-out infinite' }}></span>Listening</div>}
          <div className="job-pill" onClick={() => setShowJobPicker(!showJobPicker)} style={{ maxWidth:'180px', overflow:'hidden', textOverflow:'ellipsis' }}>
            {activeJob ? `ðŸ“ ${activeJob.customer_name}` : '+ Select Job'}
          </div>
        </div>

        <Link href="/dashboard" style={{ fontSize:'0.75rem', color:'#2d3f52', textDecoration:'none', flexShrink:0 }}>Back</Link>
      </div>

      {/* Job Picker Dropdown */}
      {showJobPicker && (
        <div style={{ background:'#111820', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'14px 16px', flexShrink:0 }}>
          <div style={{ fontSize:'0.65rem', color:'#2d3f52', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:500 }}>Active Jobs</div>
          {jobs.length === 0 ? (
            <div style={{ fontSize:'0.82rem', color:'#3d5268' }}>
              No active jobs. <Link href="/dashboard/jobs" style={{ color:'#f07a2e', textDecoration:'none' }}>Create one â†’</Link>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'200px', overflowY:'auto' }}>
              {jobs.map(job => (
                <div key={job.id} onClick={() => selectJob(job)} style={{ padding:'10px 14px', background:'#0b0f14', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'8px', cursor:'pointer', transition:'border-color 0.2s' }}>
                  <div style={{ fontWeight:500, fontSize:'0.88rem' }}>{job.customer_name}</div>
                  {job.address && <div style={{ fontSize:'0.72rem', color:'#3d5268', marginTop:'2px' }}>{job.address}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tap to hear banner */}
      {pendingAudio && (
        <div onClick={() => playAudio(pendingAudio)} style={{ background:'rgba(240,122,46,0.1)', borderBottom:'1px solid rgba(240,122,46,0.2)', padding:'10px 16px', textAlign:'center', cursor:'pointer', fontSize:'0.8rem', color:'#f07a2e', flexShrink:0, fontWeight:500 }}>
          ðŸ‘† Tap to hear Remy
        </div>
      )}

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:'14px', WebkitOverflowScrolling:'touch' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display:'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems:'flex-end', gap:'8px' }}>
            {m.role === 'assistant' && (
              <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'rgba(240,122,46,0.15)', border:'1px solid rgba(240,122,46,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', flexShrink:0, marginBottom:'2px' }}>R</div>
            )}
            <div style={{ maxWidth:'80%', padding:'11px 15px', borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: m.role === 'user' ? '#1a2535' : 'rgba(240,122,46,0.06)', border: m.role === 'user' ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(240,122,46,0.15)', fontSize:'0.88rem', lineHeight:1.65, color: m.role === 'user' ? '#8a9db5' : '#e8edf2' }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', alignItems:'flex-end', gap:'8px' }}>
            <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'rgba(240,122,46,0.15)', border:'1px solid rgba(240,122,46,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', flexShrink:0 }}>R</div>
            <div style={{ padding:'12px 16px', borderRadius:'18px 18px 18px 4px', background:'rgba(240,122,46,0.06)', border:'1px solid rgba(240,122,46,0.15)', display:'flex', gap:'4px', alignItems:'center' }}>
              {[0,1,2].map(i => <span key={i} style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#f07a2e', display:'inline-block', animation:`dotbounce 1.2s ease-in-out ${i*0.16}s infinite` }}></span>)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(11,15,20,0.98)', backdropFilter:'blur(20px)', flexShrink:0, paddingBottom:'max(12px, env(safe-area-inset-bottom))' }}>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <div className="mic-wrap">
            <button
              className={`mic-btn ${listening ? 'mic-listening' : speaking ? 'mic-speaking' : 'mic-idle'}`}
              onClick={startListening}
            >
              {listening ? 'â¹' : speaking ? 'ðŸ”Š' : 'ðŸŽ™ï¸'}
            </button>
            {listening && <div className="ripple-ring"></div>}
          </div>
          <input
            className="msg-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={listening ? 'Listening...' : speaking ? 'Remy is speaking...' : 'Type or tap mic to speak...'}
            disabled={listening}
          />
          <button className="send-btn" onClick={() => send(input)} disabled={loading || listening || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
