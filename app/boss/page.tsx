'use client';
import { useState, useEffect } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

type Rep = { id: string; name: string; email: string; last_active: string; job_count: number; conversation_count: number };
type Job = { id: string; customer_name: string; address: string; status: string; created_at: string };
type Conversation = { id: string; job_id: string; rep_id: string; summary: string; created_at: string };

export default function BossDashboard() {
  const { user, isLoaded } = useUser();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [doctrine, setDoctrine] = useState<{id: string; content: string; type: string; created_at: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'conversations' | 'doctrine'>('overview');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    loadAll();
  }, [isLoaded]);

  const loadAll = async () => {
    setLoading(true);
    const [jobData, convData, docData] = await Promise.all([
      supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('conversations').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('doctrine').select('*').eq('active', true).order('created_at', { ascending: false }),
    ]);
    setJobs(jobData.data || []);
    setConversations(convData.data || []);
    setDoctrine(docData.data || []);
    setLoading(false);
  };

  const broadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setBroadcasting(true);
    await supabase.from('doctrine').insert({ content: `[BROADCAST] ${broadcastMsg}`, type: 'broadcast', active: true });
    setBroadcastMsg('');
    setBroadcasting(false);
    loadAll();
  };

  const removeDoc = async (id: string) => {
    await supabase.from('doctrine').update({ active: false }).eq('id', id);
    loadAll();
  };

  const activeJobs = jobs.filter(j => j.status === 'active');
  const closedJobs = jobs.filter(j => j.status === 'closed');

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .tab-btn { padding:8px 18px; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:transparent; color:#7a8fa4; font-family:'DM Sans',sans-serif; font-size:0.82rem; cursor:pointer; font-weight:500; transition:all 0.2s; }
        .tab-btn.active { background:#f07a2e; border-color:#f07a2e; color:#fff; }
        .stat-card { background:#111820; border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:20px 24px; }
        .data-row { padding:14px 0; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .data-row:last-child { border-bottom:none; }
        .badge { font-size:0.62rem; font-weight:600; letterSpacing:0.08em; text-transform:uppercase; padding:3px 8px; border-radius:4px; }
        .badge-active { background:rgba(61,175,118,0.1); color:#3daf76; }
        .badge-closed { background:rgba(255,255,255,0.04); color:#3d5268; }
        .badge-broadcast { background:rgba(61,175,118,0.1); color:#3daf76; }
        .badge-pdf { background:rgba(74,159,212,0.1); color:#4a9fd4; }
        .badge-text { background:rgba(240,122,46,0.1); color:#f07a2e; }
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 28px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(11,15,20,0.95)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <Link href="/dashboard" style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.2rem', fontWeight:800, textDecoration:'none', color:'#e8edf2' }}>
            Remy<span style={{ color:'#f07a2e' }}>.</span>
          </Link>
          <span style={{ fontSize:'0.7rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#f07a2e', background:'rgba(240,122,46,0.1)', padding:'3px 10px', borderRadius:'4px' }}>Boss</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <button onClick={loadAll} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', padding:'7px 14px', color:'#7a8fa4', fontFamily:"'DM Sans',sans-serif", fontSize:'0.78rem', cursor:'pointer' }}>Refresh</button>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'32px 24px' }}>
        {/* Welcome */}
        <div style={{ marginBottom:'28px' }}>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.8rem', fontWeight:800, marginBottom:'4px' }}>
            Command Center
          </h1>
          <p style={{ color:'#7a8fa4', fontSize:'0.88rem', fontWeight:300 }}>
            {user?.firstName ? `Welcome back, ${user.firstName}.` : 'Welcome back.'} Here is what is happening in the field.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'12px', marginBottom:'28px' }}>
          {[
            { label: 'Active Jobs', value: activeJobs.length, color: '#3daf76' },
            { label: 'Closed Jobs', value: closedJobs.length, color: '#3d5268' },
            { label: 'Conversations', value: conversations.length, color: '#f07a2e' },
            { label: 'Doctrine Entries', value: doctrine.length, color: '#4a9fd4' },
          ].map(stat => (
            <div key={stat.label} className="stat-card">
              <div style={{ fontSize:'2rem', fontWeight:800, fontFamily:"'Syne',sans-serif", color: stat.color, marginBottom:'4px' }}>{stat.value}</div>
              <div style={{ fontSize:'0.78rem', color:'#7a8fa4', fontWeight:300 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Broadcast */}
        <div style={{ background:'rgba(240,122,46,0.04)', border:'1px solid rgba(240,122,46,0.2)', borderRadius:'12px', padding:'20px', marginBottom:'28px' }}>
          <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#f07a2e', marginBottom:'12px' }}>Quick Broadcast to All Reps</div>
          <div style={{ display:'flex', gap:'10px' }}>
            <input
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') broadcast(); }}
              placeholder="e.g. We have a 10% spring discount this week â€” mention it to every customer"
              style={{ flex:1, background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'11px 14px', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.88rem', outline:'none' }}
            />
            <button onClick={broadcast} disabled={broadcasting || !broadcastMsg.trim()} style={{ padding:'11px 22px', background:'#f07a2e', border:'none', borderRadius:'8px', color:'#fff', fontFamily:"'DM Sans',sans-serif", fontSize:'0.85rem', fontWeight:500, cursor:'pointer', opacity: broadcasting || !broadcastMsg.trim() ? 0.5 : 1, whiteSpace:'nowrap' }}>
              {broadcasting ? 'Sending...' : 'Broadcast'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
          {(['overview', 'jobs', 'conversations', 'doctrine'] as const).map(t => (
            <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color:'#3d5268', textAlign:'center', padding:'48px', fontSize:'0.88rem' }}>Loading...</div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                {/* Recent Jobs */}
                <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px' }}>
                  <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>Recent Jobs</div>
                  {jobs.slice(0, 6).map(job => (
                    <div key={job.id} className="data-row">
                      <div>
                        <div style={{ fontSize:'0.88rem', fontWeight:500 }}>{job.customer_name}</div>
                        {job.address && <div style={{ fontSize:'0.72rem', color:'#3d5268', marginTop:'2px' }}>{job.address}</div>}
                      </div>
                      <span className={`badge ${job.status === 'active' ? 'badge-active' : 'badge-closed'}`}>{job.status}</span>
                    </div>
                  ))}
                  {jobs.length === 0 && <div style={{ color:'#3d5268', fontSize:'0.82rem' }}>No jobs yet.</div>}
                </div>

                {/* Recent Conversations */}
                <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px' }}>
                  <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>Recent Conversations</div>
                  {conversations.slice(0, 6).map(conv => (
                    <div key={conv.id} className="data-row">
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'0.82rem', color:'#7a8fa4', fontWeight:300, lineHeight:1.5 }}>
                          {conv.summary ? conv.summary.slice(0, 100) + (conv.summary.length > 100 ? '...' : '') : 'No summary'}
                        </div>
                        <div style={{ fontSize:'0.62rem', color:'#2d3f52', marginTop:'4px' }}>
                          {new Date(conv.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                  {conversations.length === 0 && <div style={{ color:'#3d5268', fontSize:'0.82rem' }}>No conversations yet.</div>}
                </div>
              </div>
            )}

            {activeTab === 'jobs' && (
              <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px' }}>
                <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>All Jobs ({jobs.length})</div>
                {jobs.map(job => (
                  <div key={job.id} className="data-row">
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:500, marginBottom:'3px' }}>{job.customer_name}</div>
                      {job.address && <div style={{ fontSize:'0.78rem', color:'#3d5268' }}>{job.address}</div>}
                      <div style={{ fontSize:'0.62rem', color:'#2d3f52', marginTop:'3px' }}>
                        {new Date(job.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                      </div>
                    </div>
                    <span className={`badge ${job.status === 'active' ? 'badge-active' : 'badge-closed'}`}>{job.status}</span>
                  </div>
                ))}
                {jobs.length === 0 && <div style={{ color:'#3d5268', fontSize:'0.82rem' }}>No jobs yet.</div>}
              </div>
            )}

            {activeTab === 'conversations' && (
              <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px' }}>
                <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>Conversation History ({conversations.length})</div>
                {conversations.map(conv => (
                  <div key={conv.id} className="data-row" style={{ flexDirection:'column', alignItems:'flex-start', gap:'6px' }}>
                    <div style={{ fontSize:'0.85rem', color:'#e8edf2', lineHeight:1.6 }}>
                      {conv.summary || 'No summary available'}
                    </div>
                    <div style={{ fontSize:'0.62rem', color:'#2d3f52' }}>
                      {new Date(conv.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}
                      {conv.job_id && ` Â· Job ID: ${conv.job_id.slice(0, 8)}...`}
                    </div>
                  </div>
                ))}
                {conversations.length === 0 && <div style={{ color:'#3d5268', fontSize:'0.82rem' }}>No conversations logged yet. Sessions save automatically after 4+ messages.</div>}
              </div>
            )}

            {activeTab === 'doctrine' && (
              <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                  <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268' }}>Active Doctrine ({doctrine.length})</div>
                  <Link href="/dashboard/doctrine" style={{ fontSize:'0.78rem', color:'#f07a2e', textDecoration:'none', fontWeight:500 }}>Manage Doctrine</Link>
                </div>
                {doctrine.map(doc => (
                  <div key={doc.id} className="data-row">
                    <div style={{ flex:1 }}>
                      <span className={`badge ${doc.type === 'broadcast' ? 'badge-broadcast' : doc.type === 'pdf' ? 'badge-pdf' : 'badge-text'}`} style={{ marginBottom:'6px', display:'inline-block' }}>
                        {doc.type}
                      </span>
                      <div style={{ fontSize:'0.82rem', color:'#7a8fa4', fontWeight:300, lineHeight:1.5 }}>
                        {doc.content.slice(0, 120)}{doc.content.length > 120 ? '...' : ''}
                      </div>
                    </div>
                    <button onClick={() => removeDoc(doc.id)} style={{ background:'transparent', border:'none', color:'#2d3f52', cursor:'pointer', fontSize:'0.9rem', flexShrink:0, padding:'4px 8px' }}>x</button>
                  </div>
                ))}
                {doctrine.length === 0 && <div style={{ color:'#3d5268', fontSize:'0.82rem' }}>No doctrine yet. <Link href="/dashboard/doctrine" style={{ color:'#f07a2e', textDecoration:'none' }}>Add some</Link></div>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
