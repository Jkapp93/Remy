'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

export default function VoicePage() {
  const { user } = useUser();
  const [messages, setMessages] = useState<{role: string; content: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [doctrine, setDoctrine] = useState('');
  const [jobs, setJobs] = useState<{id: string; customer_name: string; address: string; notes: string}[]>([]);
  const [activeJob, setActiveJob] = useState<{id: string; customer_name: string; address: string; notes: string} | null>(null);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user) return;
    loadContext();
  }, [user]);

  useEffect(() => {
    if (messages.length === 0 && user) {
      setMessages([{
        role: 'assistant',
        content: `Hey${user?.firstName ? ` ${user.firstName}` : ''}. I am Remy. Select a job or just tell me what you are walking into and I will brief you before you knock.`
      }]);
    }
  }, [user]);

  const loadContext = async () => {
    const { data: docData } = await supabase.from('doctrine').select('content').eq('active', true);
    if (docData) setDoctrine(docData.map((d: {content: string}) => d.content).join('\n'));
    const { data: jobData } = await supabase.from('jobs').select('*').eq('status', 'active').order('created_at', { ascending: false });
    if (jobData) setJobs(jobData);
  };

  const speak = async (text: string) => {
    try {
      setSpeaking(true);
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) { setSpeaking(false); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => setSpeaking(false);
      await audio.play();
    } catch {
      setSpeaking(false);
    }
  };

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const jobContext = activeJob
      ? `Customer: ${activeJob.customer_name}\nAddress: ${activeJob.address || 'Not set'}\nNotes: ${activeJob.notes || 'None'}`
      : '';
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          doctrine,
          jobContext,
        }),
      });
      const data = await res.json();
      const reply = data.message || 'Something went wrong.';
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
      await speak(reply);
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Connection issue. Try again.' }]);
    }
    setLoading(false);
  }, [messages, loading, doctrine, activeJob]);

  const startListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
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
      const transcript = e.results[0][0].transcript;
      setListening(false);
      send(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
  };

  const selectJob = (job: {id: string; customer_name: string; address: string; notes: string}) => {
    setActiveJob(job);
    setShowJobPicker(false);
    const briefMsg = `Pulling up to ${job.customer_name}${job.address ? ` at ${job.address}` : ''}. Brief me.`;
    send(briefMsg);
  };

  return (
    <div style={{ background: '#0b0f14', height: '100dvh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.15);opacity:0.7} }
        @keyframes ripple { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.5);opacity:0} }
        @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(240,122,46,0.4)} 50%{box-shadow:0 0 50px rgba(240,122,46,0.8)} }
        @keyframes speakpulse { 0%,100%{box-shadow:0 0 15px rgba(61,175,118,0.4)} 50%{box-shadow:0 0 40px rgba(61,175,118,0.8)} }
        .mic-btn { position:relative; width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; border:none; flex-shrink:0; font-size:1.5rem; transition:all 0.2s; }
        .mic-btn.idle { background:rgba(240,122,46,0.1); border:1.5px solid rgba(240,122,46,0.3); }
        .mic-btn.active { background:#f07a2e; animation:glow 1s ease-in-out infinite; }
        .mic-btn.active::after { content:''; position:absolute; inset:-4px; border-radius:50%; border:2px solid #f07a2e; animation:ripple 1s ease-out infinite; }
        .msg-input { flex:1; background:#111820; border:1px solid rgba(255,255,255,0.08); border-radius:24px; padding:14px 20px; color:#e8edf2; font-family:'DM Sans',sans-serif; font-size:0.9rem; outline:none; -webkit-appearance:none; }
        .msg-input::placeholder { color:#3d5268; }
        .send-btn { padding:14px 20px; background:#f07a2e; border:none; border-radius:24px; color:#fff; font-family:'DM Sans',sans-serif; font-size:0.85rem; font-weight:500; cursor:pointer; flex-shrink:0; }
        .job-pill { display:inline-flex; align-items:center; gap:6px; background:rgba(240,122,46,0.1); border:1px solid rgba(240,122,46,0.25); border-radius:100px; padding:5px 12px; font-size:0.72rem; color:#f07a2e; cursor:pointer; font-weight:500; }
        .status-dot { width:6px; height:6px; border-radius:50%; background:#3daf76; animation:pulse 2s ease-in-out infinite; }
        .speak-indicator { display:flex; align-items:center; gap:6px; font-size:0.72rem; color:#3daf76; font-weight:500; letter-spacing:0.08em; text-transform:uppercase; }
      `}</style>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(11,15,20,0.98)', backdropFilter: 'blur(20px)', flexShrink: 0 }}>
        <Link href="/dashboard" style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.1rem', fontWeight: 800, textDecoration: 'none', color: '#e8edf2' }}>
          Remy<span style={{ color: '#f07a2e' }}>.</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {speaking && (
            <div className="speak-indicator">
              <span className="status-dot" style={{ background: '#3daf76' }}></span>
              Speaking
            </div>
          )}
          {listening && (
            <div className="speak-indicator" style={{ color: '#f07a2e' }}>
              <span className="status-dot" style={{ background: '#f07a2e' }}></span>
              Listening
            </div>
          )}
          <div
            className="job-pill"
            onClick={() => setShowJobPicker(!showJobPicker)}
          >
            {activeJob ? `Job: ${activeJob.customer_name}` : '+ Select Job'}
          </div>
        </div>

        <Link href="/dashboard" style={{ fontSize: '0.78rem', color: '#3d5268', textDecoration: 'none' }}>Back</Link>
      </div>

      {/* Job Picker */}
      {showJobPicker && (
        <div style={{ background: '#111820', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '12px 16px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3d5268', marginBottom: '10px' }}>Select Active Job</div>
          {jobs.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: '#3d5268' }}>No active jobs. <Link href="/dashboard/jobs" style={{ color: '#f07a2e' }}>Create one</Link></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {jobs.map(job => (
                <div key={job.id} onClick={() => selectJob(job)} style={{ padding: '10px 14px', background: '#0b0f14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 500 }}>{job.customer_name}</div>
                  {job.address && <div style={{ fontSize: '0.75rem', color: '#3d5268', marginTop: '2px' }}>{job.address}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', WebkitOverflowScrolling: 'touch' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              padding: '11px 15px',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.role === 'user' ? '#1c2a38' : 'rgba(240,122,46,0.07)',
              border: m.role === 'user' ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(240,122,46,0.18)',
              fontSize: '0.88rem',
              lineHeight: 1.65,
              color: m.role === 'user' ? '#7a8fa4' : '#e8edf2',
            }}>
              {m.role === 'assistant' && (
                <div style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f07a2e', marginBottom: '5px' }}>Remy</div>
              )}
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '11px 15px', borderRadius: '16px 16px 16px 4px', background: 'rgba(240,122,46,0.07)', border: '1px solid rgba(240,122,46,0.18)', display: 'flex', gap: '5px', alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f07a2e', display: 'inline-block', animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite` }}></span>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(11,15,20,0.98)', backdropFilter: 'blur(20px)', flexShrink: 0, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className={`mic-btn ${listening ? 'active' : 'idle'}`}
            onClick={startListening}
          >
            {listening ? 'ðŸ”´' : 'ðŸŽ™ï¸'}
          </button>
          <input
            className="msg-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            placeholder={listening ? 'Listening...' : speaking ? 'Remy is speaking...' : 'Type or tap mic...'}
            disabled={listening || speaking}
          />
          <button className="send-btn" onClick={() => send(input)} disabled={loading || listening}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
