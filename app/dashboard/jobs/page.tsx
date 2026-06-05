'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

export default function JobsPage() {
  const { isLoaded } = useUser();
  const [jobs, setJobs] = useState<{id: string; customer_name: string; address: string; notes: string; status: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  useEffect(() => {
    if (!isLoaded) return;
    loadJobs();
  }, [isLoaded]);

  const loadJobs = async () => {
    setLoading(true);
    const query = supabase.from('jobs').select('*').order('created_at', { ascending: false });
    const { data } = filter === 'active' ? await query.eq('status', 'active') : await query;
    setJobs(data || []);
    setLoading(false);
  };

  useEffect(() => { if (isLoaded) loadJobs(); }, [filter]);

  const createJob = async () => {
    if (!customerName.trim()) return;
    setSaving(true);
    await supabase.from('jobs').insert({ customer_name: customerName, address, notes, status: 'active' });
    setCustomerName(''); setAddress(''); setNotes('');
    setShowNew(false);
    setSaving(false);
    loadJobs();
  };

  const closeJob = async (id: string) => {
    await supabase.from('jobs').update({ status: 'closed' }).eq('id', id);
    loadJobs();
  };

  const deleteJob = async (id: string) => {
    await supabase.from('jobs').delete().eq('id', id);
    loadJobs();
  };

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap'); * { box-sizing:border-box; margin:0; padding:0; }`}</style>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(11,15,20,0.95)', position:'sticky', top:0, zIndex:100 }}>
        <Link href="/dashboard" style={{ fontFamily:"'Syne', sans-serif", fontSize:'1.1rem', fontWeight:800, textDecoration:'none', color:'#e8edf2' }}>Remy<span style={{ color:'#f07a2e' }}>.</span></Link>
        <Link href="/dashboard" style={{ fontSize:'0.8rem', color:'#7a8fa4', textDecoration:'none' }}>Back</Link>
      </div>
      <div style={{ maxWidth:'720px', margin:'0 auto', padding:'32px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <h1 style={{ fontFamily:"'Syne', sans-serif", fontSize:'1.8rem', fontWeight:800, marginBottom:'4px' }}>Jobs</h1>
            <p style={{ color:'#7a8fa4', fontSize:'0.88rem', fontWeight:300 }}>Your field jobs</p>
          </div>
          <button onClick={() => setShowNew(true)} style={{ background:'#f07a2e', color:'#fff', border:'none', padding:'10px 20px', borderRadius:'8px', fontFamily:"'DM Sans', sans-serif", fontSize:'0.85rem', fontWeight:500, cursor:'pointer' }}>+ New Job</button>
        </div>

        <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
          {(['active', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 14px', borderRadius:'20px', border: filter === f ? 'none' : '1px solid rgba(255,255,255,0.08)', background: filter === f ? '#f07a2e' : 'transparent', color: filter === f ? '#fff' : '#7a8fa4', fontFamily:"'DM Sans', sans-serif", fontSize:'0.78rem', cursor:'pointer', fontWeight:500 }}>
              {f === 'active' ? 'Active' : 'All Jobs'}
            </button>
          ))}
        </div>

        {showNew && (
          <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'24px', marginBottom:'20px' }}>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, marginBottom:'16px' }}>New Job</div>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name *" style={{ width:'100%', background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'10px 14px', color:'#e8edf2', fontFamily:"'DM Sans', sans-serif", fontSize:'0.9rem', outline:'none', marginBottom:'10px' }} />
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" style={{ width:'100%', background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'10px 14px', color:'#e8edf2', fontFamily:"'DM Sans', sans-serif", fontSize:'0.9rem', outline:'none', marginBottom:'10px' }} />
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes about this job" rows={3} style={{ width:'100%', background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'10px 14px', color:'#e8edf2', fontFamily:"'DM Sans', sans-serif", fontSize:'0.9rem', outline:'none', resize:'vertical', marginBottom:'14px' }} />
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={createJob} disabled={saving} style={{ background:'#f07a2e', color:'#fff', border:'none', padding:'10px 20px', borderRadius:'8px', fontFamily:"'DM Sans', sans-serif", fontSize:'0.85rem', fontWeight:500, cursor:'pointer' }}>{saving ? 'Saving...' : 'Create Job'}</button>
              <button onClick={() => setShowNew(false)} style={{ background:'transparent', color:'#7a8fa4', border:'1px solid rgba(255,255,255,0.08)', padding:'10px 20px', borderRadius:'8px', fontFamily:"'DM Sans', sans-serif", fontSize:'0.85rem', cursor:'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ color:'#7a8fa4', textAlign:'center', padding:'40px' }}>Loading...</div>
        ) : jobs.length === 0 ? (
          <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'48px', textAlign:'center' }}>
            <div style={{ color:'#7a8fa4', fontSize:'0.9rem', fontWeight:300 }}>{filter === 'active' ? 'No active jobs.' : 'No jobs yet.'} Create one above.</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {jobs.map(job => (
              <div key={job.id} style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'16px 20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                  <div>
                    <div style={{ fontWeight:500, marginBottom:'3px' }}>{job.customer_name}</div>
                    {job.address && <div style={{ fontSize:'0.82rem', color:'#7a8fa4', fontWeight:300 }}>{job.address}</div>}
                    <div style={{ fontSize:'0.65rem', color: job.status === 'active' ? '#3daf76' : '#3d5268', marginTop:'4px', textTransform:'uppercase', letterSpacing:'0.08em' }}>{job.status}</div>
                  </div>
                  <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                    {job.status === 'active' && (
                      <Link href={`/dashboard/voice?jobId=${job.id}`} style={{ background:'rgba(240,122,46,0.1)', border:'1px solid rgba(240,122,46,0.2)', color:'#f07a2e', padding:'7px 14px', borderRadius:'6px', textDecoration:'none', fontSize:'0.75rem', fontWeight:500, whiteSpace:'nowrap' }}>Talk to Remy</Link>
                    )}
                    {job.status === 'active' && (
                      <button onClick={() => closeJob(job.id)} style={{ background:'transparent', border:'1px solid rgba(61,175,118,0.2)', color:'#3daf76', padding:'7px 12px', borderRadius:'6px', fontSize:'0.72rem', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", whiteSpace:'nowrap' }}>Close</button>
                    )}
                    <button onClick={() => deleteJob(job.id)} style={{ background:'transparent', border:'1px solid rgba(200,74,74,0.2)', color:'#c84a4a', padding:'7px 12px', borderRadius:'6px', fontSize:'0.72rem', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Delete</button>
                  </div>
                </div>
                {job.notes && <div style={{ fontSize:'0.78rem', color:'#3d5268', borderTop:'1px solid rgba(255,255,255,0.04)', paddingTop:'8px', marginTop:'4px' }}>{job.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
