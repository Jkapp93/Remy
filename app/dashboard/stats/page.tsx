'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

type OutcomeMemory = { id: string; content: string; source: string; created_at: string };

function parseOutcome(content: string): 'closed' | 'no_sale' | 'follow_up' | null {
  if (content.includes('CLOSED')) return 'closed';
  if (content.includes('NO SALE')) return 'no_sale';
  if (content.includes('FOLLOW-UP')) return 'follow_up';
  return null;
}

export default function StatsPage() {
  const { user, isLoaded } = useUser();
  const [memories, setMemories] = useState<OutcomeMemory[]>([]);
  const [activeJobs, setActiveJobs] = useState(0);
  const [pendingFollowUps, setPendingFollowUps] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !user) return;
    Promise.all([
      fetch(`/api/memory?repId=${user.id}`).then(r => r.json()).catch(() => ({ memories: [] })),
      fetch(`/api/jobs?clerkId=${user.id}`).then(r => r.json()).catch(() => ({ jobs: [] })),
      fetch(`/api/notes?repId=${user.id}`).then(r => r.json()).catch(() => ({ notes: [] })),
    ]).then(([memData, jobData, notesData]) => {
      const outcomes = (memData.memories || []).filter((m: OutcomeMemory) => m.source === 'outcome');
      setMemories(outcomes);
      setActiveJobs((jobData.jobs || []).length);
      setPendingFollowUps(((notesData.notes || []).filter((n: any) => n.follow_up_date)).length);
      setLoading(false);
    });
  }, [isLoaded, user]);

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const closesWeek = memories.filter(m => parseOutcome(m.content) === 'closed' && new Date(m.created_at).getTime() > weekAgo).length;
  const closesMonth = memories.filter(m => parseOutcome(m.content) === 'closed' && new Date(m.created_at).getTime() > monthAgo).length;
  const closesAll = memories.filter(m => parseOutcome(m.content) === 'closed').length;
  const lossesAll = memories.filter(m => parseOutcome(m.content) === 'no_sale').length;
  const winRate = closesAll + lossesAll > 0 ? Math.round((closesAll / (closesAll + lossesAll)) * 100) : null;

  const streakDays = (() => {
    const closeDays = new Set(
      memories
        .filter(m => parseOutcome(m.content) === 'closed')
        .map(m => new Date(m.created_at).toDateString())
    );
    let streak = 0;
    const d = new Date();
    while (closeDays.has(d.toDateString())) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  })();

  const recent = [...memories].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 12);

  const outcomeColor = (content: string) => {
    const o = parseOutcome(content);
    if (o === 'closed') return '#3daf76';
    if (o === 'no_sale') return '#e74c3c';
    return '#4a9fd4';
  };

  const outcomeBg = (content: string) => {
    const o = parseOutcome(content);
    if (o === 'closed') return 'rgba(61,175,118,0.08)';
    if (o === 'no_sale') return 'rgba(231,76,60,0.08)';
    return 'rgba(74,159,212,0.08)';
  };

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .stat-card { background:#111820; border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:24px; }
      `}</style>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(11,15,20,0.95)', position:'sticky', top:0, zIndex:100 }}>
        <Link href="/dashboard" style={{ fontFamily:"'Syne', sans-serif", fontSize:'1.1rem', fontWeight:800, textDecoration:'none', color:'#e8edf2' }}>Remy<span style={{ color:'#f07a2e' }}>.</span></Link>
        <Link href="/dashboard" style={{ fontSize:'0.8rem', color:'#7a8fa4', textDecoration:'none' }}>Back</Link>
      </div>

      <div style={{ maxWidth:'720px', margin:'0 auto', padding:'32px 24px' }}>
        <h1 style={{ fontFamily:"'Syne', sans-serif", fontSize:'1.8rem', fontWeight:800, marginBottom:'4px' }}>Your Numbers</h1>
        <p style={{ color:'#7a8fa4', fontSize:'0.88rem', fontWeight:300, marginBottom:'32px' }}>Performance tracked by Remy</p>

        {loading ? (
          <div style={{ color:'#3d5268', textAlign:'center', padding:'60px' }}>Loading...</div>
        ) : (
          <>
            {/* Big win rate + streak */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px' }}>
              <div className="stat-card" style={{ borderColor: winRate !== null && winRate >= 50 ? 'rgba(61,175,118,0.25)' : 'rgba(255,255,255,0.07)', background: winRate !== null && winRate >= 50 ? 'rgba(61,175,118,0.05)' : '#111820' }}>
                <div style={{ fontSize:'0.65rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'10px' }}>Win Rate</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'2.8rem', fontWeight:900, color: winRate !== null && winRate >= 50 ? '#3daf76' : '#e74c3c', lineHeight:1 }}>
                  {winRate !== null ? `${winRate}%` : '—'}
                </div>
                <div style={{ fontSize:'0.75rem', color:'#3d5268', marginTop:'8px', fontWeight:300 }}>
                  {closesAll} closes · {lossesAll} losses
                </div>
              </div>

              <div className="stat-card" style={{ borderColor: streakDays >= 3 ? 'rgba(241,196,15,0.25)' : 'rgba(255,255,255,0.07)', background: streakDays >= 3 ? 'rgba(241,196,15,0.04)' : '#111820' }}>
                <div style={{ fontSize:'0.65rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'10px' }}>Close Streak</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'2.8rem', fontWeight:900, color: streakDays >= 1 ? '#f1c40f' : '#3d5268', lineHeight:1 }}>
                  {streakDays}
                </div>
                <div style={{ fontSize:'0.75rem', color:'#3d5268', marginTop:'8px', fontWeight:300 }}>
                  {streakDays === 0 ? 'No current streak' : streakDays === 1 ? 'consecutive day' : 'consecutive days'}
                </div>
              </div>
            </div>

            {/* Closes: week / month / all time */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'14px', marginBottom:'14px' }}>
              {[
                { label: 'This Week', value: closesWeek, color: '#f07a2e' },
                { label: 'This Month', value: closesMonth, color: '#9b59b6' },
                { label: 'All Time', value: closesAll, color: '#4a9fd4' },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'0.62rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#3d5268', marginBottom:'8px' }}>{s.label}</div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'2.2rem', fontWeight:900, color: s.value > 0 ? s.color : '#1e2a38', lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:'0.68rem', color:'#3d5268', marginTop:'6px', fontWeight:300 }}>closes</div>
                </div>
              ))}
            </div>

            {/* Pipeline snapshot */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'28px' }}>
              <div className="stat-card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:'0.65rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'6px' }}>Active Jobs</div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.8rem', fontWeight:800, color: activeJobs > 0 ? '#e8edf2' : '#1e2a38' }}>{activeJobs}</div>
                </div>
                <Link href="/dashboard/jobs" style={{ fontSize:'0.72rem', color:'#f07a2e', textDecoration:'none', fontWeight:500 }}>View →</Link>
              </div>
              <div className="stat-card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:'0.65rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'6px' }}>Follow-Ups</div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.8rem', fontWeight:800, color: pendingFollowUps > 0 ? '#4a9fd4' : '#1e2a38' }}>{pendingFollowUps}</div>
                </div>
                <Link href="/dashboard/notes" style={{ fontSize:'0.72rem', color:'#4a9fd4', textDecoration:'none', fontWeight:500 }}>View →</Link>
              </div>
            </div>

            {/* Recent activity */}
            {recent.length > 0 && (
              <div>
                <div style={{ fontSize:'0.65rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#3d5268', marginBottom:'14px' }}>Recent Activity</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {recent.map(m => (
                    <div key={m.id} style={{ background: outcomeBg(m.content), border:`1px solid ${outcomeColor(m.content)}22`, borderRadius:'10px', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
                      <div style={{ fontSize:'0.85rem', color:'#e8edf2', fontWeight:300, flex:1 }}>{m.content}</div>
                      <div style={{ fontSize:'0.68rem', color:'#3d5268', flexShrink:0, whiteSpace:'nowrap' }}>
                        {new Date(m.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recent.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px', color:'#3d5268', fontSize:'0.88rem', fontWeight:300 }}>
                No outcomes logged yet. Close a deal and tell Remy — she tracks it automatically.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
