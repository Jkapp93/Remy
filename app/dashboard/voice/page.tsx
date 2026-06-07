'use client';
import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

const VOICES: Record<string, string> = {
  'Remy': 'f786b574-daa5-4673-aa0c-cbe3e8534c02',
  'Parker': '30894953-bcce-41fe-892c-15ce19c843ff',
  'Thandi': '692846ad-1a6b-49b8-bfc5-86421fd41a19',
  'Ruby': 'ed9ccfa4-8fa1-40f8-bfb2-cb7d67d2f9cd',
  'Archie': 'ef191366-f52f-447a-a398-ed8c0f2943a1',
  'Joey': '34575e71-908f-4ab6-ab54-b08c95d6597d',
};

type Job = { id: string; customer_name: string; address: string; job_type: string; status: string; notes?: string };
type Message = { role: 'user' | 'assistant'; content: string };

const JOB_COLORS: Record<string, string> = {
  roofing: '#f07a2e', fencing: '#4a9fd4', hvac: '#3daf76',
  painting: '#9b59b6', plumbing: '#e74c3c', solar: '#f1c40f',
  restoration: '#e67e22', other: '#7a8fa4',
};

export default function VoicePage() {
  const { user, isLoaded } = useUser();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceId, setVoiceId] = useState(VOICES['Remy']);
  const [showJobs, setShowJobs] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    loadJobs();
    const saved = localStorage.getItem('remy_voice');
    if (saved) setVoiceId(saved);
    checkLimit();
  }, [isLoaded, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadJobs = async () => {
    const res = await fetch('/api/jobs');
    const data = await res.json();
    setJobs((data.jobs || []).filter((j: Job) => j.status === 'active'));
  };

  const checkLimit = async () => {
    if (!user) return;
    const res = await fetch(`/api/rate-limit?repId=${user.id}`);
    const data = await res.json();
    setRemaining(data.remaining);
  };

  const speak = async (text: string) => {
    setSpeaking(true);
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => setSpeaking(false);
      await audio.play();
    } catch { setSpeaking(false); }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || !user) return;
    if (remaining !== null && remaining <= 0) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Daily limit reached. Upgrade your plan for more messages.' }]);
      return;
    }
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const jobContext = currentJob
      ? `Customer: ${currentJob.customer_name}\nAddress: ${currentJob.address}\nJob Type: ${currentJob.job_type}\nNotes: ${currentJob.notes || 'None'}`
      : null;

    try {
      const [docRes, memRes] = await Promise.all([
        fetch('/api/doctrine-list'),
        fetch(`/api/memory?repId=${user.id}`),
      ]);
      const docData = await docRes.json();
      const memData = await memRes.json();
      const doctrine = (docData.doctrine || []).map((d: any) => d.content).join('\n');
      const memories = memData.memories || [];

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          doctrine,
          jobContext,
          memories,
          repId: user.id,
          jobId: currentJob?.id,
        }),
      });
      const data = await res.json();
      const reply = data.message || 'Something went wrong.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setRemaining(prev => prev !== null ? Math.max(0, prev - 1) : null);

      // Save conversation
      fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repId: user.id, jobId: currentJob?.id, summary: reply.slice(0, 200) }),
      }).catch(() => {});

      await speak(reply);
    } catch { setLoading(false); }
    setLoading(false);
  };

  const briefMe = async () => {
    if (!currentJob) return;
    await sendMessage(`Brief me on ${currentJob.customer_name} at ${currentJob.address}. Job type: ${currentJob.job_type}.`);
  };

  const briefDay = async () => {
    await sendMessage(`Brief my day. I have ${jobs.length} active jobs. Give me a sharp overview of what to focus on today.`);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const fd = new FormData();
        fd.append('audio', blob, 'audio.webm');
        const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.text?.trim()) await sendMessage(data.text);
      };
      mr.start();
      setRecording(true);
      setTimeout(() => { if (mr.state === 'recording') { mr.stop(); setRecording(false); } }, 8000);
    } catch { setRecording(false); }
  };

  const stopRecording = () => {
    if (mediaRef.current?.state === 'recording') { mediaRef.current.stop(); setRecording(false); }
  };

  const stopSpeaking = () => { audioRef.current?.pause(); setSpeaking(false); };

  const jobColor = currentJob ? (JOB_COLORS[currentJob.job_type] || '#7a8fa4') : '#f07a2e';

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', maxWidth: '100vw', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body { overscroll-behavior: none; }
        .msg-user { background: rgba(240,122,46,0.1); border: 1px solid rgba(240,122,46,0.15); border-radius: 16px 16px 4px 16px; padding: 12px 16px; align-self: flex-end; max-width: 80%; }
        .msg-remy { background: #111820; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px 16px 16px 4px; padding: 12px 16px; align-self: flex-start; max-width: 85%; }
        .job-pill { display: flex; align-items: center; gap: 8px; background: #111820; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 14px; cursor: pointer; transition: border-color 0.2s; }
        .job-pill:active { opacity: 0.7; }
        .action-btn { border: none; border-radius: 12px; padding: 14px 20px; font-family: 'DM Sans', sans-serif; font-size: 0.88rem; font-weight: 600; cursor: pointer; transition: opacity 0.15s; flex: 1; }
        .action-btn:active { opacity: 0.7; }
        .mic-btn { width: 64px; height: 64px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; transition: transform 0.1s; flex-shrink: 0; }
        .mic-btn:active { transform: scale(0.92); }
        .job-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: background 0.15s; }
        .job-item:active { background: rgba(255,255,255,0.03); }
        input:focus { outline: none; }
      `}</style>

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(11,15,20,0.98)', position: 'sticky', top: 0, zIndex: 50 }}>
        <Link href="/dashboard" style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.2rem', textDecoration: 'none', color: '#e8edf2' }}>
          Remy<span style={{ color: '#f07a2e' }}>.</span>
        </Link>
        {remaining !== null && (
          <div style={{ fontSize: '0.72rem', color: '#3d5268', fontWeight: 300 }}>{remaining} msgs left today</div>
        )}
      </div>

      {/* Job Selector */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="job-pill" onClick={() => setShowJobs(true)} style={{ borderColor: currentJob ? jobColor + '44' : 'rgba(255,255,255,0.08)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: currentJob ? jobColor : '#3d5268', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{currentJob ? currentJob.customer_name : 'Select a job'}</div>
            {currentJob && <div style={{ fontSize: '0.72rem', color: '#3d5268', marginTop: '1px' }}>{currentJob.address}</div>}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#3d5268' }}>â–¼</div>
        </div>

        {/* Brief buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button className="action-btn" onClick={briefMe} disabled={!currentJob || loading} style={{ background: currentJob ? jobColor : 'rgba(255,255,255,0.05)', color: currentJob ? '#fff' : '#3d5268', opacity: !currentJob || loading ? 0.5 : 1 }}>
            Brief Me
          </button>
          <button className="action-btn" onClick={briefDay} disabled={loading} style={{ background: 'rgba(255,255,255,0.06)', color: '#e8edf2', opacity: loading ? 0.5 : 1 }}>
            Brief My Day
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', WebkitOverflowScrolling: 'touch' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#2d3f52', fontSize: '0.85rem', fontWeight: 300, marginTop: '40px', lineHeight: 1.8 }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '12px' }}>ðŸ‘‹</div>
            {currentJob ? `Select Brief Me to get prepped for ${currentJob.customer_name}.` : 'Select a job or tap Brief My Day to get started.'}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'msg-user' : 'msg-remy'}>
            <div style={{ fontSize: '0.88rem', lineHeight: 1.6, fontWeight: 300 }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="msg-remy">
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#f07a2e', animation: `pulse 1s ease-in-out ${i*0.2}s infinite alternate` }} />)}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(11,15,20,0.98)', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder="Talk to Remy..."
          style={{ flex: 1, background: '#111820', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px 16px', color: '#e8edf2', fontFamily: "'DM Sans',sans-serif", fontSize: '0.9rem', fontWeight: 300 }}
        />
        {speaking ? (
          <button className="mic-btn" onClick={stopSpeaking} style={{ background: 'rgba(240,122,46,0.15)', color: '#f07a2e', border: '2px solid #f07a2e' }}>â¹</button>
        ) : recording ? (
          <button className="mic-btn" onClick={stopRecording} style={{ background: '#f07a2e', color: '#fff', border: 'none', animation: 'pulse-ring 1s ease-in-out infinite' }}>ðŸŽ™</button>
        ) : (
          <button className="mic-btn" onClick={input.trim() ? () => sendMessage(input) : startRecording} style={{ background: input.trim() ? '#f07a2e' : '#111820', color: input.trim() ? '#fff' : '#7a8fa4', border: '1px solid rgba(255,255,255,0.08)' }}>
            {input.trim() ? 'â†‘' : 'ðŸŽ™'}
          </button>
        )}
      </div>

      {/* Job picker overlay */}
      {showJobs && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setShowJobs(false)}>
          <div style={{ background: '#111820', borderRadius: '20px 20px 0 0', maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1rem' }}>Select Job</div>
              <button onClick={() => setShowJobs(false)} style={{ background: 'transparent', border: 'none', color: '#3d5268', fontSize: '1.2rem', cursor: 'pointer' }}>âœ•</button>
            </div>
            <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div className="job-item" onClick={() => { setCurrentJob(null); setShowJobs(false); }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3d5268' }} />
                <div style={{ color: '#3d5268', fontSize: '0.88rem' }}>No job selected</div>
              </div>
              {jobs.map(job => {
                const col = JOB_COLORS[job.job_type] || '#7a8fa4';
                return (
                  <div key={job.id} className="job-item" onClick={() => { setCurrentJob(job); setShowJobs(false); setMessages([]); }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{job.customer_name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#3d5268', marginTop: '2px' }}>{job.address}</div>
                    </div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: col, background: col + '22', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>{job.job_type}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0% { opacity: 0.3; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1.2); } }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(240,122,46,0.4); } 70% { box-shadow: 0 0 0 12px rgba(240,122,46,0); } 100% { box-shadow: 0 0 0 0 rgba(240,122,46,0); } }
      `}</style>
    </div>
  );
}
