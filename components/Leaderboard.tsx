// This is a component to add to the boss dashboard Conversations tab
// Shows rep performance leaderboard

'use client';
import { useState, useEffect } from 'react';

type RepStats = {
  repId: string;
  name: string;
  conversations: number;
  notes: number;
  sold: number;
  followUps: number;
  score: number;
};

export default function Leaderboard({ companyId }: { companyId: string }) {
  const [stats, setStats] = useState<RepStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    loadStats();
  }, [companyId]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      setStats(data.stats || []);
    } catch {
      setStats([]);
    }
    setLoading(false);
  };

  if (loading) return <div style={{ color: '#3d5268', fontSize: '0.82rem', padding: '20px' }}>Loading leaderboard...</div>;
  if (!stats.length) return <div style={{ color: '#3d5268', fontSize: '0.82rem', padding: '20px' }}>No rep activity this week.</div>;

  const maxScore = Math.max(...stats.map(s => s.score), 1);

  return (
    <div style={{ background: '#111820', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3d5268', marginBottom: '16px' }}>
        This Week â€” Rep Performance
      </div>
      {stats.map((rep, idx) => (
        <div key={rep.repId} style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: idx === 0 ? 'rgba(240,122,46,0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: idx === 0 ? '#f07a2e' : '#3d5268', fontWeight: 700 }}>
                {idx + 1}
              </div>
              <div style={{ fontWeight: 500, fontSize: '0.88rem' }}>{rep.name}</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', color: '#3d5268' }}>
              {rep.sold > 0 && <span style={{ color: '#3daf76', fontWeight: 600 }}>{rep.sold} closed</span>}
              {rep.notes > 0 && <span>{rep.notes} notes</span>}
              {rep.conversations > 0 && <span>{rep.conversations} sessions</span>}
            </div>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(rep.score / maxScore) * 100}%`, background: idx === 0 ? '#f07a2e' : '#3d5268', borderRadius: '2px', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
