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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => { if (!isLoaded) return; loadJobs(); }, [isLoaded]);
  useEffect(() => { if (isLoaded) loadJobs(); }, [filter]);

  const loadJobs = async () => {
    setLoading(true);
    const query = supabase.from('jobs').select('*').order('created_at', { ascending: false });
    const { data } = filter === 'active' ? await query.eq('status', 'active') : await query;
    setJobs(data || []);
    setLoading(false);
  };

  const createJob = async () => {
    if (!customerName.trim()) return;
    setSaving(true);
    await supabase.from('jobs').insert({ customer_name: customerName, address, notes, status: 'active' });
    setCustomerName(''); setAddress(''); setNotes('');
    setShowNew(false); setSaving(false); loadJobs();
  };

  const closeJob = async (id: string) => {
    await supabase.from('jobs').update({ status: 'closed' }).eq('id', id);
    loadJobs();
  };

  const reopenJob = async (id: string) => {
    await supabase.from('jobs').update({ status: 'active' }).eq('id', id);
    setFilter('active');
    loadJobs();
  };

  const deleteJob = async (id: string) => {
    await supabase.from('jobs').delete().eq('id', id);
    setConfirmDelete(null);
    loadJobs();
  };

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:200; }
        .modal { background:#111820; border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:28px; max-width:400px; width:90%; }
        .action-btn { padding:7px 14px; border-radius:6px; font-family:'DM Sans',sans-serif; font-size:0.75rem; font-weight:500; cursor:pointer; border:1px solid; white-space:nowrap; }
      `}</style>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'1.1rem', marginBottom:'10px' }}>Delete this job?</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.88rem', fontWeight:300, marginBottom:'24px' }}>This cannot be undone.</div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={() => deleteJob(confirmDelete)} style={{ flex:1, padding:'11px', background:'rgba(200,74,74,0.15)', border:'1px solid rgba(200,74,74,0.3)', borderRadius:'8px', color:'#c84a4a', fontFamily:"'DM Sans',sans-serif", fontSize:'0.88rem', fontWeight:500, cursor:'pointer' }}>Delete</button>
              <button onClick={() => setConfirmDelete(null)} style={{ flex:1, padding:'11px', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', color:'#7a8fa4', fontFamily:"'DM Sans',sans-serif", fontSize:'0.88rem', cursor:'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

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
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address (used for GPS auto-brief)" style={{ width:'100%', background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'10px 14px', color:'#e8edf2', fontFamily:"'DM Sans', sans-serif", fontSize:'0.9rem', outline:'none', marginBottom:'10px' }} />
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
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:500, marginBottom:'3px' }}>{job.customer_name}</div>
                    {job.address && <div style={{ fontSize:'0.82rem', color:'#7a8fa4', fontWeight:300, marginBottom:'3px' }}>{job.address}</div>}
                    {job.notes && <div style={{ fontSize:'0.75rem', color:'#3d5268', marginTop:'4px' }}>{job.notes}</div>}
                    <div style={{ fontSize:'0.62rem', color: job.status === 'active' ? '#3daf76' : '#3d5268', marginTop:'6px', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600 }}>{job.status}</div>
                  </div>
                  <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
                    {job.status === 'active' && (
                      <Link href={`/dashboard/voice?jobId=${job.id}`} className="action-btn" style={{ background:'rgba(240,122,46,0.1)', borderColor:'rgba(240,122,46,0.2)', color:'#f07a2e', textDecoration:'none', display:'inline-block' }}>Talk to Remy</Link>
                    )}
                    {job.status === 'active' && (
                      <button onClick={() => closeJob(job.id)} className="action-btn" style={{ background:'transparent', borderColor:'rgba(61,175,118,0.2)', color:'#3daf76' }}>Close</button>
                    )}
                    {job.status === 'closed' && (
                      <button onClick={() => reopenJob(job.id)} className="action-btn" style={{ background:'transparent', borderColor:'rgba(240,122,46,0.2)', color:'#f07a2e' }}>Reopen</button>
                    )}
                    <button onClick={() => setConfirmDelete(job.id)} className="action-btn" style={{ background:'transparent', borderColor:'rgba(200,74,74,0.2)', color:'#c84a4a' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
