import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ background:'#0b0f14', height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#e8edf2', fontFamily:"'DM Sans',sans-serif", textAlign:'center', padding:'24px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800;900&family=DM+Sans:wght@300;400;500&display=swap');`}</style>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'6rem', fontWeight:900, color:'rgba(240,122,46,0.2)', lineHeight:1, marginBottom:'16px' }}>404</div>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.5rem', fontWeight:800, marginBottom:'12px' }}>Page not found</div>
      <div style={{ color:'#3d5268', fontSize:'0.9rem', fontWeight:300, marginBottom:'32px' }}>This page does not exist or was moved.</div>
      <Link href="/" style={{ background:'#f07a2e', color:'#fff', padding:'12px 28px', borderRadius:'10px', textDecoration:'none', fontWeight:600, fontSize:'0.9rem' }}>Go Home</Link>
    </div>
  );
}
