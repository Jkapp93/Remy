'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const OUTCOME_COLORS: Record<string, string> = {
  sold: '#3daf76', no_sale: '#e74c3c', follow_up: '#f07a2e',
  inspection: '#4a9fd4', other: '#7a8fa4', proposal_sent: '#9b59b6',
};

function TimelineContent() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');
  const jobName = searchParams.get('jobName') || 'Job Timeline';
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !user || !jobId) { setLoading(false); return; }
    loadTimeline();
  }, [isLoaded, user, jobId]);

  const loadTimeline = async () => {
    setLoading(true);
    const [notesRes, convosRes] = await Promise.all([
      supabase.from('job_notes').select('*').eq('job_id', jobId).order('created_at', { ascending: true }),
      supabase.from('conversations').select('*').eq('job_id', jobId).order('created_at', { ascending: true }),
    ]);

    const notes = (notesRes.data || []).map((n: any) => ({ ...n, type: 'note' }));
    const convos = (convosRes.data || []).map((c: any) => ({ ...c, type: 'conversation' }));
    const all = [...notes, ...convos].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setEvents(all);
    setLoading(false);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap'); * { box-sizing:border-box; margin:0; padding:0; }`}</style>
      
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(11,15,20,0.98)', position: 'sticky', top: 0, zIndex: 50 }}>
        <Link href="/dashboard/jobs" style={{ color: '#3d5268', textDecoration: 'none', fontSize: '0.88rem' }}>Back</Link>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.1rem' }}>{jobName}</div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3d5268', marginBottom: '24px' }}>Job Timeline</div>

        {loading ? (
          <div style={{ color: '#3d5268', textAlign: 'center', padding: '40px' }}>Loading...</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#3d5268' }}>
            <div style={{ marginBottom: '12px', fontSize: '0.88rem' }}>No activity yet on this job.</div>
            <Link href="/dashboard/voice" style={{ color: '#f07a2e', textDecoration: 'none', fontSize: '0.82rem' }}>Talk to Remy about this job</Link>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '15px', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.06)' }} />
            {events.map((event, i) => {
              const isNote = event.type === 'note';
              const col = isNote ? (OUTCOME_COLORS[event.outcome] || '#7a8fa4') : '#4a9fd4';
              return (
                <div key={event.id} style={{ display: 'flex', gap: '20px', marginBottom: '20px', position: 'relative' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: col + '22', border: `1.5px solid ${col}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.6rem', fontWeight: 700, color: col, zIndex: 1 }}>
                    {isNote ? 'NOTE' : 'MSG'}
                  </div>
                  <div style={{ flex: 1, background: '#111820', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: col, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {isNote ? (event.outcome?.replace('_', ' ') || 'Note') : 'Remy Session'}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#2d3f52' }}>{formatDate(event.created_at)}</div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#c8d8e8', fontWeight: 300, lineHeight: 1.6 }}>
                      {event.summary || event.raw_note || 'Session logged'}
                    </div>
                    {event.quote_amount && (
                      <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#3daf76', fontWeight: 500 }}>Quote: {event.quote_amount}</div>
                    )}
                    {event.follow_up_date && (
                      <div style={{ marginTop: '4px', fontSize: '0.78rem', color: '#f07a2e' }}>Follow up: {event.follow_up_date}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TimelinePage() {
  return <Suspense fallback={null}><TimelineContent /></Suspense>;
}
