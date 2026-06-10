'use client';
import { useUser, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type FollowUp = { id: string; summary: string; follow_up_date: string; job_id: string };

function DashboardInner() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [jobs, setJobs] = useState<{id: string; customer_name: string}[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [winsThisWeek, setWinsThisWeek] = useState(0);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (searchParams.get('welcome')) setShowWelcome(true);
    fetch('/api/onboard-check?clerkId=' + user.id)
      .then(r => r.json())
      .then(d => { if (!d.onboarded) router.replace('/onboard'); })
      .catch(() => {});
    Promise.all([
      fetch(`/api/notes?repId=${user.id}`).then(r => r.json()),
      fetch(`/api/jobs?clerkId=${user.id}`).then(r => r.json()),
      fetch(`/api/memory?repId=${user.id}`).then(r => r.json()).catch(() => ({ memories: [] })),
    ]).then(([notesData, jobsData, memData]) => {
      const pending = (notesData.notes || []).filter((n: any) => n.follow_up_date);
      setFollowUps(pending.slice(0, 5));
      setJobs(jobsData.jobs || []);
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const wins = (memData.memories || []).filter((m: any) => m.source === 'outcome' && m.content?.includes('CLOSED') && new Date(m.created_at || 0).getTime() > weekAgo);
      setWinsThisWeek(wins.length);
    }).catch(() => {});
  }, [isLoaded, user]);

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes glow { 0%,100%{box-shadow:0 0 8px rgba(240,122,46,.2)} 50%{box-shadow:0 0 20px rgba(240,122,46,.4)} }
        .card { background:#111820; border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:28px; cursor:pointer; transition:border-color 0.2s; text-decoration:none; display:block; color:#e8edf2; }
        .card:hover { border-color:rgba(255,255,255,0.15); }
        .card-orange { background:rgba(240,122,46,0.06); border-color:rgba(240,122,46,0.25); animation:glow 3s ease-in-out infinite; }
        .card-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:14px; font-size:0.75rem; font-weight:700; letter-spacing:0.05em; }
      `}</style>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 28px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(11,15,20,0.95)', backdropFilter:'blur(20px)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ fontFamily:"'Syne', sans-serif", fontSize:'1.2rem', fontWeight:800, letterSpacing:'-0.02em' }}>
          Remy<span style={{ color:'#f07a2e' }}>.</span>
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>

      <div style={{ padding:'40px 28px', maxWidth:'1000px', margin:'0 auto' }}>
        {showWelcome && (
          <div style={{ background:'rgba(61,175,118,0.08)', border:'1px solid rgba(61,175,118,0.25)', borderRadius:'12px', padding:'16px 20px', marginBottom:'28px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:'0.9rem', color:'#3daf76', marginBottom:'2px' }}>You&apos;re in. Welcome to Remy.</div>
              <div style={{ fontSize:'0.8rem', color:'#7a8fa4', fontWeight:300 }}>Add your first job and get your brief before you knock.</div>
            </div>
            <button onClick={() => setShowWelcome(false)} style={{ background:'transparent', border:'none', color:'#3d5268', cursor:'pointer', fontSize:'1rem', padding:'4px 8px' }}>×</button>
          </div>
        )}
        <div style={{ fontFamily:"'Syne', sans-serif", fontSize:'1.8rem', fontWeight:700, marginBottom:'6px' }}>
          Welcome back{user?.firstName ? `, ${user.firstName}` : ''}.
        </div>
        <div style={{ color:'#7a8fa4', fontSize:'0.95rem', marginBottom:'40px', fontWeight:300 }}>
          Your AI field companion is ready.
        </div>

        {winsThisWeek > 0 && (
          <div style={{ marginBottom: '20px', background: 'rgba(61,175,118,0.06)', border: '1px solid rgba(61,175,118,0.2)', borderRadius: '12px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '1.6rem', lineHeight: 1 }}>&#127942;</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#3daf76' }}>{winsThisWeek} close{winsThisWeek > 1 ? 's' : ''} this week</div>
              <div style={{ fontSize: '0.78rem', color: '#7a8fa4', fontWeight: 300 }}>Keep the momentum going.</div>
            </div>
          </div>
        )}

        {followUps.length > 0 && (
          <div style={{ marginBottom: '32px', background: 'rgba(74,159,212,0.04)', border: '1px solid rgba(74,159,212,0.15)', borderRadius: '12px', padding: '18px 20px' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4a9fd4', marginBottom: '12px' }}>
              Pending Follow-ups
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {followUps.map(fu => {
                const jobName = jobs.find(j => j.id === fu.job_id)?.customer_name || 'Job';
                return (
                  <Link key={fu.id} href="/dashboard/notes" style={{ textDecoration: 'none', display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ marginTop: '2px', width: '7px', height: '7px', borderRadius: '50%', background: '#4a9fd4', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', color: '#e8edf2', fontWeight: 500 }}>{jobName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#7a8fa4', marginTop: '2px', fontWeight: 300 }}>{fu.summary || 'Follow-up scheduled'}</div>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#4a9fd4', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>{fu.follow_up_date}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="dashboard-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'16px' }}>
          <Link href="/dashboard/jobs" className="card">
            <div className="card-icon" style={{ background:'rgba(255,255,255,0.05)', color:'#7a8fa4' }}>JOBS</div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'6px' }}>Jobs</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300 }}>{jobs.length > 0 ? `${jobs.length} active job${jobs.length > 1 ? 's' : ''}` : 'Create and manage your field jobs'}</div>
          </Link>

          <Link href="/dashboard/notes" className="card">
            <div className="card-icon" style={{ background:'rgba(255,255,255,0.05)', color:'#7a8fa4' }}>NOTE</div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'6px' }}>Field Notes</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300 }}>{followUps.length > 0 ? `${followUps.length} follow-up${followUps.length > 1 ? 's' : ''} pending` : 'View logged job notes and follow-ups'}</div>
          </Link>

          <Link href="/dashboard/voice" className="card card-orange">
            <div className="card-icon" style={{ background:'rgba(240,122,46,0.15)', color:'#f07a2e' }}>MIC</div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'6px', color:'#f07a2e' }}>Talk to Remy</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300 }}>Start a voice session for your current job</div>
          </Link>

          <Link href="/dashboard/doctrine" className="card">
            <div className="card-icon" style={{ background:'rgba(255,255,255,0.05)', color:'#7a8fa4' }}>DOC</div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'6px' }}>Doctrine</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300 }}>Inject company knowledge and scripts</div>
          </Link>

          <Link href="/dashboard/settings" className="card">
            <div className="card-icon" style={{ background:'rgba(255,255,255,0.05)', color:'#7a8fa4' }}>SET</div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'6px' }}>Settings</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300 }}>Manage your account and team</div>
          </Link>

          <Link href="/boss" className="card" style={{ borderColor:'rgba(74,159,212,0.25)', background:'rgba(74,159,212,0.04)' }}>
            <div className="card-icon" style={{ background:'rgba(74,159,212,0.1)', color:'#4a9fd4' }}>CMD</div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'6px', color:'#4a9fd4' }}>Command Center</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300 }}>Boss view: jobs, conversations, doctrine</div>
          </Link>

          <Link href="/dashboard/outcome" className="card">
            <div className="card-icon" style={{ background:'rgba(61,175,118,0.05)', color:'#3daf76' }}>WIN</div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'6px' }}>Log Outcome</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300 }}>Mark a job as won, lost, or follow-up</div>
          </Link>

          <Link href="/dashboard/proposal" className="card">
            <div className="card-icon" style={{ background:'rgba(155,89,182,0.05)', color:'#9b59b6' }}>PROP</div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'6px' }}>Proposals</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300 }}>Generate professional proposals</div>
          </Link>

          <Link href="/dashboard/broadcasts" className="card">
            <div className="card-icon" style={{ background:'rgba(74,159,212,0.05)', color:'#4a9fd4' }}>LIVE</div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'6px' }}>Broadcasts</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300 }}>View storm alerts and team broadcasts</div>
          </Link>

          <Link href="/dashboard/canvass" className="card">
            <div className="card-icon" style={{ background:'rgba(61,175,118,0.05)', color:'#3daf76' }}>MAP</div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'6px' }}>Canvass</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300 }}>Track every door — knocked, interested, sold</div>
          </Link>

          <Link href="/dashboard/objections" className="card">
            <div className="card-icon" style={{ background:'rgba(231,76,60,0.05)', color:'#e74c3c' }}>OBJ</div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'6px' }}>Objection Coach</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300 }}>Instant rebuttals for any pushback at the door</div>
          </Link>

          <Link href="/dashboard/stats" className="card" style={{ borderColor:'rgba(241,196,15,0.15)', background:'rgba(241,196,15,0.03)' }}>
            <div className="card-icon" style={{ background:'rgba(241,196,15,0.08)', color:'#f1c40f' }}>STAT</div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'6px', color:'#f1c40f' }}>Your Numbers</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300 }}>{winsThisWeek > 0 ? `${winsThisWeek} close${winsThisWeek > 1 ? 's' : ''} this week` : 'Win rate, closes, and performance'}</div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <Suspense><DashboardInner /></Suspense>;
}