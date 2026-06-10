'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

function ProposalContent() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');
  const jobName = searchParams.get('jobName') || 'this job';
  const [generating, setGenerating] = useState(false);
  const [proposal, setProposal] = useState<any>(null);
  const [error, setError] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch('/api/profile?clerkId=' + user.id)
      .then(r => r.json())
      .then(d => { if (d.profile?.company_id) setCompanyId(d.profile.company_id); })
      .catch(() => {});
  }, [isLoaded, user]);

  const generate = async () => {
    if (!user || !jobId) return;
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/agent/generate-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, repId: user.id, companyId }),
      });
      const data = await res.json();
      if (data.success) setProposal(data.proposal);
      else setError('Failed to generate proposal. Try again.');
    } catch { setError('Something went wrong.'); }
    setGenerating(false);
  };

  const printProposal = () => window.print();

  const copyAsText = () => {
    if (!proposal) return;
    const lines = [
      proposal.title,
      proposal.date,
      '',
      `Prepared for: ${proposal.customer}`,
      proposal.address || '',
      '',
      proposal.intro,
      '',
      'SCOPE OF WORK:',
      ...(proposal.scope || []).map((s: string) => `  • ${s}`),
      '',
      proposal.quoteAmount ? `Total Investment: ${proposal.quoteAmount}` : '',
      proposal.financing || '',
      proposal.warranty ? `\nWarranty: ${proposal.warranty}` : '',
      '',
      proposal.closing,
      '',
      `Valid until: ${proposal.validUntil}`,
      proposal.company || '',
    ].filter(l => l !== undefined);
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div style={{ background: '#0b0f14', minHeight: '100vh', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
          .proposal-card { background: #fff !important; color: #000 !important; border: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(11,15,20,0.98)', position: 'sticky', top: 0, zIndex: 50 }}>
        <Link href="/dashboard" style={{ color: '#3d5268', textDecoration: 'none', fontSize: '0.88rem' }}>Back</Link>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.1rem' }}>Proposal Generator</div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '32px 20px' }}>
        {!proposal ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            {!jobId ? (
              <div>
                <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>📋</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.2rem', marginBottom: '10px' }}>No job selected</div>
                <div style={{ color: '#7a8fa4', fontSize: '0.88rem', fontWeight: 300, marginBottom: '28px', lineHeight: 1.7 }}>Open a job first, then tap the Proposal button on that job.</div>
                <Link href="/dashboard/jobs" style={{ background: '#f07a2e', color: '#fff', textDecoration: 'none', borderRadius: '10px', padding: '13px 28px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.9rem', fontWeight: 600 }}>Go to Jobs</Link>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.4rem', marginBottom: '12px' }}>{jobName}</div>
                <div style={{ color: '#7a8fa4', fontSize: '0.88rem', fontWeight: 300, marginBottom: '32px', lineHeight: 1.7 }}>
                  Remy will generate a professional proposal based on your job notes and company doctrine. Takes about 10 seconds.
                </div>
                {error && (
                  <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: '10px', padding: '14px 18px', color: '#e74c3c', fontSize: '0.88rem', marginBottom: '20px' }}>
                    {error}
                  </div>
                )}
                <button onClick={generate} disabled={generating}
                  style={{ background: '#f07a2e', color: '#fff', border: 'none', borderRadius: '12px', padding: '16px 32px', fontFamily: "'DM Sans',sans-serif", fontSize: '1rem', fontWeight: 600, cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.7 : 1 }}>
                  {generating ? '⏳ Generating...' : 'Generate Proposal'}
                </button>
              </>
            )}
          </div>
        ) : (
          <div>
            <div className="no-print" style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <button onClick={printProposal} style={{ background: '#f07a2e', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 24px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}>
                Print / Save PDF
              </button>
              <button onClick={copyAsText} style={{ background: copied ? 'rgba(61,175,118,0.15)' : 'rgba(74,159,212,0.1)', color: copied ? '#3daf76' : '#4a9fd4', border: `1px solid ${copied ? 'rgba(61,175,118,0.3)' : 'rgba(74,159,212,0.25)'}`, borderRadius: '10px', padding: '12px 24px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}>
                {copied ? 'Copied!' : 'Copy as Text'}
              </button>
              <button onClick={() => setProposal(null)} style={{ background: 'rgba(255,255,255,0.06)', color: '#e8edf2', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 24px', fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', cursor: 'pointer' }}>
                Regenerate
              </button>
            </div>

            <div className="proposal-card" style={{ background: '#111820', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '40px', lineHeight: 1.8 }}>
              <div style={{ borderBottom: '2px solid #f07a2e', paddingBottom: '20px', marginBottom: '28px' }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.6rem', marginBottom: '4px' }}>{proposal.title}</div>
                <div style={{ color: '#7a8fa4', fontSize: '0.82rem' }}>{proposal.date}</div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Prepared for:</div>
                <div style={{ color: '#7a8fa4' }}>{proposal.customer}</div>
                {proposal.address && <div style={{ color: '#7a8fa4', fontSize: '0.85rem' }}>{proposal.address}</div>}
              </div>

              <div style={{ marginBottom: '24px', color: '#c8d8e8', fontWeight: 300 }}>{proposal.intro}</div>

              {proposal.scope && proposal.scope.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '0.82rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f07a2e' }}>Scope of Work</div>
                  {proposal.scope.map((item: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', color: '#c8d8e8', fontWeight: 300 }}>
                      <span style={{ color: '#f07a2e', flexShrink: 0 }}>{'•'}</span>{item}
                    </div>
                  ))}
                </div>
              )}

              {proposal.quoteAmount && (
                <div style={{ background: 'rgba(240,122,46,0.08)', border: '1px solid rgba(240,122,46,0.2)', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600 }}>Total Investment</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.4rem', color: '#f07a2e' }}>{proposal.quoteAmount}</div>
                </div>
              )}

              {proposal.financing && (
                <div style={{ marginBottom: '24px', color: '#7a8fa4', fontSize: '0.85rem', fontWeight: 300, fontStyle: 'italic' }}>{proposal.financing}</div>
              )}

              {proposal.warranty && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '0.82rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a9fd4' }}>Warranty</div>
                  <div style={{ color: '#c8d8e8', fontWeight: 300 }}>{proposal.warranty}</div>
                </div>
              )}

              <div style={{ color: '#c8d8e8', fontWeight: 300, marginBottom: '28px' }}>{proposal.closing}</div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#3d5268' }}>
                <div>Valid until: {proposal.validUntil}</div>
                <div>{proposal.company}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProposalPage() {
  return <Suspense fallback={null}><ProposalContent /></Suspense>;
}
