'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { useProfile } from '../../../lib/useProfile';
import Link from 'next/link';

const JOB_TYPE_COLORS: Record<string, string> = {
  roofing: '#f07a2e', fencing: '#4a9fd4', hvac: '#3daf76',
  painting: '#9b59b6', plumbing: '#e74c3c', solar: '#f1c40f',
  restoration: '#e67e22', other: '#7a8fa4',
};

const DOCTRINE_TTL = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 hours — don't restore yesterday's session

type Message = { role: 'user' | 'assistant'; content: string };
type Job = { id: string; customer_name: string; address: string; notes: string; status: string; job_type: string; deal_value?: number };

async function getCachedDoctrine(clerkId: string): Promise<string> {
  try {
    const key = `remy_doctrine_${clerkId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < DOCTRINE_TTL) return data;
    }
    const res = await fetch(`/api/doctrine-list?clerkId=${clerkId}`).then(r => r.json()).catch(() => ({ doctrine: '' }));
    const doctrine = res.doctrine || '';
    localStorage.setItem(key, JSON.stringify({ data: doctrine, ts: Date.now() }));
    return doctrine;
  } catch { return ''; }
}

function VoicePageInner() {
  const { user, isLoaded } = useUser();
  const { profile } = useProfile();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [doctrine, setDoctrine] = useState('');
  const [memories, setMemories] = useState<{content: string}[]>([]);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [closeStreak, setCloseStreak] = useState(0);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [showOutcomeBtns, setShowOutcomeBtns] = useState(false);

  // Refs for audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const ttsPlayingRef = useRef(false);

  // Refs for legacy push-to-talk fallback
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Refs for Web Speech API hands-free
  const recognitionRef = useRef<any>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionMessagesRef = useRef<Message[]>([]);

  // Refs to avoid stale closures in async callbacks
  const handsFreeRef = useRef(false);
  const loadingRef = useRef(false);
  const doctrineRef = useRef('');
  const activeJobRef = useRef<Job | null>(null);
  const memoriesRef = useRef<{content: string}[]>([]);
  const geoRef = useRef<{lat: number; lng: number} | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const accentColor = activeJob ? (JOB_TYPE_COLORS[activeJob.job_type] || '#f07a2e') : '#f07a2e';

  const bustDoctrine = async () => {
    if (!user) return;
    const key = `remy_doctrine_${user.id}`;
    localStorage.removeItem(key);
    const fresh = await getCachedDoctrine(user.id);
    setDoctrine(fresh);
    doctrineRef.current = fresh;
  };

  useEffect(() => {
    if (!isLoaded || !user) return;
    initPage();
  }, [isLoaded, user, profile]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Keep refs in sync
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { doctrineRef.current = doctrine; }, [doctrine]);
  useEffect(() => { activeJobRef.current = activeJob; }, [activeJob]);
  useEffect(() => { memoriesRef.current = memories; }, [memories]);

  // Session persistence — save on every message update
  useEffect(() => {
    if (!user || messages.length === 0) return;
    try {
      localStorage.setItem(`remy_session_${user.id}`, JSON.stringify({
        messages: messages.slice(-20),
        jobId: activeJobRef.current?.id,
        ts: Date.now(),
      }));
    } catch {}
  }, [messages]);

  const initPage = async () => {
    const clerkId = user!.id;
    const companyId = profile?.company_id;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { geoRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    const [jobData, doctrine, memData, notesData] = await Promise.all([
      fetch(`/api/jobs?clerkId=${clerkId}`).then(r => r.json()).then(d => d.jobs || []).catch(() => []),
      getCachedDoctrine(clerkId),
      fetch(`/api/memory?repId=${clerkId}`).then(r => r.json()).catch(() => ({ memories: [] })),
      fetch(`/api/notes?repId=${clerkId}`).then(r => r.json()).catch(() => ({ notes: [] })),
    ]);

    setJobs(jobData);
    setDoctrine(doctrine);
    setMemories(memData.memories || []);
    const pendingFollowUps = (notesData.notes || []).filter((n: any) => n.follow_up_date);
    setFollowUpCount(pendingFollowUps.length);

    // Compute close streak from rep_memory
    const closedMems = (memData.memories || []).filter((m: any) => m.source === 'outcome' && m.content?.includes('CLOSED'));
    const closeDays = new Set(closedMems.map((m: any) => new Date(m.created_at).toDateString()));
    let streak = 0;
    const sd = new Date();
    while (closeDays.has(sd.toDateString())) { streak++; sd.setDate(sd.getDate() - 1); }
    setCloseStreak(streak);

    // Restore session from localStorage if it's fresh (same day)
    try {
      const raw = localStorage.getItem(`remy_session_${clerkId}`);
      if (raw) {
        const { messages: saved, jobId, ts } = JSON.parse(raw);
        if (Date.now() - ts < SESSION_TTL && saved?.length > 0) {
          const savedJob = jobId ? jobData.find((j: Job) => j.id === jobId) : null;
          if (savedJob) setActiveJob(savedJob);
          setMessages(saved);
          sessionMessagesRef.current = saved;
          return;
        }
      }
    } catch {}

    // Return prompt: if rep was briefed on a job recently but no outcome logged today, ask how it went
    try {
      const lastBriefRaw = localStorage.getItem(`remy_last_brief_${clerkId}`);
      if (lastBriefRaw) {
        const { jobId: lastJobId, jobName: lastJobName, ts: briefTs } = JSON.parse(lastBriefRaw);
        const elapsed = Date.now() - briefTs;
        if (elapsed > 5 * 60 * 1000 && elapsed < 8 * 60 * 60 * 1000) {
          const todayStr = new Date().toDateString();
          const hasOutcomeToday = (memData.memories || []).some((m: any) => m.source === 'outcome' && new Date(m.created_at).toDateString() === todayStr);
          if (!hasOutcomeToday) {
            const foundJob = jobData.find((j: Job) => j.id === lastJobId);
            if (foundJob) {
              setActiveJob(foundJob);
              activeJobRef.current = foundJob;
              setShowOutcomeBtns(true);
              setMessages([{ role: 'assistant', content: `You're back. How'd it go with ${lastJobName}? Tap an outcome below or tell me what happened.` }]);
              return;
            }
          }
        }
      }
    } catch {}

    const jobId = searchParams.get('jobId');
    if (jobId && jobData.length > 0) {
      const found = jobData.find((j: Job) => j.id === jobId);
      if (found) {
        setActiveJob(found);
        setMessages([{ role: 'assistant', content: `${found.customer_name} loaded. Tap Brief Me when you are ready.` }]);
        return;
      }
    }

    const streakNote = streak >= 3 ? ` ${streak}-day streak — let's keep it going.` : '';
    if (jobData.length > 0) {
      const fuNote = pendingFollowUps.length > 0 ? ` ${pendingFollowUps.length} follow-up${pendingFollowUps.length > 1 ? 's' : ''} pending too.` : '';
      setMessages([{ role: 'assistant', content: `Hey.${streakNote} ${jobData.length} active job${jobData.length > 1 ? 's' : ''} today.${fuNote} Select a job or tap Brief My Day.` }]);
    } else {
      const fuNote = pendingFollowUps.length > 0 ? ` But ${pendingFollowUps.length} follow-up${pendingFollowUps.length > 1 ? 's' : ''} pending — check Field Notes.` : ' Create one in Jobs and I will brief you before you knock.';
      setMessages([{ role: 'assistant', content: `Hey.${streakNote} No active jobs yet.${fuNote}` }]);
    }
  };

  // ─── TTS queue — plays audio in order, starts immediately when first chunk is ready ───

  const playNextInQueue = () => {
    if (audioQueueRef.current.length === 0) {
      ttsPlayingRef.current = false;
      setSpeaking(false);
      if (handsFreeRef.current && !loadingRef.current) {
        setTimeout(() => startVADListening(), 400);
      }
      return;
    }
    ttsPlayingRef.current = true;
    setSpeaking(true);
    const url = audioQueueRef.current.shift()!;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; playNextInQueue(); };
    audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; playNextInQueue(); };
    audio.play().catch(() => { URL.revokeObjectURL(url); playNextInQueue(); });
  };

  const enqueueTTS = async (text: string) => {
    if (!text.trim()) return;
    try {
      const savedVoice = typeof window !== 'undefined' ? localStorage.getItem('remy_voice') || undefined : undefined;
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: savedVoice }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioQueueRef.current.push(url);
      if (!ttsPlayingRef.current) playNextInQueue();
    } catch {}
  };

  const stopSpeaking = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    audioQueueRef.current = [];
    ttsPlayingRef.current = false;
    setSpeaking(false);
  };

  // ─── Streaming doSend ───

  const doSend = async (text: string, currentMessages: Message[], currentDoctrine: string, currentJob: Job | null, currentMemories: {content: string}[]) => {
    const jobContext = currentJob
      ? `Customer: ${currentJob.customer_name}\nAddress: ${currentJob.address || 'Not provided'}\nNotes: ${currentJob.notes || 'None'}\nJob type: ${currentJob.job_type || 'General'}${currentJob.deal_value ? `\nDeal value: $${currentJob.deal_value.toLocaleString()}` : ''}`
      : '';

    const userMsg: Message = { role: 'user', content: text };
    const withPlaceholder: Message[] = [...currentMessages, userMsg, { role: 'assistant', content: '' }];
    setMessages(withPlaceholder);
    sessionMessagesRef.current = [...currentMessages, userMsg];
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...currentMessages, userMsg], doctrine: currentDoctrine, jobContext, memories: currentMemories, repId: user?.id, jobId: currentJob?.id, userLat: geoRef.current?.lat, userLng: geoRef.current?.lng }),
      });

      if (!res.ok || !res.body) throw new Error('Bad response');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let sentenceBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        sentenceBuffer += chunk;

        // Update the live message bubble as text streams in
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: fullText };
          return updated;
        });

        // Extract completed sentences and pipeline them to TTS immediately
        const parts = sentenceBuffer.split(/(?<=[.!?])\s+/);
        if (parts.length > 1) {
          for (let i = 0; i < parts.length - 1; i++) {
            if (parts[i].trim().length > 5) enqueueTTS(parts[i].trim());
          }
          sentenceBuffer = parts[parts.length - 1];
        }
      }

      // Flush any remaining text
      if (sentenceBuffer.trim().length > 5) enqueueTTS(sentenceBuffer.trim());

      const finalMessages: Message[] = [...currentMessages, userMsg, { role: 'assistant', content: fullText }];
      setMessages(finalMessages);
      sessionMessagesRef.current = finalMessages;

      if (user) {
        fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: currentJob?.id, repId: user.id, messages: finalMessages, summary: fullText.slice(0, 200) }),
        }).catch(() => {});
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Connection issue. Try again.' };
        return updated;
      });
    }
    setLoading(false);
    // Show quick outcome buttons after any response when a job is active
    if (activeJobRef.current) setShowOutcomeBtns(true);
  };

  // ─── Photo damage analysis via Claude Vision ───

  const doSendPhoto = async (base64: string, mediaType: string) => {
    const currentDoctrine = doctrineRef.current;
    const currentJob = activeJobRef.current;
    const currentMemories = memoriesRef.current;
    const currentMessages = sessionMessagesRef.current;

    const jobContext = currentJob
      ? `Customer: ${currentJob.customer_name}\nAddress: ${currentJob.address || 'Not provided'}\nNotes: ${currentJob.notes || 'None'}\nJob type: ${currentJob.job_type || 'General'}${currentJob.deal_value ? `\nDeal value: $${currentJob.deal_value.toLocaleString()}` : ''}`
      : '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...currentMessages,
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
                { type: 'text', text: `I just took this photo at the job site${currentJob ? ` for ${currentJob.customer_name}` : ''}. Analyze what you see. Tell me: what damage or issues are visible, how serious is it, and give me 2 to 3 talking points I can use right now at the door.` }
              ]
            }
          ],
          doctrine: currentDoctrine,
          jobContext,
          memories: currentMemories,
          repId: user?.id,
          jobId: currentJob?.id,
          userLat: geoRef.current?.lat,
          userLng: geoRef.current?.lng,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Bad response');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let sentenceBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        sentenceBuffer += chunk;

        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: fullText };
          return updated;
        });

        const parts = sentenceBuffer.split(/(?<=[.!?])\s+/);
        if (parts.length > 1) {
          for (let i = 0; i < parts.length - 1; i++) {
            if (parts[i].trim().length > 5) enqueueTTS(parts[i].trim());
          }
          sentenceBuffer = parts[parts.length - 1];
        }
      }

      if (sentenceBuffer.trim().length > 5) enqueueTTS(sentenceBuffer.trim());

      const userDisplayMsg: Message = { role: 'user', content: '📷 Photo sent for analysis' };
      const finalMessages: Message[] = [...currentMessages, userDisplayMsg, { role: 'assistant', content: fullText }];
      setMessages(finalMessages);
      sessionMessagesRef.current = finalMessages;
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Could not analyze the photo. Try again.' };
        return updated;
      });
    }
    setLoading(false);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo is too large. Please use a photo under 5MB.');
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      const mediaType = file.type || 'image/jpeg';
      const placeholder: Message = { role: 'user', content: '📷 Analyzing photo...' };
      const withPlaceholder: Message[] = [...sessionMessagesRef.current, placeholder, { role: 'assistant', content: '' }];
      setMessages(withPlaceholder);
      setLoading(true);
      doSendPhoto(base64, mediaType);
    };
    reader.readAsDataURL(file);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // ─── Hands-free VAD via Web Speech API ───

  const startVADListening = () => {
    if (loadingRef.current || listening) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { startListening(); return; }
    try {
      const recognition = new SR();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setListening(true);
      recognition.onresult = (e: any) => {
        const last = e.results[e.results.length - 1];
        const transcript = last[0].transcript;
        if (!last.isFinal) { setInput(transcript); return; }
        recognitionRef.current = null;
        setListening(false);
        setInput('');
        if (transcript.trim()) {
          doSend(transcript, sessionMessagesRef.current, doctrineRef.current, activeJobRef.current, memoriesRef.current);
        }
      };
      recognition.onerror = () => { setListening(false); setInput(''); recognitionRef.current = null; };
      recognition.onend = () => { setListening(false); setInput(''); recognitionRef.current = null; };
      recognition.start();
      setListening(true);
    } catch { startListening(); }
  };

  const stopVADListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInput('');
  };

  const toggleHandsFree = () => {
    const next = !handsFree;
    setHandsFree(next);
    if (next && !loading && !speaking) setTimeout(() => startVADListening(), 200);
    else if (!next) stopVADListening();
  };

  // ─── Push-to-talk fallback (MediaRecorder + Deepgram) ───

  const startListening = async () => {
    try {
      if (speaking) stopSpeaking();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribe(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setListening(true);
      setTimeout(() => { if (mediaRecorderRef.current?.state === 'recording') stopListening(); }, 8000);
    } catch { alert('Microphone access needed.'); }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    setListening(false);
  };

  const transcribe = async (blob: Blob) => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append('audio', blob, 'recording.webm');
      const res = await fetch('/api/transcribe', { method: 'POST', body: form });
      const data = await res.json();
      if (data.text?.trim()) await doSend(data.text, sessionMessagesRef.current, doctrineRef.current, activeJobRef.current, memoriesRef.current);
      else setLoading(false);
    } catch { setLoading(false); }
  };

  const saveSession = async () => {
    if (!user || sessionMessagesRef.current.length < 2) return;
    try {
      await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: sessionMessagesRef.current, repId: user.id, jobContext: activeJob?.customer_name }),
      });
    } catch {}
  };

  useEffect(() => {
    window.addEventListener('beforeunload', saveSession);
    return () => { window.removeEventListener('beforeunload', saveSession); saveSession(); };
  }, []);

  // AirPods / headphone media controls via MediaSession API
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'Remy', artist: 'Field Co-pilot' });
    navigator.mediaSession.setActionHandler('play', () => {
      if (!loadingRef.current && !ttsPlayingRef.current) startVADListening();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      stopSpeaking();
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setListening(false);
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      const next = !handsFreeRef.current;
      handsFreeRef.current = next;
      setHandsFree(next);
      if (next && !loadingRef.current && !ttsPlayingRef.current) setTimeout(() => startVADListening(), 200);
      else { recognitionRef.current?.stop(); recognitionRef.current = null; setListening(false); }
    });
    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = (speaking || listening) ? 'playing' : 'paused';
  }, [speaking, listening]);

  const logOutcome = (outcome: 'won' | 'lost' | 'followup') => {
    setShowOutcomeBtns(false);
    const msgs: Record<string, string> = {
      won: `We closed it. They signed.`,
      lost: `No sale. They passed.`,
      followup: `They want to think about it. Follow up next week.`,
    };
    doSend(msgs[outcome], sessionMessagesRef.current, doctrineRef.current, activeJobRef.current, memoriesRef.current);
  };

  const briefJob = () => {
    if (!activeJob) return;
    setShowOutcomeBtns(false);
    doSend(
      `Brief me fast. Pulling up to ${activeJob.customer_name}${activeJob.address ? ` at ${activeJob.address}` : ''}${activeJob.notes ? `. Notes: ${activeJob.notes}` : ''}.`,
      sessionMessagesRef.current, doctrineRef.current, activeJob, memoriesRef.current
    );
  };

  const briefDay = () => {
    const jobList = jobs.slice(0, 5).map(j => `${j.customer_name}${j.address ? ` at ${j.address}` : ''}${j.deal_value ? ` ($${j.deal_value.toLocaleString()})` : ''}`).join(', ');
    const pipelineVal = jobs.reduce((sum, j) => sum + (j.deal_value || 0), 0);
    const fuNote = followUpCount > 0 ? ` ${followUpCount} follow-up${followUpCount > 1 ? 's' : ''} pending.` : '';
    const pipeNote = pipelineVal > 0 ? ` Total pipeline today: $${pipelineVal.toLocaleString()}.` : '';
    doSend(`Give me a quick morning brief.${fuNote}${pipeNote} I have ${jobs.length} active job${jobs.length !== 1 ? 's' : ''} today: ${jobList}. What should I know to start strong?`, sessionMessagesRef.current, doctrineRef.current, null, memoriesRef.current);
  };

  return (
    <div style={{ background: '#0b0f14', height: '100vh', display: 'flex', flexDirection: 'column', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .job-picker { position:absolute; top:100%; left:0; right:0; background:#111820; border:1px solid rgba(255,255,255,0.1); border-radius:12px; margin-top:8px; overflow:hidden; z-index:200; box-shadow:0 20px 40px rgba(0,0,0,0.4); }
        .job-option { padding:12px 16px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; align-items:center; gap:10px; }
        .job-option:hover { background:rgba(255,255,255,0.03); }
        .job-option:last-child { border-bottom:none; }
        .mic-btn { width:56px; height:56px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-family:'DM Sans',sans-serif; font-weight:600; font-size:0.75rem; transition:all 0.2s; flex-shrink:0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes ripple { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.8);opacity:0} }
        .pulsing { animation: pulse 1s infinite; }
        .ripple::after { content:''; position:absolute; inset:0; border-radius:50%; border:2px solid currentColor; animation:ripple 1.2s infinite; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${accentColor}22`, background: 'rgba(11,15,20,0.98)', position: 'relative', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link href="/dashboard" style={{ fontFamily: "'Syne',sans-serif", fontSize: '1.1rem', fontWeight: 800, textDecoration: 'none', color: '#e8edf2' }}>
            {(profile?.companies as any)?.agent_name || 'Remy'}<span style={{ color: accentColor }}>.</span>
          </Link>
          {closeStreak >= 3 && (
            <span title={`${closeStreak}-day close streak`} style={{ fontSize: '0.62rem', fontWeight: 700, color: '#f1c40f', background: 'rgba(241,196,15,0.1)', border: '1px solid rgba(241,196,15,0.25)', borderRadius: '20px', padding: '2px 8px', letterSpacing: '0.04em' }}>
              &#128293; {closeStreak}d
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <button
            onClick={toggleHandsFree}
            title={handsFree ? 'Hands-free ON — tap to disable' : 'Enable hands-free (no button needed)'}
            style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${handsFree ? accentColor + '66' : 'rgba(255,255,255,0.08)'}`, background: handsFree ? `${accentColor}18` : 'transparent', color: handsFree ? accentColor : '#3d5268', fontFamily: "'DM Sans',sans-serif", fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
            {handsFree ? (listening ? '● Listening' : '◎ Hands-Free') : 'Hands-Free'}
          </button>

          {speaking && (
            <button onClick={stopSpeaking} style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${accentColor}44`, background: `${accentColor}11`, color: accentColor, fontFamily: "'DM Sans',sans-serif", fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
              Stop
            </button>
          )}
          {!speaking && !listening && activeJob && (
            <button onClick={briefJob} style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${accentColor}44`, background: `${accentColor}11`, color: accentColor, fontFamily: "'DM Sans',sans-serif", fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Brief Me
            </button>
          )}
          {!speaking && !listening && !activeJob && jobs.length > 0 && (
            <button onClick={briefDay} style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(61,175,118,0.3)', background: 'rgba(61,175,118,0.08)', color: '#3daf76', fontFamily: "'DM Sans',sans-serif", fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Brief My Day
            </button>
          )}
          <div onClick={() => setShowJobPicker(!showJobPicker)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: activeJob ? `${accentColor}11` : 'rgba(255,255,255,0.04)', border: `1px solid ${activeJob ? accentColor + '33' : 'rgba(255,255,255,0.08)'}`, borderRadius: '100px', padding: '6px 12px', cursor: 'pointer', maxWidth: '140px' }}>
            {activeJob && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: accentColor, flexShrink: 0 }} />}
            <span style={{ fontSize: '0.72rem', color: activeJob ? accentColor : '#7a8fa4', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeJob ? activeJob.customer_name : '+ Job'}
            </span>
          </div>
          <button onClick={bustDoctrine} title="Refresh company playbook" style={{ padding: '6px 10px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#3d5268', fontFamily: "'DM Sans',sans-serif", fontSize: '0.7rem', cursor: 'pointer' }}>↻</button>
          <Link href="/dashboard" style={{ fontSize: '0.78rem', color: '#3d5268', textDecoration: 'none' }}>Back</Link>

          {showJobPicker && (
            <div className="job-picker" style={{ width: '280px', right: 0, left: 'auto' }}>
              {activeJob && (
                <div className="job-option" onClick={() => { setActiveJob(null); setShowJobPicker(false); }} style={{ color: '#c84a4a', fontSize: '0.82rem' }}>
                  Clear job
                </div>
              )}
              {jobs.map(job => {
                const color = JOB_TYPE_COLORS[job.job_type] || '#f07a2e';
                return (
                  <div key={job.id} className="job-option" onClick={() => { setActiveJob(job); activeJobRef.current = job; setShowJobPicker(false); try { localStorage.setItem(`remy_last_brief_${user!.id}`, JSON.stringify({ jobId: job.id, jobName: job.customer_name, ts: Date.now() })); } catch {} setTimeout(() => doSend(`Brief me fast. Pulling up to ${job.customer_name}${job.address ? ` at ${job.address}` : ''}${job.notes ? `. Notes: ${job.notes}` : ''}.`, sessionMessagesRef.current, doctrineRef.current, job, memoriesRef.current), 50); }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#e8edf2' }}>{job.customer_name}</div>
                      {job.address && <div style={{ fontSize: '0.72rem', color: '#3d5268', marginTop: '2px' }}>{job.address}</div>}
                    </div>
                    <span style={{ fontSize: '0.62rem', color, fontWeight: 600, textTransform: 'uppercase' }}>{job.job_type}</span>
                  </div>
                );
              })}
              {jobs.length === 0 && <div style={{ padding: '16px', color: '#3d5268', fontSize: '0.82rem' }}>No active jobs.</div>}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '8px' }}>
            {m.role === 'assistant' && (
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${accentColor}15`, border: `1px solid ${accentColor}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: accentColor, flexShrink: 0 }}>{((profile?.companies as any)?.agent_name || 'Remy')[0].toUpperCase()}</div>
            )}
            <div style={{ maxWidth: '78%', padding: '12px 16px', borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: m.role === 'user' ? '#1a2535' : `${accentColor}08`, border: `1px solid ${m.role === 'user' ? 'rgba(255,255,255,0.05)' : accentColor + '18'}`, fontSize: '0.92rem', lineHeight: 1.6, color: m.role === 'user' ? '#8a9db5' : '#e8edf2', fontWeight: 300 }}>
              {m.content || <span style={{ opacity: 0.3 }}>...</span>}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${accentColor}15`, border: `1px solid ${accentColor}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: accentColor }}>R</div>
            <div style={{ padding: '12px 16px', borderRadius: '18px 18px 18px 4px', background: `${accentColor}08`, border: `1px solid ${accentColor}18` }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0, 1, 2].map(i => <div key={i} className="pulsing" style={{ width: '6px', height: '6px', borderRadius: '50%', background: accentColor, animationDelay: `${i * 0.2}s` }} />)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick outcome buttons */}
      {showOutcomeBtns && activeJob && !loading && !speaking && (
        <div style={{ padding: '8px 16px', borderTop: `1px solid ${accentColor}10`, background: 'rgba(11,15,20,0.98)', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '0.62rem', color: '#3d5268', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>How&apos;d it go?</span>
          <button onClick={() => logOutcome('won')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid rgba(61,175,118,0.35)', background: 'rgba(61,175,118,0.08)', color: '#3daf76', fontFamily: "'DM Sans',sans-serif", fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Won it</button>
          <button onClick={() => logOutcome('lost')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid rgba(200,74,74,0.35)', background: 'rgba(200,74,74,0.08)', color: '#c84a4a', fontFamily: "'DM Sans',sans-serif", fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Lost it</button>
          <button onClick={() => logOutcome('followup')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid rgba(74,159,212,0.35)', background: 'rgba(74,159,212,0.08)', color: '#4a9fd4', fontFamily: "'DM Sans',sans-serif", fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Follow up</button>
          <button onClick={() => setShowOutcomeBtns(false)} style={{ padding: '8px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#2d3f52', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* Input */}
      <input type="file" ref={photoInputRef} accept="image/*" capture="environment" onChange={handlePhotoCapture} style={{ display: 'none' }} />
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${accentColor}15`, background: 'rgba(11,15,20,0.98)', display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={() => photoInputRef.current?.click()}
          title="Take a photo for damage analysis"
          disabled={loading || speaking}
          style={{ width: '44px', height: '44px', borderRadius: '50%', border: `1px solid rgba(255,255,255,0.08)`, background: 'rgba(255,255,255,0.03)', color: loading || speaking ? '#1e2a38' : '#3d5268', cursor: loading || speaking ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem', transition: 'all 0.2s' }}
        >
          &#128247;
        </button>
        {!handsFree && (
          <button
            className="mic-btn"
            onClick={listening ? stopListening : startListening}
            style={{ background: listening ? accentColor : `${accentColor}12`, border: `1.5px solid ${listening ? accentColor : accentColor + '33'}`, color: listening ? '#fff' : accentColor }}
          >
            {listening ? 'Done' : 'Mic'}
          </button>
        )}
        {handsFree && (
          <button
            className={`mic-btn${listening ? ' pulsing ripple' : ''}`}
            onClick={listening ? stopVADListening : startVADListening}
            style={{ position: 'relative', background: listening ? accentColor : `${accentColor}08`, border: `1.5px solid ${listening ? accentColor : accentColor + '22'}`, color: listening ? '#fff' : `${accentColor}66` }}
          >
            {listening ? '●' : '◎'}
          </button>
        )}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && input.trim()) doSend(input, sessionMessagesRef.current, doctrineRef.current, activeJobRef.current, memoriesRef.current); }}
          placeholder={listening ? 'Listening...' : speaking ? 'Speaking...' : 'Type or tap mic...'}
          disabled={listening}
          style={{ flex: 1, background: '#111820', border: `1px solid ${accentColor}18`, borderRadius: '24px', padding: '12px 18px', color: '#e8edf2', fontFamily: "'DM Sans',sans-serif", fontSize: '0.92rem', outline: 'none' }}
        />
        <button
          onClick={() => { if (input.trim()) doSend(input, sessionMessagesRef.current, doctrineRef.current, activeJobRef.current, memoriesRef.current); }}
          disabled={!input.trim() || loading}
          style={{ padding: '12px 20px', background: input.trim() ? accentColor : 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '24px', color: input.trim() ? '#fff' : '#3d5268', fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', fontWeight: 500, cursor: input.trim() ? 'pointer' : 'default', transition: 'all 0.2s' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default function VoicePage() {
  return (
    <Suspense fallback={<div style={{ background: '#0b0f14', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d5268', fontFamily: 'monospace' }}>Loading...</div>}>
      <VoicePageInner />
    </Suspense>
  );
}
