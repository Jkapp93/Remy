'use client';
import { useState, useEffect } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import Leaderboard from '../../components/Leaderboard';

type Job = { id: string; customer_name: string; address: string; status: string; job_type: string; created_at: string };
type Conversation = { id: string; summary: string; created_at: string; rep_id: string };
type Doctrine = { id: string; content: string; type: string; created_at: string };
type Profile = { id: string; clerk_id: string; full_name: string; email: string; role: string };
type Invite = { id: string; email: string; role: string; token: string; accepted: boolean };
type Company = { id: string; name: string; plan: string };

const JOB_TYPE_COLORS: Record<string, string> = {
  roofing: '#f07a2e', fencing: '#4a9fd4', hvac: '#3daf76',
  painting: '#9b59b6', plumbing: '#e74c3c', solar: '#f1c40f',
  restoration: '#e67e22', other: '#7a8fa4',
};

export default function BossDashboard() {
  const { user, isLoaded } = useUser();
  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [doctrine, setDoctrine] = useState<Doctrine[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'conversations' | 'doctrine' | 'team'>('overview');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'rep' | 'owner'>('rep');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalQuotes, setTotalQuotes] = useState(0);

  useEffect(() => {
    if (!isLoaded || !user) return;
    loadAll();
  }, [isLoaded, user]);

  const loadAll = async () => {
    setLoading(true);
    const res = await fetch(`/api/boss-data?clerkId=${user!.id}`);
    const data = await res.json();

    if (data.company) setCompany(data.company);
    setJobs(data.jobs || []);
    setDoctrine(data.doctrine || []);
    setProfiles(data.profiles || []);
    setInvites(data.invites || []);

    if (data.company?.id) {
      const [convRes, notesRes] = await Promise.all([
        fetch(`/api/conversations?companyId=${data.company.id}`),
        fetch(`/api/notes?companyId=${data.company.id}`),
      ]);
      const convData = await convRes.json();
      const notesData = await notesRes.json();
      setConversations(convData.conversations || []);

      let revenue = 0;
      let quotes = 0;
      for (const n of (notesData.notes || [])) {
        if (n.quote_amount) {
          const num = parseFloat(String(n.quote_amount).replace(/[$,\s]/g, ''));
          if (!isNaN(num) && num > 0) { revenue += num; quotes++; }
        }
      }
      setTotalRevenue(revenue);
      setTotalQuotes(quotes);
    }

    setLoading(false);
  };

  const broadcast = async () => {
    if (!broadcastMsg.trim() || !company) return;
    setBroadcasting(true);
    await fetch('/api/doctrine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `[BROADCAST] ${broadcastMsg}`, type: 'broadcast', company_id: company.id }),
    });
    setBroadcastMsg('');
    setBroadcasting(false);
    loadAll();
  };

  const removeDoc = async (id: string) => {
    await fetch('/api/doctrine', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: false }),
    });
    loadAll();
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim() || !company) return;
    setInviting(true);
    setInviteResult('');
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, companyId: company.id, companyName: company.name, role: inviteRole }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteResult(`Invite sent. Code: ${data.token}`);
        setInviteEmail('');
        loadAll();
      } else setInviteResult('Failed to send invite.');
    } catch { setInviteResult('Failed to send invite.'); }
    setInviting(false);
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
        .data-row { padding:14px 0; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
        .data-row:last-child { border-bottom:none; }
        .badge { font-size:0.62rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; padding:3px 8px; border-radius:4px; }
        .job-row { padding:14px 0; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center; gap:12px; cursor:pointer; transition:background 0.15s; border-radius:6px; }
        .job-row:hover { background:rgba(255,255,255,0.02); }
        .job-row:last-child { border-bottom:none; }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:200; }
        .modal { background:#111820; border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:28px; max-width:500px; width:90%; max-height:80vh; overflow-y:auto; }
      `}</style>

      {selectedJob && (
        <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
                  <div style={{ width:'10px', height:'10px', borderRadius:'50%', background: JOB_TYPE_COLORS[selectedJob.job_type] || '#f07a2e' }} />
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'1.2rem' }}>{selectedJob.customer_name}</div>
                </div>
                <span className="badge" style={{ background: (JOB_TYPE_COLORS[selectedJob.job_type] || '#f07a2e') + '22', color: JOB_TYPE_COLORS[selectedJob.job_type] || '#f07a2e' }}>{selectedJob.job_type || 'other'}</span>
              </div>
              <button onClick={() => setSelectedJob(null)} style={{ background:'transparent', border:'none', color:'#3d5268', cursor:'pointer', fontSize:'1.2rem' }}>x</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {selectedJob.address && (
                <div>
                  <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#3d5268', marginBottom:'4px' }}>Address</div>
                  <div style={{ fontSize:'0.9rem', color:'#7a8fa4' }}>{selectedJob.address}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#3d5268', marginBottom:'4px' }}>Status</div>
                <span className="badge" style={{ background: selectedJob.status === 'active' ? 'rgba(61,175,118,0.1)' : 'rgba(255,255,255,0.04)', color: selectedJob.status === 'active' ? '#3daf76' : '#3d5268' }}>{selectedJob.status}</span>
              </div>
              <div>
                <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#3d5268', marginBottom:'4px' }}>Created</div>
                <div style={{ fontSize:'0.9rem', color:'#7a8fa4' }}>{new Date(selectedJob.created_at).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}</div>
              </div>
              {conversations.filter(c => c.rep_id).length > 0 && (
                <div>
                  <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#3d5268', marginBottom:'8px' }}>Remy Sessions</div>
                  {conversations.slice(0, 3).map(c => (
                    <div key={c.id} style={{ fontSize:'0.82rem', color:'#7a8fa4', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                      {c.summary || 'Session logged'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 28px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(11,15,20,0.95)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <Link href="/dashboard" style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.2rem', fontWeight:800, textDecoration:'none', color:'#e8edf2' }}>
            Remy<span style={{ color:'#f07a2e' }}>.</span>
          </Link>
          <span style={{ fontSize:'0.7rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#f07a2e', background:'rgba(240,122,46,0.1)', padding:'3px 10px', borderRadius:'4px' }}>Boss</span>
          {company && <span style={{ fontSize:'0.78rem', color:'#7a8fa4' }}>{company.name}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <button onClick={loadAll} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', padding:'7px 14px', color:'#7a8fa4', fontFamily:"'DM Sans',sans-serif", fontSize:'0.78rem', cursor:'pointer' }}>Refresh</button>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'32px 24px' }}>
        <div style={{ marginBottom:'28px' }}>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.8rem', fontWeight:800, marginBottom:'4px' }}>Command Center</h1>
          <p style={{ color:'#7a8fa4', fontSize:'0.88rem', fontWeight:300 }}>
            {user?.firstName ? `Welcome back, ${user.firstName}.` : 'Welcome back.'} Here is what is happening in the field.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'12px', marginBottom:'28px' }}>
          {[
            { label: 'Pipeline', value: `$${totalRevenue >= 1000 ? (totalRevenue / 1000).toFixed(0) + 'k' : totalRevenue.toLocaleString()}`, color: '#3daf76' },
          { label: 'Active Jobs', value: activeJobs.length, color: '#f07a2e' },
            { label: 'Closed Jobs', value: closedJobs.length, color: '#3d5268' },
            { label: 'Conversations', value: conversations.length, color: '#f07a2e' },
            { label: 'Team Members', value: profiles.length, color: '#4a9fd4' },
            { label: 'Doctrine', value: doctrine.length, color: '#9b59b6' },
          ].map(stat => (
            <div key={stat.label} className="stat-card">
              <div style={{ fontSize:'2rem', fontWeight:800, fontFamily:"'Syne',sans-serif", color: stat.color, marginBottom:'4px' }}>{stat.value}</div>
              <div style={{ fontSize:'0.78rem', color:'#7a8fa4', fontWeight:300 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background:'rgba(240,122,46,0.04)', border:'1px solid rgba(240,122,46,0.2)', borderRadius:'12px', padding:'20px', marginBottom:'28px' }}>
          <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#f07a2e', marginBottom:'12px' }}>Quick Broadcast to All Reps</div>
          <div style={{ display:'flex', gap:'10px' }}>
            <input value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') broadcast(); }} placeholder="e.g. We have a 10% spring discount this week" style={{ flex:1, background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'11px 14px', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.88rem', outline:'none' }} />
            <button onClick={broadcast} disabled={broadcasting || !broadcastMsg.trim()} style={{ padding:'11px 22px', background:'#f07a2e', border:'none', borderRadius:'8px', color:'#fff', fontFamily:"'DM Sans',sans-serif", fontSize:'0.85rem', fontWeight:500, cursor:'pointer', opacity: broadcasting || !broadcastMsg.trim() ? 0.5 : 1 }}>
              {broadcasting ? 'Sending...' : 'Broadcast'}
            </button>
          </div>
        </div>
        <Link href="/dashboard/broadcasts" style={{ fontSize:'0.75rem', color:'#3d5268', textDecoration:'none', display:'block', marginBottom:'16px' }}>View Broadcast History</Link>
        <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
          {(['overview', 'jobs', 'conversations', 'doctrine', 'team'] as const).map(t => (
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
                <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px' }}>
                  <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>Recent Jobs <span style={{ color:'#2d3f52', fontWeight:300, letterSpacing:0 }}>(click to view)</span></div>
                  {jobs.slice(0, 6).map(job => {
                    const color = JOB_TYPE_COLORS[job.job_type] || '#7a8fa4';
                    return (
                      <div key={job.id} className="job-row" onClick={() => setSelectedJob(job)}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', flex:1 }}>
                          <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: color, flexShrink:0 }} />
                          <div>
                            <div style={{ fontWeight:500, fontSize:'0.88rem' }}>{job.customer_name}</div>
                            {job.address && <div style={{ fontSize:'0.72rem', color:'#3d5268' }}>{job.address}</div>}
                          </div>
                        </div>
                        <span className="badge" style={{ background: job.status === 'active' ? 'rgba(61,175,118,0.1)' : 'rgba(255,255,255,0.04)', color: job.status === 'active' ? '#3daf76' : '#3d5268' }}>{job.status}</span>
                      </div>
                    );
                  })}
                  {jobs.length === 0 && <div style={{ color:'#3d5268', fontSize:'0.82rem' }}>No jobs yet.</div>}
                </div>
                <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px' }}>
                  <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>Recent Conversations</div>
                  {conversations.slice(0, 6).map(conv => (
                    <div key={conv.id} className="data-row">
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'0.82rem', color:'#7a8fa4', fontWeight:300, lineHeight:1.5 }}>
                          {conv.summary ? conv.summary.slice(0, 120) + (conv.summary.length > 120 ? '...' : '') : 'Session logged'}
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
              <div style={{ marginTop:'16px' }}><Leaderboard companyId={company?.id || ''} /></div>

            {activeTab === 'jobs' && (
              <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px' }}>
                <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>All Jobs ({jobs.length})</div>
                {jobs.map(job => {
                  const color = JOB_TYPE_COLORS[job.job_type] || '#7a8fa4';
                  return (
                    <div key={job.id} className="job-row" onClick={() => setSelectedJob(job)}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', flex:1 }}>
                        <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: color, flexShrink:0 }} />
                        <div>
                          <div style={{ fontWeight:500, fontSize:'0.88rem' }}>{job.customer_name}</div>
                          {job.address && <div style={{ fontSize:'0.72rem', color:'#3d5268' }}>{job.address}</div>}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                        <span className="badge" style={{ background: color + '22', color }}>{job.job_type || 'other'}</span>
                        <span className="badge" style={{ background: job.status === 'active' ? 'rgba(61,175,118,0.1)' : 'rgba(255,255,255,0.04)', color: job.status === 'active' ? '#3daf76' : '#3d5268' }}>{job.status}</span>
                      </div>
                    </div>
                  );
                })}
                {jobs.length === 0 && <div style={{ color:'#3d5268', fontSize:'0.82rem' }}>No jobs yet.</div>}
              </div>
            )}

            {activeTab === 'conversations' && (
              <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px' }}>
                <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>Conversation History ({conversations.length})</div>
                {conversations.map(conv => (
                  <div key={conv.id} className="data-row" style={{ flexDirection:'column', alignItems:'flex-start', gap:'6px' }}>
                    <div style={{ fontSize:'0.85rem', color:'#e8edf2', lineHeight:1.6 }}>{conv.summary || 'Session logged'}</div>
                    <div style={{ fontSize:'0.62rem', color:'#2d3f52' }}>
                      {new Date(conv.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}
                    </div>
                  </div>
                ))}
                {conversations.length === 0 && <div style={{ color:'#3d5268', fontSize:'0.82rem' }}>No conversations logged yet. Make sure conversation sharing is enabled in rep settings.</div>}
              </div>
            )}

            {activeTab === 'doctrine' && (
              <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                  <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268' }}>Active Doctrine ({doctrine.length})</div>
                  <Link href="/dashboard/doctrine" style={{ fontSize:'0.78rem', color:'#f07a2e', textDecoration:'none', fontWeight:500 }}>Manage</Link>
                </div>
                {doctrine.map(doc => (
                  <div key={doc.id} className="data-row">
                    <div style={{ flex:1 }}>
                      <span className="badge" style={{ background: doc.type === 'broadcast' ? 'rgba(61,175,118,0.1)' : doc.type === 'pdf' ? 'rgba(74,159,212,0.1)' : 'rgba(240,122,46,0.1)', color: doc.type === 'broadcast' ? '#3daf76' : doc.type === 'pdf' ? '#4a9fd4' : '#f07a2e', marginBottom:'6px', display:'inline-block' }}>{doc.type}</span>
                      <div style={{ fontSize:'0.82rem', color:'#7a8fa4', fontWeight:300, lineHeight:1.5 }}>{doc.content.slice(0, 140)}{doc.content.length > 140 ? '...' : ''}</div>
                    </div>
                    <button onClick={() => removeDoc(doc.id)} style={{ background:'transparent', border:'none', color:'#2d3f52', cursor:'pointer', fontSize:'1rem', padding:'4px 8px' }}>x</button>
                  </div>
                ))}
                {doctrine.length === 0 && <div style={{ color:'#3d5268', fontSize:'0.82rem' }}>No doctrine yet.</div>}
              </div>
            )}

            {activeTab === 'team' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                <div style={{ background:'rgba(74,159,212,0.04)', border:'1px solid rgba(74,159,212,0.2)', borderRadius:'12px', padding:'20px' }}>
                  <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#4a9fd4', marginBottom:'14px' }}>Invite a Rep</div>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                    <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="rep@company.com" style={{ flex:1, minWidth:'200px', background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'11px 14px', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.88rem', outline:'none' }} />
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'rep' | 'owner')} style={{ background:'#0b0f14', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'11px 14px', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", fontSize:'0.88rem', outline:'none', cursor:'pointer' }}>
                      <option value="rep">Field Rep</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button onClick={sendInvite} disabled={inviting || !inviteEmail.trim()} style={{ padding:'11px 22px', background:'#4a9fd4', border:'none', borderRadius:'8px', color:'#fff', fontFamily:"'DM Sans',sans-serif", fontSize:'0.85rem', fontWeight:500, cursor:'pointer', opacity: inviting || !inviteEmail.trim() ? 0.5 : 1 }}>
                      {inviting ? 'Sending...' : 'Send Invite'}
                    </button>
                  </div>
                  {inviteResult && <div style={{ marginTop:'10px', fontSize:'0.82rem', color: inviteResult.includes('Code') ? '#3daf76' : '#c84a4a', fontWeight:500 }}>{inviteResult}</div>}
                </div>

                <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px' }}>
                  <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>Team Members ({profiles.length})</div>
                  {profiles.map(profile => (
                    <div key={profile.id} className="data-row">
                      <div>
                        <div style={{ fontWeight:500, marginBottom:'2px' }}>{profile.full_name || profile.email}</div>
                        <div style={{ fontSize:'0.72rem', color:'#3d5268' }}>{profile.email}</div>
                      </div>
                      <span className="badge" style={{ background: profile.role === 'owner' ? 'rgba(240,122,46,0.1)' : 'rgba(61,175,118,0.1)', color: profile.role === 'owner' ? '#f07a2e' : '#3daf76' }}>{profile.role}</span>
                    </div>
                  ))}
                  {profiles.length === 0 && <div style={{ color:'#3d5268', fontSize:'0.82rem' }}>No team members yet.</div>}
                </div>

                {invites.filter(i => !i.accepted).length > 0 && (
                  <div style={{ background:'#111820', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px' }}>
                    <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>Pending Invites</div>
                    {invites.filter(i => !i.accepted).map(invite => (
                      <div key={invite.id} className="data-row">
                        <div>
                          <div style={{ fontWeight:500, marginBottom:'2px' }}>{invite.email}</div>
                          <div style={{ fontSize:'0.72rem', color:'#3d5268', fontFamily:'monospace' }}>Code: {invite.token}</div>
                        </div>
                        <span className="badge" style={{ background:'rgba(255,255,255,0.04)', color:'#3d5268' }}>pending</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}