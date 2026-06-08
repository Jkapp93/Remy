'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function BroadcastHistoryPage() {
  const { user, isLoaded } = useUser();
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch('/api/profile?clerkId=' + user.id)
      .then(r => r.json())
      .then(d => {
        if (d.profile?.company_id) {
          setCompanyId(d.profile.company_id);
          loadBroadcasts(d.profile.company_id);
        } else setLoading(false);
      }).catch(() => setLoading(false));
  }, [isLoaded, user]);

  const loadBroadcasts = async (cId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('doctrine')
      .select('*')
      .eq('company_id', cId)
      .eq('type', 'broadcast')
      .order('created_at', { ascending: false })
      .limit(50);
    setBroadcasts(data || []);
    setLoading(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('doctrine').update({ active: !current }).eq('id', id);
    setBroadcasts(prev => prev.map(b => b.id === id ? { ...b, active: !current } : b));
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const getType = (content: string) => {
    if (content.includes('[STORM ALERT]')) return { label: 'STORM', color: '#4a9fd4' };
    if (content.includes('[STALE JOBS]')) return { label: 'STALE', color: '#e74c3c' };
    if (content.includes('[STORM CHASER]')) return { label: 'CHASER', color: '#f07a2e' };
    if (content.includes('[MORNING BRIEF]')) return { label: 'BRIEF', color: '#3daf76' };
    return { label: 'BROADCAST', color: '#7a8fa4' };
  };

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap'); * { box-sizing:border-box; margin:0; padding:0; }`}</style>

      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(11,15,20,0.98)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/boss" style={{ color: '#3d5268', textDecoration: 'none', fontSize: '0.88rem' }}>Back</Link>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.1rem' }}>Broadcast History</div>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#3d5268' }}>{broadcasts.length} total</div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#3d5268', padding: '48px' }}>Loading...</div>
        ) : broadcasts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#3d5268', fontSize: '0.88rem' }}>
            No broadcasts yet. Zeus will populate this automatically.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {broadcasts.map(b => {
              const typeInfo = getType(b.content);
              const cleanContent = b.content.replace(/\[.*?\]\s*/, '');
              return (
                <div key={b.id} style={{ background: '#111820', border: `1px solid ${b.active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}`, borderRadius: '12px', padding: '16px', opacity: b.active ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', padding: '3px 8px', borderRadius: '4px', background: typeInfo.color + '22', color: typeInfo.color }}>{typeInfo.label}</span>
                      {!b.active && <span style={{ fontSize: '0.62rem', color: '#3d5268' }}>INACTIVE</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '0.68rem', color: '#2d3f52' }}>{formatDate(b.created_at)}</div>
                      <button onClick={() => toggleActive(b.id, b.active)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '3px 8px', color: '#7a8fa4', fontSize: '0.68rem', cursor: 'pointer' }}>
                        {b.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#c8d8e8', fontWeight: 300, lineHeight: 1.6 }}>{cleanContent}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
