'use client';
import { useUser, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useUser();

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
        <div style={{ fontFamily:"'Syne', sans-serif", fontSize:'1.8rem', fontWeight:700, marginBottom:'6px' }}>
          Welcome back{user?.firstName ? `, ${user.firstName}` : ''}.
        </div>
        <div style={{ color:'#7a8fa4', fontSize:'0.95rem', marginBottom:'40px', fontWeight:300 }}>
          Your AI field companion is ready.
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'16px' }}>
          <Link href="/dashboard/jobs" className="card">
            <div className="card-icon" style={{ background:'rgba(255,255,255,0.05)', color:'#7a8fa4' }}>JOBS</div>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'1rem', marginBottom:'6px' }}>Jobs</div>
            <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300 }}>Create and manage your field jobs</div>
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
            <div style={{ color:'#7a8fa4', fontSize:'0.82rem', fontWeight:300 }}>Boss view â€” jobs, conversations, doctrine</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
