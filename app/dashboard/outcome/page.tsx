'use client';
import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const OUTCOMES = [
  { id: 'sold', label: 'Closed It', emoji: 'ðŸ†', color: '#3daf76', desc: 'Deal signed, contract done' },
  { id: 'follow_up', label: 'Follow Up', emoji: 'ðŸ“…', color: '#f07a2e', desc: 'Need to circle back' },
  { id: 'no_sale', label: 'No Sale', emoji: 'âŒ', color: '#e74c3c', desc: 'Not moving forward' },
  { id: 'inspection', label: 'Inspection', emoji: 'ðŸ”', color: '#4a9fd4', desc: 'Scheduled an inspection' },
];

function OutcomeContent() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('jobId');
  const jobName = searchParams.get('jobName') || 'this job';
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (outcomeId: string) => {
    if (!user || saving) return;
    setSelected(outcomeId);
    setSaving(true);

    // Update job status
    if (jobId) {
      const mappedStatus = outcomeId === 'sold' ? 'closed' : outcomeId === 'no_sale' ? 'closed' : 'active';
      await supabase.from('jobs').update({ status: mappedStatus }).eq('id', jobId);
    }

    // Save outcome as note
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repId: user.id,
        jobId: jobId || null,
        rawNote: `Outcome: ${outcomeId}${note ? '. ' + note : ''}`,
        jobName,
      }),
    });

    setSaving(false);
    setSaved(true);

    // Celebrate if sold
    if (outcomeId === 'sold') {
      setTimeout(() => router.push('/dashboard?win=1'), 2000);
    } else {
      setTimeout(() => router.push('/dashboard'), 1500);
    }
  };

  if (saved && selected === 'sold') {
    return (
      <div style={{ background: '#0b0f14', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif", textAlign: 'center', padding: '24px' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800;900&family=DM+Sans:wght@300;400&display=swap');`}</style>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>ðŸ†</div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '2rem', fontWeight: 900, color: '#3daf76', marginBottom: '8px' }}>Deal closed.</div>
        <div style={{ color: '#7a8fa4', fontSize: '0.9rem', fontWeight: 300 }}>Remy logged it. On to the next one.</div>
      </div>
    );
  }

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800;900&family=DM+Sans:wght@300;400;600&display=swap'); * { box-sizing:border-box; margin:0; padding:0; }`}</style>

      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link href="/dashboard" style={{ color: '#3d5268', textDecoration: 'none', fontSize: '0.88rem' }}>Back</Link>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.1rem' }}>How did it go?</div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ fontSize: '1rem', color: '#7a8fa4', fontWeight: 300, marginBottom: '32px', textAlign: 'center' }}>
          {jobName}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {OUTCOMES.map(outcome => (
            <button
              key={outcome.id}
              onClick={() => save(outcome.id)}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                background: selected === outcome.id ? outcome.color + '22' : '#111820',
                border: `1.5px solid ${selected === outcome.id ? outcome.color : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '14px', padding: '18px 20px', cursor: 'pointer',
                color: '#e8edf2', fontFamily: "'DM Sans',sans-serif", textAlign: 'left',
                transition: 'all 0.15s', opacity: saving && selected !== outcome.id ? 0.4 : 1,
              }}
            >
              <div style={{ fontSize: '1.8rem', flexShrink: 0 }}>{outcome.emoji}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: selected === outcome.id ? outcome.color : '#e8edf2' }}>{outcome.label}</div>
                <div style={{ fontSize: '0.78rem', color: '#3d5268', marginTop: '2px', fontWeight: 300 }}>{outcome.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add a note (optional)..."
            style={{
              width: '100%', background: '#111820', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px', padding: '14px 16px', color: '#e8edf2',
              fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', fontWeight: 300,
              resize: 'none', height: '80px', outline: 'none',
            }}
          />
        </div>

        <Link href="/dashboard" style={{ display: 'block', textAlign: 'center', color: '#3d5268', fontSize: '0.82rem', textDecoration: 'none', marginTop: '8px' }}>
          Skip for now
        </Link>
      </div>
    </div>
  );
}


export default function OutcomePage() { return <Suspense fallback={null}><OutcomeContent /></Suspense>; }