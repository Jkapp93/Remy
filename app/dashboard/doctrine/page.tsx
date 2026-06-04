'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

export default function DoctrinePage() {
  const [items, setItems] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDoctrine(); }, []);

  const loadDoctrine = async () => {
    const { data } = await supabase.from('doctrine').select('*').eq('active', true).order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  const save = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await supabase.from('doctrine').insert({ content, type: 'text', active: true });
    setContent('');
    setSaving(false);
    loadDoctrine();
  };

  const remove = async (id: string) => {
    await supabase.from('doctrine').update({ active: false }).eq('id', id);
    loadDoctrine();
  };

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap'); * { box-sizing:border-box; margin:0; padding:0; }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(11,15,20,0.95)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <Link href="/dashboard" style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.1rem', fontWeight: 800, textDecoration: 'none', color: '#e8edf2' }}>Remy<span style={{ color: '#f07a2e' }}>.</span></Link>
        <Link href="/dashboard" style={{ fontSize: '0.8rem', color: '#7a8fa4', textDecoration: 'none' }}>â† Dashboard</Link>
      </div>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.8rem', fontWeight: 800, marginBottom: '8px' }}>Doctrine</h1>
        <p style={{ color: '#7a8fa4', fontSize: '0.88rem', fontWeight: 300, marginBottom: '28px' }}>Inject company knowledge. Remy will use this in every conversation.</p>

        <div style={{ background: '#111820', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f07a2e', marginBottom: '12px' }}>Add Doctrine</div>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={'Examples:\n- We charge $850 per square for shingles\n- Always lead with our lifetime warranty\n- Never mention competitor pricing first'} rows={5} style={{ width: '100%', background: '#0b0f14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px 14px', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', outline: 'none', resize: 'vertical', marginBottom: '12px' }} />
          <button onClick={save} disabled={saving} style={{ background: '#f07a2e', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Inject Doctrine'}</button>
        </div>

        {loading ? <div style={{ color: '#7a8fa4', textAlign: 'center', padding: '40px' }}>Loading...</div> : items.length === 0 ? (
          <div style={{ color: '#3d5268', textAlign: 'center', padding: '40px', fontSize: '0.88rem' }}>No doctrine yet. Add your first entry above.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map((item: any) => (
              <div key={item.id} style={{ background: '#111820', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ fontSize: '0.88rem', color: '#7a8fa4', lineHeight: 1.6, flex: 1, fontWeight: 300 }}>{item.content}</div>
                <button onClick={() => remove(item.id)} style={{ background: 'transparent', border: 'none', color: '#3d5268', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0, padding: '2px' }}>âœ•</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
