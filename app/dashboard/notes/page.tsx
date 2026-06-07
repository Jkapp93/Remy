'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

type Note = {
  id: string;
  job_id: string;
  raw_note: string;
  summary: string;
  quote_amount: string;
  follow_up_date: string;
  outcome: string;
  key_details: string[];
  created_at: string;
};

type Job = { id: string; customer_name: string; job_type: string; address: string };

const OUTCOME_COLORS: Record<string, string> = {
  sold: '#3daf76',
  no_sale: '#e74c3c',
  follow_up: '#f07a2e',
  inspection: '#4a9fd4',
  other: '#7a8fa4',
};

const JOB_COLORS: Record<string, string> = {
  roofing: '#f07a2e', fencing: '#4a9fd4', hvac: '#3daf76',
  painting: '#9b59b6', plumbing: '#e74c3c', solar: '#f1c40f',
  restoration: '#e67e22', other: '#7a8fa4',
};

export default function NotesPage() {
  const { user, isLoaded } = useUser();
  const [notes, setNotes] = useState<Note[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    loadData();
  }, [isLoaded, user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const [notesRes, jobsRes] = await Promise.all([
      fetch('/api/notes?repId=' + user.id),
      fetch('/api/jobs'),
    ]);
    const notesData = await notesRes.json();
    const jobsData = await jobsRes.json();
    setNotes(notesData.notes || []);
    setJobs(jobsData.jobs || []);
    setLoading(false);
  };

  const getJobName = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    return job ? job.customer_name : 'Unknown Job';
  };

  const getJobType = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    return job?.job_type || 'other';
  };

  const filteredNotes = selectedJob === 'all' ? notes : notes.filter(n => n.job_id === selectedJob);
  const jobsWithNotes = jobs.filter(j => notes.some(n => n.job_id === j.id));

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .note-card { background: #111820; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 18px; cursor: pointer; transition: border-color 0.2s; }
        .note-card:hover { border-color: rgba(240,122,46,0.2); }
        .filter-pill { padding: 7px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); background: transparent; color: #7a8fa4; font-family: 'DM Sans', sans-serif; font-size: 0.78rem; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .filter-pill.active { background: #f07a2e; border-color: #f07a2e; color: #fff; }
        .badge { font-size: 0.62rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(11,15,20,0.98)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/dashboard" style={{ color: '#3d5268', textDecoration: 'none', fontSize: '0.88rem' }}>Back</Link>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.1rem' }}>Field Notes</div>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#3d5268' }}>{filteredNotes.length} notes</div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px 16px' }}>
        {jobsWithNotes.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '20px' }}>
            <button className={'filter-pill' + (selectedJob === 'all' ? ' active' : '')} onClick={() => setSelectedJob('all')}>All Jobs</button>
            {jobsWithNotes.map(job => (
              <button key={job.id} className={'filter-pill' + (selectedJob === job.id ? ' active' : '')} onClick={() => setSelectedJob(job.id)}>
                {job.customer_name}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', color: '#3d5268', padding: '48px', fontSize: '0.88rem' }}>Loading notes...</div>
        ) : filteredNotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>ðŸ“</div>
            <div style={{ color: '#3d5268', fontSize: '0.88rem', fontWeight: 300, lineHeight: 1.7 }}>
              No notes yet. Say log this to Remy after a job and she will save it here.
            </div>
            <Link href="/dashboard/voice" style={{ display: 'inline-block', marginTop: '20px', background: '#f07a2e', color: '#fff', padding: '12px 24px', borderRadius: '10px', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 }}>Talk to Remy</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredNotes.map(note => {
              const jobType = getJobType(note.job_id);
              const col = JOB_COLORS[jobType] || '#7a8fa4';
              const outCol = OUTCOME_COLORS[note.outcome] || '#7a8fa4';
              const isOpen = expanded === note.id;
              const date = new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

              return (
                <div key={note.id} className="note-card" onClick={() => setExpanded(isOpen ? null : note.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                      <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{getJobName(note.job_id)}</div>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#2d3f52' }}>{date}</div>
                  </div>

                  <div style={{ fontSize: '0.88rem', color: '#e8edf2', fontWeight: 300, lineHeight: 1.6, marginBottom: '12px' }}>
                    {note.summary || note.raw_note}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {note.outcome && (
                      <span className="badge" style={{ background: outCol + '22', color: outCol }}>{note.outcome.replace('_', ' ')}</span>
                    )}
                    {note.quote_amount && (
                      <span className="badge" style={{ background: 'rgba(61,175,118,0.1)', color: '#3daf76' }}>{note.quote_amount}</span>
                    )}
                    {note.follow_up_date && (
                      <span className="badge" style={{ background: 'rgba(74,159,212,0.1)', color: '#4a9fd4' }}>Follow up: {note.follow_up_date}</span>
                    )}
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {note.key_details && note.key_details.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3d5268', marginBottom: '8px' }}>Key Details</div>
                          {note.key_details.map((d, i) => (
                            <div key={i} style={{ fontSize: '0.82rem', color: '#7a8fa4', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: 300 }}>- {d}</div>
                          ))}
                        </div>
                      )}
                      {note.raw_note && note.raw_note !== note.summary && (
                        <div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3d5268', marginBottom: '6px' }}>Original Note</div>
                          <div style={{ fontSize: '0.78rem', color: '#3d5268', fontWeight: 300, lineHeight: 1.6, fontStyle: 'italic' }}>{note.raw_note}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
