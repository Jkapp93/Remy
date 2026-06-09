'use client';
import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useProfile } from '../../../lib/useProfile';

const JOB_TYPES = [
  { value: 'roofing', label: 'Roofing', color: '#f07a2e' },
  { value: 'fencing', label: 'Fencing', color: '#4a9fd4' },
  { value: 'hvac', label: 'HVAC / AC', color: '#3daf76' },
  { value: 'painting', label: 'Painting', color: '#9b59b6' },
  { value: 'plumbing', label: 'Plumbing', color: '#e74c3c' },
  { value: 'solar', label: 'Solar', color: '#f1c40f' },
  { value: 'restoration', label: 'Restoration', color: '#e67e22' },
  { value: 'other', label: 'Other', color: '#7a8fa4' },
];

const getJobType = (type: string) => JOB_TYPES.find(t => t.value === type) || JOB_TYPES[JOB_TYPES.length - 1];

export default function JobsPage() {
  const { isLoaded } = useUser();
  const { profile } = useProfile();
  const [jobs, setJobs] = useState<{id: string; customer_name: string; address: string; notes: string; status: string; job_type: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [jobType, setJobType] = useState('roofing');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const addressInputRef = useRef<HTMLInputElement>(null);
  const editAddressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const editAutocompleteRef = useRef<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editJob, setEditJob] = useState<{id: string; customer_name: string; address: string; notes: string; status: string; job_type: string} | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editType, setEditType] = useState('other');
  const [editSaving, setEditSaving] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => { if (!isLoaded) return; loadJobs(); }, [isLoaded, profile]);
  useEffect(() => { if (isLoaded) loadJobs(); }, [filter]);
  useEffect(() => { loadGoogleMaps(); }, []);
  useEffect(() => { if (showMap) { if (mapInstanceRef.current) plotJobs(); else { const iv = setInterval(() => { if ((window as any).google?.maps) { clearInterval(iv); initMap(); } }, 200); setTimeout(() => clearInterval(iv), 5000); } } }, [showMap]);
  useEffect(() => { if (showMap && mapInstanceRef.current) plotJobs(); }, [jobs]);
  useEffect(() => {
    if (showNew && (window as any).google?.maps?.places && addressInputRef.current) {
      initAutocomplete(addressInputRef.current, setAddress);
    }
  }, [showNew]);

  useEffect(() => {
    if (editJob && (window as any).google?.maps?.places && editAddressInputRef.current) {
      initAutocomplete(editAddressInputRef.current, setEditAddress);
    }
  }, [editJob]);

  const initAutocomplete = (input: HTMLInputElement, setter: (v: string) => void) => {
    const google = (window as any).google;
    const ac = new google.maps.places.Autocomplete(input, {
      types: ['establishment', 'geocode'],
      componentRestrictions: { country: 'us' },
    });
    // Bias to user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const circle = new google.maps.Circle({
          center: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          radius: 50000,
        });
        ac.setBounds(circle.getBounds());
      });
    }
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (place.formatted_address) setter(place.formatted_address);
      else if (place.name) setter(place.name);
    });
  };
  useEffect(() => { if (showMap && mapInstanceRef.current) plotJobs(); }, [jobs, showMap]);

  const loadGoogleMaps = () => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!key) return;
    if ((window as any).google?.maps) { initMap(); return; }
    const existing = document.querySelector('script[data-maps]');
    if (existing) { existing.addEventListener('load', initMap); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geocoding,places`;
    script.setAttribute('data-maps', 'true');
    script.onload = initMap;
    document.head.appendChild(script);
  };

  const initMap = () => {
    if (!mapRef.current) return;
    const google = (window as any).google;
    const map = new google.maps.Map(mapRef.current, {      zoom: 9,
      center: { lat: 26.5, lng: -81.8 },
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#0b0f14' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#0b0f14' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#7a8fa4' }] },
        { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1a2535' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#111820' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a2535' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060a0f' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      ],
    });
    mapInstanceRef.current = map;
    plotJobs();
  };

  const plotJobs = async () => {
    if (!mapInstanceRef.current) return;
    const google = (window as any).google;
    const geocoder = new google.maps.Geocoder();
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;
    for (const job of jobs) {
      if (!job.address) continue;
      const jt = getJobType(job.job_type);
      await new Promise<void>(resolve => {
        geocoder.geocode({ address: job.address }, (results: any, status: any) => {
          if (status === 'OK' && results[0]) {
            const pos = results[0].geometry.location;
            const marker = new google.maps.Marker({
              map: mapInstanceRef.current,
              position: pos,
              title: `${job.customer_name} (${jt.label})`,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: job.status === 'active' ? jt.color : '#3d5268',
                fillOpacity: 0.95,
                strokeColor: '#fff',
                strokeWeight: 2.5,
              },
            });
            const info = new google.maps.InfoWindow({
              content: `<div style="color:#111;padding:6px;font-family:sans-serif;min-width:160px">
                <div style="font-weight:700;margin-bottom:2px">${job.customer_name}</div>
                <div style="font-size:12px;color:#555;margin-bottom:4px">${job.address}</div>
                <div style="display:flex;gap:6px;align-items:center">
                  <span style="font-size:11px;background:${jt.color}22;color:${jt.color};padding:2px 8px;border-radius:4px;font-weight:600">${jt.label}</span>
                  <span style="font-size:11px;color:${job.status === 'active' ? '#3daf76' : '#999'};font-weight:600;text-transform:uppercase">${job.status}</span>
                </div>
              </div>`,
            });
            marker.addListener('click', () => info.open(mapInstanceRef.current, marker));
            markersRef.current.push(marker);
            bounds.extend(pos);
            hasPoints = true;
          }
          resolve();
        });
      });
    }
    if (hasPoints) {
      mapInstanceRef.current.fitBounds(bounds);
      // Don't zoom in closer than street level
      const listener = google.maps.event.addListener(mapInstanceRef.current, 'idle', () => {
        if (mapInstanceRef.current.getZoom() > 14) mapInstanceRef.current.setZoom(14);
        google.maps.event.removeListener(listener);
      });
    }
  };

  const loadJobs = async () => {
    setLoading(true);
    let query = supabase.from('jobs').select('*').order('created_at', { ascending: false });
    if (profile?.company_id) query = query.eq('company_id', profile.company_id);
    const { data } = filter === 'active' ? await query.eq('status', 'active') : await query;
    setJobs(data || []);
    setLoading(false);
  };

  const createJob = async () => {
    if (!customerName.trim()) return;
    setSaving(true);
    await supabase.from('jobs').insert({ 
      customer_name: customerName, 
      address, 
      notes, 
      status: 'active', 
      job_type: jobType,
      company_id: profile?.company_id || null,
    });
    setCustomerName(''); setAddress(''); setNotes(''); setJobType('roofing');
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

  const openEdit = (job: {id: string; customer_name: string; address: string; notes: string; status: string; job_type: string}) => {
    setEditJob(job);
    setEditName(job.customer_name);
    setEditAddress(job.address);
    setEditNotes(job.notes);
    setEditType(job.job_type || 'other');
  };

  const saveEdit = async () => {
    if (!editJob) return;
    setEditSaving(true);
    await supabase.from('jobs').update({
      customer_name: editName,
      address: editAddress,
      notes: editNotes,
      job_type: editType,
    }).eq('id', editJob.id);
    setEditJob(null);
    setEditSaving(false);
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
        .type-select { width:100%; background:#0b0f14; border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px 14px; color:#e8edf2; font-family:'DM Sans',sans-serif; font-size:0.9rem; outline:none; margin-bottom:10px; cursor:pointer; }
        .legend-item { display:flex; align-items:center; gap:6px; font-size:0.72rem; color:#7a8fa4; }
        .legend-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
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

      {editJob && (
        <div className="modal-overlay" onClick={() => setEditJob(null)}>
          <div className="modal" style={{ maxWidth:'480px' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'1.1rem', marginBottom:'16px' }}>Edit Job</div>
            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Customer name *" style={{ width:'100%', background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'10px 14px', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.9rem', outline:'none', marginBottom:'10px' }} />
            <input value={editAddress} ref={editAddressInputRef} onChange={e => setEditAddress(e.target.value)} placeholder="Address" style={{ width:'100%', background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'10px 14px', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.9rem', outline:'none', marginBottom:'10px' }} />
            <select value={editType} onChange={e => setEditType(e.target.value)} className="type-select">
              {JOB_TYPES.map(jt => (
                <option key={jt.value} value={jt.value}>{jt.label}</option>
              ))}
            </select>
            <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notes" rows={3} style={{ width:'100%', background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'10px 14px', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.9rem', outline:'none', resize:'vertical', marginBottom:'14px' }} />
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={saveEdit} disabled={editSaving} style={{ flex:1, padding:'11px', background:'#f07a2e', border:'none', borderRadius:'8px', color:'#fff', fontFamily:"'DM Sans',sans-serif", fontSize:'0.88rem', fontWeight:500, cursor:'pointer' }}>{editSaving ? 'Saving...' : 'Save Changes'}</button>
              <button onClick={() => setEditJob(null)} style={{ flex:1, padding:'11px', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', color:'#7a8fa4', fontFamily:"'DM Sans',sans-serif", fontSize:'0.88rem', cursor:'pointer' }}>Cancel</button>
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
            <button onClick={() => setShowMap(!showMap)} style={{ background: showMap ? 'rgba(74,159,212,0.1)' : 'transparent', border: showMap ? '1px solid rgba(74,159,212,0.3)' : '1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'9px 16px', color: showMap ? '#4a9fd4' : '#7a8fa4', fontFamily:"'DM Sans',sans-serif", fontSize:'0.82rem', cursor:'pointer', fontWeight:500 }}>
              {showMap ? 'List View' : 'Map View'}
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
          <div style={{ marginBottom:'16px' }}>
            <div style={{ borderRadius:'12px', overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)', height:'320px', background:'#111820', marginBottom:'10px' }}>
              <div ref={mapRef} style={{ width:'100%', height:'100%' }} />
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'10px', padding:'0 4px' }}>
              {JOB_TYPES.map(jt => (
                <div key={jt.value} className="legend-item">
                  <div className="legend-dot" style={{ background: jt.color }} />
                  {jt.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {showNew && (
          <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'24px', marginBottom:'20px' }}>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, marginBottom:'16px' }}>New Job</div>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name *" style={{ width:'100%', background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'10px 14px', color:'#e8edf2', fontFamily:"'DM Sans', sans-serif", fontSize:'0.9rem', outline:'none', marginBottom:'10px' }} />
            <input value={address} ref={addressInputRef} onChange={e => setAddress(e.target.value)} placeholder="Address (used for GPS auto-brief and map)" style={{ width:'100%', background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'10px 14px', color:'#e8edf2', fontFamily:"'DM Sans', sans-serif", fontSize:'0.9rem', outline:'none', marginBottom:'10px' }} />
            <select value={jobType} onChange={e => setJobType(e.target.value)} className="type-select">
              {JOB_TYPES.map(jt => (
                <option key={jt.value} value={jt.value}>{jt.label}</option>
              ))}
            </select>
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
            {jobs.map(job => {
              const jt = getJobType(job.job_type);
              return (
                <div key={job.id} style={{ background:'#111820', border:`1px solid ${job.status === 'active' ? jt.color + '33' : 'rgba(255,255,255,0.08)'}`, borderRadius:'12px', padding:'16px 20px', cursor:'pointer', transition:'border-color 0.2s' }} onClick={() => openEdit(job)}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                        <div style={{ width:'10px', height:'10px', borderRadius:'50%', background: jt.color, flexShrink:0 }} />
                        <div style={{ fontWeight:500 }}>{job.customer_name}</div>
                        <span style={{ fontSize:'0.62rem', fontWeight:600, color: jt.color, background: jt.color + '22', padding:'2px 8px', borderRadius:'4px' }}>{jt.label}</span>
                      </div>
                      {job.address && <div style={{ fontSize:'0.82rem', color:'#7a8fa4', fontWeight:300, marginBottom:'3px' }}>{job.address}</div>}
                      {job.notes && <div style={{ fontSize:'0.75rem', color:'#3d5268', marginTop:'4px' }}>{job.notes}</div>}
                      <div style={{ fontSize:'0.62rem', color: job.status === 'active' ? '#3daf76' : '#3d5268', marginTop:'6px', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600 }}>{job.status}</div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }} onClick={e => e.stopPropagation()}>
                      {job.status === 'active' && (
                        <Link href={"/dashboard/voice?jobId=${job.id}"} className="action-btn" style={{ background:'rgba(240,122,46,0.1)', borderColor:'rgba(240,122,46,0.2)', color:'#f07a2e', textDecoration:'none', display:'inline-block' }}>Talk to Remy</Link>
                      )}
                        <Link href={'/dashboard/proposal?jobId=' + job.id + '&jobName=' + encodeURIComponent(job.customer_name)} className="action-btn" style={{ background:'rgba(155,89,182,0.1)', borderColor:'rgba(155,89,182,0.2)', color:'#9b59b6', textDecoration:'none', display:'inline-block' }}>Proposal</Link>
                      )}
                      {job.status === 'active' && (
                        <Link href={'/dashboard/timeline?jobId=' + job.id + '&jobName=' + encodeURIComponent(job.customer_name)} className="action-btn" style={{ background:'rgba(74,159,212,0.1)', borderColor:'rgba(74,159,212,0.2)', color:'#4a9fd4', textDecoration:'none', display:'inline-block' }}>Timeline</Link>

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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}