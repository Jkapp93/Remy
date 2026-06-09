'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useProfile } from '../../../lib/useProfile';
import { useUser } from '@clerk/nextjs';

export default function DoctrinePage() {
  const { profile } = useProfile();
  const { user } = useUser();
  const [items, setItems] = useState<{id: string; content: string; type: string; created_at: string}[]>([]);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listening, setListening] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => { if (user || profile) loadDoctrine(); }, [user, profile]);

  const loadDoctrine = async () => {
    const clerkId = user?.id || profile?.clerk_id;
    if (!clerkId) return;
    const res = await fetch(`/api/doctrine?clerkId=${clerkId}`);
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  };

  const save = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await fetch('/api/doctrine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, type: 'text', company_id: profile?.company_id || null }),
    });
    setContent('');
    setSaving(false);
    loadDoctrine();
  };

  const remove = async (id: string) => {
    await fetch('/api/doctrine', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: false }),
    });
    loadDoctrine();
  };

  const startListening = () => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { alert('Use Chrome for voice input.'); return; }
    const r = new SR();
    recognitionRef.current = r;
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    setListening(true);
    r.start();
    let finalTranscript = '';
    r.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      setContent(finalTranscript + interim);
    };
    r.onerror = () => setListening(false);
    r.onend = () => { setListening(false); setContent(finalTranscript.trim()); };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadStatus('Reading file...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/doctrine-upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.content) {
        setUploadStatus('Injecting into Remy brain...');
        const chunks = data.content.match(/[\s\S]{1,800}/g) || [data.content];
        for (const chunk of chunks) {
          await fetch('/api/doctrine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: chunk.trim(), type: 'pdf', company_id: profile?.company_id || null }),
          });
        }
        setUploadStatus(`Done. ${chunks.length} chunk${chunks.length > 1 ? 's' : ''} injected.`);
        loadDoctrine();
        setTimeout(() => setUploadStatus(''), 4000);
      }
    } catch {
      setUploadStatus('Upload failed. Try again.');
      setTimeout(() => setUploadStatus(''), 3000);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const broadcastUpdate = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await fetch('/api/doctrine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `[BROADCAST] ${content}`, type: 'broadcast', company_id: profile?.company_id || null }),
    });
    setContent('');
    setSaving(false);
    loadDoctrine();
  };

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes glow { 0%,100%{box-shadow:0 0 15px rgba(240,122,46,0.3)} 50%{box-shadow:0 0 35px rgba(240,122,46,0.7)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .upload-zone { border:1.5px dashed rgba(255,255,255,0.1); border-radius:10px; padding:28px; text-align:center; cursor:pointer; transition:all 0.2s; }
        .upload-zone:hover { border-color:rgba(240,122,46,0.4); background:rgba(240,122,46,0.03); }
        .doctrine-item { background:#111820; border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:14px 16px; display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:8px; }
        .doctrine-broadcast { border-color:rgba(61,175,118,0.2); background:rgba(61,175,118,0.03); }
        .doctrine-pdf { border-color:rgba(74,159,212,0.2); background:rgba(74,159,212,0.03); }
        .type-badge { font-size:0.58rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; padding:2px 8px; border-radius:4px; margin-bottom:6px; display:inline-block; }
      `}</style>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(11,15,20,0.95)', position:'sticky', top:0, zIndex:100 }}>
        <Link href="/dashboard" style={{ fontFamily:"'Syne', sans-serif", fontSize:'1.1rem', fontWeight:800, textDecoration:'none', color:'#e8edf2' }}>Remy<span style={{ color:'#f07a2e' }}>.</span></Link>
        <Link href="/dashboard" style={{ fontSize:'0.8rem', color:'#7a8fa4', textDecoration:'none' }}>Back</Link>
      </div>

      <div style={{ maxWidth:'720px', margin:'0 auto', padding:'32px 24px' }}>
        <h1 style={{ fontFamily:"'Syne', sans-serif", fontSize:'1.8rem', fontWeight:800, marginBottom:'6px' }}>Doctrine</h1>
        <p style={{ color:'#7a8fa4', fontSize:'0.88rem', fontWeight:300, marginBottom:'32px' }}>Inject company knowledge into every rep agent. Speak it, type it, or upload a file.</p>

        {/* Input */}
        <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px', marginBottom:'16px' }}>
          <div style={{ fontSize:'0.68rem', fontWeight:500, letterSpacing:'0.12em', textTransform:'uppercase', color:'#f07a2e', marginBottom:'14px' }}>Voice or Text Input</div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={'Speak or type doctrine...\n\nExamples:\n- We charge $850/sq for shingles\n- Always lead with our lifetime warranty\n- New spring discount: 10% off labor through May'}
            rows={5}
            style={{ width:'100%', background:'#0b0f14', border:`1px solid ${listening ? 'rgba(240,122,46,0.5)' : 'rgba(255,255,255,0.07)'}`, borderRadius:'8px', padding:'12px 14px', color:'#e8edf2', fontFamily:"'DM Sans', sans-serif", fontSize:'0.9rem', outline:'none', resize:'vertical', marginBottom:'12px', transition:'border-color 0.2s' }}
          />
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            <button
              onClick={startListening}
              style={{ padding:'9px 18px', background: listening ? '#f07a2e' : 'rgba(240,122,46,0.1)', border:'1px solid rgba(240,122,46,0.3)', borderRadius:'8px', color: listening ? '#fff' : '#f07a2e', fontFamily:"'DM Sans',sans-serif", fontSize:'0.82rem', fontWeight:500, cursor:'pointer', animation: listening ? 'glow 1s ease-in-out infinite' : 'none' }}
            >
              {listening ? 'Stop Recording' : 'Speak Doctrine'}
            </button>
            <button onClick={save} disabled={saving || !content.trim()} style={{ padding:'9px 18px', background:'#f07a2e', border:'none', borderRadius:'8px', color:'#fff', fontFamily:"'DM Sans',sans-serif", fontSize:'0.82rem', fontWeight:500, cursor:'pointer', opacity: saving || !content.trim() ? 0.5 : 1 }}>
              {saving ? 'Injecting...' : 'Inject Doctrine'}
            </button>
            <button onClick={broadcastUpdate} disabled={saving || !content.trim()} style={{ padding:'9px 18px', background:'rgba(61,175,118,0.1)', border:'1px solid rgba(61,175,118,0.25)', borderRadius:'8px', color:'#3daf76', fontFamily:"'DM Sans',sans-serif", fontSize:'0.82rem', fontWeight:500, cursor:'pointer', opacity: saving || !content.trim() ? 0.5 : 1 }}>
              Broadcast to All Reps
            </button>
          </div>
        </div>

        {/* File Upload */}
        <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px', marginBottom:'28px' }}>
          <div style={{ fontSize:'0.68rem', fontWeight:500, letterSpacing:'0.12em', textTransform:'uppercase', color:'#4a9fd4', marginBottom:'14px' }}>Upload File to Brain</div>
          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <div style={{ width:'40px', height:'40px', borderRadius:'8px', background:'rgba(74,159,212,0.1)', border:'1px solid rgba(74,159,212,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:'1.1rem', color:'#4a9fd4' }}>PDF</div>
            <div style={{ fontSize:'0.88rem', color:'#7a8fa4', marginBottom:'4px' }}>{uploading ? uploadStatus : 'Drop a PDF, TXT, or DOC file'}</div>
            <div style={{ fontSize:'0.72rem', color:'#3d5268' }}>Product guides, pricing sheets, scripts, training docs</div>
          </div>
          {uploadStatus && !uploading && (
            <div style={{ marginTop:'10px', fontSize:'0.8rem', color:'#3daf76', fontWeight:500 }}>{uploadStatus}</div>
          )}
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display:'none' }} onChange={handleFileUpload} />
        </div>

        {/* Active Doctrine */}
        <div style={{ fontSize:'0.68rem', fontWeight:500, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>
          Active Doctrine ({items.length} entries)
        </div>

        {loading ? (
          <div style={{ color:'#3d5268', textAlign:'center', padding:'32px', fontSize:'0.85rem' }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ color:'#3d5268', textAlign:'center', padding:'32px', fontSize:'0.85rem' }}>No doctrine yet. Add your first entry above.</div>
        ) : (
          items.map(item => (
            <div key={item.id} className={`doctrine-item ${item.type === 'broadcast' ? 'doctrine-broadcast' : item.type === 'pdf' ? 'doctrine-pdf' : ''}`}>
              <div style={{ flex:1 }}>
                <span className="type-badge" style={{
                  background: item.type === 'broadcast' ? 'rgba(61,175,118,0.1)' : item.type === 'pdf' ? 'rgba(74,159,212,0.1)' : 'rgba(240,122,46,0.1)',
                  color: item.type === 'broadcast' ? '#3daf76' : item.type === 'pdf' ? '#4a9fd4' : '#f07a2e'
                }}>
                  {item.type === 'broadcast' ? 'Broadcast' : item.type === 'pdf' ? 'PDF' : 'Text'}
                </span>
                <div style={{ fontSize:'0.85rem', color:'#7a8fa4', lineHeight:1.6, fontWeight:300 }}>{item.content}</div>
                <div style={{ fontSize:'0.62rem', color:'#2d3f52', marginTop:'6px' }}>
                  {new Date(item.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}
                </div>
              </div>
              <button onClick={() => remove(item.id)} style={{ background:'transparent', border:'none', color:'#2d3f52', cursor:'pointer', fontSize:'1rem', flexShrink:0, padding:'2px 4px' }}>x</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
