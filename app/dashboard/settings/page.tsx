'use client';
import { UserProfile, useUser } from '@clerk/nextjs';
import Link from 'next/link';

export default function SettingsPage() {
  const { isLoaded, isSignedIn } = useUser();

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap'); * { box-sizing:border-box; margin:0; padding:0; }`}</style>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(11,15,20,0.95)', position:'sticky', top:0, zIndex:100 }}>
        <Link href="/dashboard" style={{ fontFamily:"'Syne', sans-serif", fontSize:'1.1rem', fontWeight:800, textDecoration:'none', color:'#e8edf2' }}>Remy<span style={{ color:'#f07a2e' }}>.</span></Link>
        <Link href="/dashboard" style={{ fontSize:'0.8rem', color:'#7a8fa4', textDecoration:'none' }}>Back</Link>
      </div>
      <div style={{ maxWidth:'720px', margin:'0 auto', padding:'32px 24px' }}>
        <h1 style={{ fontFamily:"'Syne', sans-serif", fontSize:'1.8rem', fontWeight:800, marginBottom:'8px' }}>Settings</h1>
        <p style={{ color:'#7a8fa4', fontSize:'0.88rem', fontWeight:300, marginBottom:'28px' }}>Manage your account.</p>
        {isLoaded && isSignedIn && (
          <UserProfile appearance={{ variables: { colorBackground: '#111820', colorText: '#e8edf2', colorPrimary: '#f07a2e' } }} />
        )}
        {isLoaded && !isSignedIn && (
          <div style={{ color:'#3d5268', fontSize:'0.88rem' }}>Please <Link href="/auth" style={{ color:'#f07a2e' }}>sign in</Link> to view settings.</div>
        )}
      </div>
    </div>
  );
}