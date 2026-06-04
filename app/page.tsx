import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{
      background: '#0b0f14',
      minHeight: '100vh',
      color: '#e8edf2',
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '40px 24px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
      <div style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f07a2e', marginBottom: '24px' }}>
        Now in early access
      </div>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '4rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '24px' }}>
        The AI that rides with your field reps.
      </h1>
      <p style={{ fontSize: '1.1rem', color: '#7a8fa4', maxWidth: '520px', fontWeight: 300, lineHeight: 1.7, marginBottom: '40px' }}>
        Voice-first. Always learning. Knows your company doctrine. Briefs your reps before every job.
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/auth" style={{ background: '#f07a2e', color: '#fff', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>
          Get Started
        </Link>
        <Link href="/dashboard" style={{ background: 'transparent', color: '#7a8fa4', border: '1px solid rgba(255,255,255,0.12)', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none', fontSize: '0.95rem' }}>
          Dashboard
        </Link>
      </div>
    </div>
  );
}