'use client';
import { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

export default function VoicePage() {
  const { user } = useUser();
  const [messages, setMessages] = useState<{role: string; content: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ role: 'assistant', content: `Hey${user?.firstName ? ` ${user.firstName}` : ''}. I am Remy. Tell me about your current job - customer name, address, what you are walking into - and I will brief you before you knock.` }]);
    }
  }, [user]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.message }]);
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Connection issue. Try again.' }]);
    }
    setLoading(false);
  };

  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice not supported in this browser. Use Chrome.');
      return;
    }
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
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

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.1);opacity:0.8} }
        @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(240,122,46,0.3)} 50%{box-shadow:0 0 40px rgba(240,122,46,0.6)} }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(11,15,20,0.95)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <Link href="/dashboard" style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.1rem', fontWeight: 800, textDecoration: 'none', color: '#e8edf2' }}>Remy<span style={{ color: '#f07a2e' }}>.</span></Link>
        <div style={{ fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f07a2e', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f07a2e', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }}></span>
          Live Session
        </div>
        <Link href="/dashboard" style={{ fontSize: '0.8rem', color: '#7a8fa4', textDecoration: 'none' }}>Back</Link>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '720px', width: '100%', margin: '0 auto' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '80%', padding: '12px 16px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: m.role === 'user' ? '#1c2a38' : 'rgba(240,122,46,0.08)', border: m.role === 'user' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(240,122,46,0.2)', fontSize: '0.9rem', lineHeight: 1.6, color: m.role === 'user' ? '#7a8fa4' : '#e8edf2' }}>
              {m.role === 'assistant' && <div style={{ fontSize: '0.62rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f07a2e', marginBottom: '6px' }}>Remy</div>}
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: 'rgba(240,122,46,0.08)', border: '1px solid rgba(240,122,46,0.2)', display: 'flex', gap: '4px', alignItems: 'center' }}>
              {[0,1,2].map(i => <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f07a2e', opacity: 0.6, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}></span>)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(11,15,20,0.95)', backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={startVoice} style={{ width: '48px', height: '48px', borderRadius: '50%', background: listening ? '#f07a2e' : 'rgba(240,122,46,0.1)', border: '1px solid rgba(240,122,46,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: listening ? 'glow 1s ease-in-out infinite' : 'none', fontSize: '1.2rem' }}>
            {listening ? '🔴' : '🎙️'}
          </button>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send(input)} placeholder={listening ? 'Listening...' : 'Type or tap mic to speak...'} style={{ flex: 1, background: '#111820', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '13px 20px', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', outline: 'none' }} />
          <button onClick={() => send(input)} style={{ padding: '13px 20px', background: '#f07a2e', border: 'none', borderRadius: '24px', color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }}>Send</button>
        </div>
      </div>
    </div>
  );
}