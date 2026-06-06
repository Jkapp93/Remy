'use client';
import { useState, useEffect, useRef } from 'react';
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
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!isLoaded) return; loadJobs(); }, [isLoaded]);
  useEffect(() => { if (isLoaded) loadJobs(); }, [filter]);
  useEffect(() => { if (showMap && jobs.length > 0 && mapRef.current) initMap(); }, [showMap, jobs]);

  const loadJobs = async () => {
    setLoading(true);
    const query = supabase.from('jobs').select('*').order('created_at', { ascending: false });
    const { data } = filter === 'active' ? await query.eq('status', 'active') : await query;
    setJobs(data || []);
    setLoading(false);
  };

  const initMap = async () => {
    if (!mapRef.current) return;
    if (typeof window === 'undefined' || !(window as any).google) {
      if (mapRef.current) {
        mapRef.current.innerHTML = `<div style="color:#3d5268;font-size:0.85rem;text-align:center;padding:80px 20px">Map requires Google Maps API key.<br/><span style="font-size:0.75rem">Add NEXT_PUBLIC_GOOGLE_MAPS_KEY to Vercel env vars.</span></div>`;
      }
      return;
    }
    const google = (window as any).google;
    const map = new google.maps.Map(mapRef.current, {
      zoom: 10,
      center: { lat: 26.1420, lng: -81.7948 },
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#0b0f14' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#7a8fa4' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#111820' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060a0f' }] },
      ],
    });
    const geocoder = new google.maps.Geocoder();
    for (const job of jobs) {
      if (!job.address) continue;
      geocoder.geocode({ address: job.address }, (results: any, status: any) => {
        if (status === 'OK' && results[0]) {
          const marker = new google.maps.Marker({
            map, position: results[0].geometry.location, title: job.customer_name,
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#f07a2e', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
          });
          const info = new google.maps.InfoWindow({ content: `<div style="color:#000;padding:4px"><strong>${job.customer_name}</strong><br/>${job.address}</div>` });
          marker.addListener('click', () => info.open(map, marker));
        }
      });
    }
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
    loadJobs();
  };

  const deleteJob = async (id: string) => {
    await supabase.from('jobs').delete().eq('id', id);
    setConfirmDelete(null); loadJobs();
  };

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:200; }
        .modal { background:#111820; border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:28px; max-width:400px; width:90%; }
      `}</style>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'1.1rem', marginBottom:'10px' }}>Delete this job?</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.88rem', fontWeight:300, marginBottom:'24px' }}>This cannot be undone. The job and all related data will be permanently removed.</div>
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
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => setShowMap(!showMap)} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'9px 16px', color:'#7a8fa4', fontFamily:"'DM Sans',sans-serif", fontSize:'0.82rem', cursor:'pointer' }}>
              {showMap ? 'List' : 'Map'}
            </button>
            <button onClick={() => setShowNew(true)} style={{ background:'#f07a2e', color:'#fff', border:'none', padding:'10px 20px', borderRadius:'8px', fontFamily:"'DM Sans', sans-serif", fontSize:'0.85rem', fontWeight:500, cursor:'pointer' }}>+ New Job</button>
          </div>
        </div>

        <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
          {(['active', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 14px', borderRadius:'20px', border: filter === f ? 'none' : '1px solid rgba(255,255,255,0.08)', background: filter === f ? '#f07a2e' : 'transparent', color: filter === f ? '#fff' : '#7a8fa4', fontFamily:"'DM Sans', sans-serif", fontSize:'0.78rem', cursor:'pointer', fontWeight:500 }}>
              {f === 'active' ? 'Active' : 'All Jobs'}
            </button>
          ))}
        </div>

        {showMap && (
          <div style={{ marginBottom:'20px', borderRadius:'12px', overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)', height:'300px', background:'#111820' }}>
            <div ref={mapRef} style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }} />
          </div>
        )}

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
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', cursor:'pointer' }} onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}>
                  <div>
                    <div style={{ fontWeight:500, marginBottom:'3px' }}>{job.customer_name}</div>
                    {job.address && <div style={{ fontSize:'0.82rem', color:'#7a8fa4', fontWeight:300 }}>{job.address}</div>}
                    <div style={{ fontSize:'0.65rem', color: job.status === 'active' ? '#3daf76' : '#3d5268', marginTop:'4px', textTransform:'uppercase', letterSpacing:'0.08em' }}>{job.status}</div>
                  </div>
                  <div style={{ fontSize:'0.72rem', color:'#3d5268', marginLeft:'8px' }}>{expandedJob === job.id ? 'v' : '>'}</div>
                </div>
                {expandedJob === job.id && (
                  <div style={{ marginTop:'14px', borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:'14px' }}>
                    {job.notes && <div style={{ fontSize:'0.82rem', color:'#7a8fa4', fontWeight:300, marginBottom:'14px', lineHeight:1.6 }}>{job.notes}</div>}
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                      {job.status === 'active' && (
                        <Link href={`/dashboard/voice?jobId=${job.id}`} style={{ background:'rgba(240,122,46,0.1)', border:'1px solid rgba(240,122,46,0.2)', color:'#f07a2e', padding:'7px 14px', borderRadius:'6px', textDecoration:'none', fontSize:'0.75rem', fontWeight:500 }}>Talk to Remy</Link>
                      )}
                      {job.status === 'active' && (
                        <button onClick={() => closeJob(job.id)} style={{ background:'transparent', border:'1px solid rgba(61,175,118,0.2)', color:'#3daf76', padding:'7px 12px', borderRadius:'6px', fontSize:'0.72rem', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Close</button>
                      )}
                      {job.status === 'closed' && (
                        <button onClick={() => reopenJob(job.id)} style={{ background:'transparent', border:'1px solid rgba(240,122,46,0.2)', color:'#f07a2e', padding:'7px 12px', borderRadius:'6px', fontSize:'0.72rem', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Reopen</button>
                      )}
                      <button onClick={() => setConfirmDelete(job.id)} style={{ background:'transparent', border:'1px solid rgba(200,74,74,0.2)', color:'#c84a4a', padding:'7px 12px', borderRadius:'6px', fontSize:'0.72rem', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
