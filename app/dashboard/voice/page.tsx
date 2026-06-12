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
const HANDS_FREE_PREF_KEY = 'remy_hands_free_mode';
const MIN_TTS_CHARS = 6;
const MAX_TTS_CHARS = 240;
const TTS_MAX_ATTEMPTS = 2;
// Tiny silent clip played inside a user gesture to "bless" the shared audio
// element — iOS then allows programmatic playback on that element afterwards.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

const DOCTRINE_TTL = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 hours — don't restore yesterday's session

type Message = { role: 'user' | 'assistant'; content: string };
type Job = { id: string; customer_name: string; address: string; notes: string; status: string; job_type: string; deal_value?: number; scheduled_at?: string; customer_phone?: string };

const formatApptTime = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return sameDay ? `${time} today` : `${time} on ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
};

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
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [ttsStatus, setTtsStatus] = useState('');
  const [gpsStatus, setGpsStatus] = useState<'off' | 'locating' | 'on'>('off');

  // Refs for audio — one persistent <audio> element, reused for every clip,
  // unlocked once inside a user gesture so iOS keeps allowing playback.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const currentUrlRef = useRef<string | null>(null);
  const audioQueueRef = useRef<{ url: string; text: string }[]>([]);
  const speakingRef = useRef(false);
  const ttsPlayingRef = useRef(false);
  const audioPlaybackBlockedRef = useRef(false);
  const ttsRequestQueueRef = useRef<string[]>([]);
  const isGeneratingTtsRef = useRef(false);
  const listeningRef = useRef(false);
  const micRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const geoWatchIdRef = useRef<number | null>(null);
  const geoRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Arrival detection: geocoded coords of the active job + hysteresis state
  const jobGeoRef = useRef<{ jobId: string; lat: number; lng: number } | null>(null);
  const arrivalStateRef = useRef<{ jobId: string; wasFar: boolean; fired: boolean } | null>(null);
  // Keep the screen awake during hands-free — a locked screen suspends the
  // mic and audio, silently ending Remy's session mid-day.
  const wakeLockRef = useRef<any>(null);
  const followUpsRef = useRef<{ summary?: string; follow_up_date?: string }[]>([]);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const setHandsFreeWithPreference = (next: boolean) => {
    setHandsFree(next);
    handsFreeRef.current = next;
    try {
      localStorage.setItem(HANDS_FREE_PREF_KEY, next ? '1' : '0');
    } catch {}
  };
  const isMobileSpeechSynthesisBlocked = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isNativeApp = /EdgiOS|Instagram|FBAN|FBAV/i.test(ua);
    return isNativeApp;
  };

  const canUseDeviceSpeech = () =>
    !isMobileSpeechSynthesisBlocked() &&
    typeof window !== 'undefined' &&
    'speechSynthesis' in window;

  const isNotAllowedPlaybackError = (err: unknown) => {
    return !!(
      err &&
      typeof err === 'object' &&
      (('name' in err && (err as { name?: unknown }).name === 'NotAllowedError') ||
        ('message' in err && typeof (err as { message?: unknown }).message === 'string' && (err as { message?: string }).message?.toLowerCase().includes('not allowed')))
    );
  };

  const ensureSpeechSynthesisReady = async () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    if (window.speechSynthesis.getVoices().length > 0) return true;

    return await new Promise<boolean>((resolve) => {
      let done = false;
      const onVoices = () => {
        if (done) return;
        done = true;
        window.speechSynthesis.removeEventListener('voiceschanged', onVoices as any);
        resolve(window.speechSynthesis.getVoices().length > 0);
      };
      setTimeout(() => {
        if (done) return;
        done = true;
        window.speechSynthesis.removeEventListener('voiceschanged', onVoices as any);
        resolve(false);
      }, 900);
      window.speechSynthesis.addEventListener('voiceschanged', onVoices as any);
    });
  };

  const accentColor = activeJob ? (JOB_TYPE_COLORS[activeJob.job_type] || '#f07a2e') : '#f07a2e';

  const parseOutcomeFromText = (text: string): 'won' | 'lost' | 'followup' | null => {
    const value = text.toLowerCase();
    if (/(\bwin\b|\bwon\b|\bsigned\b|\bbooked\b|\bclosed\b|\bwe\s+got\s+it\b)/.test(value)) return 'won';
    if (/(\bno\s+sale\b|\blost\b|\bnot\s+interested\b|\bnot\s+moving\b|\bdecline\b|\bnot\s+going\s+to\s+buy\b|\bgave\s+up\b)/.test(value)) return 'lost';
    if (/(\bfollow\s*up\b|\bcall\s+back\b|\bmaybe\s+later\b|\blet\s+me\s+think\b|\bconsider\s+it\b|\bcome\s+back\s+later\b)/.test(value)) return 'followup';
    return null;
  };

  // Strict turn-taking: the mic may only reopen once the ENTIRE speech
  // pipeline is drained. An open SpeechRecognition session grabs the audio
  // session on iOS and mutes/ducks playback — opening the mic while Remy is
  // generating or speaking is what makes hands-free go silent.
  const speechPipelineIdle = () =>
    !loadingRef.current &&
    !listeningRef.current &&
    !ttsPlayingRef.current &&
    !isGeneratingTtsRef.current &&
    audioQueueRef.current.length === 0 &&
    ttsRequestQueueRef.current.length === 0;

  const queueHandsFreeRestart = (delay = 350) => {
    if (!handsFreeRef.current) return;
    if (micRestartTimerRef.current) clearTimeout(micRestartTimerRef.current);
    micRestartTimerRef.current = setTimeout(() => {
      micRestartTimerRef.current = null;
      if (handsFreeRef.current && speechPipelineIdle()) startVADListening();
    }, delay);
  };

  const speakWithDeviceFallback = async (text: string): Promise<boolean> => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    const ready = await ensureSpeechSynthesisReady();
    if (!ready) return false;
    return new Promise<boolean>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      let done = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const finalize = (value: boolean) => {
        if (done) return;
        done = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        ttsPlayingRef.current = false;
        setSpeaking(false);
        resolve(value);
      };

      utterance.lang = 'en-US';
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => finalize(true);
      utterance.onerror = () => finalize(false);
      utterance.onstart = () => {
        ttsPlayingRef.current = true;
        setSpeaking(true);
      };
      const timeoutMs = Math.min(Math.max(text.length * 28, 2500), 12000);

      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        timeoutId = setTimeout(() => finalize(false), timeoutMs);
      } catch {
        finalize(false);
      }
    });
  };

  const speakWithFallback = async (text: string, reason: string): Promise<boolean> => {
    const fallbackText = text.replace(/\s+/g, ' ').trim();
    if (!fallbackText) return false;
    if (!handsFreeRef.current || !canUseDeviceSpeech() || ttsPlayingRef.current) return false;
    const fallbackReason = `Fallback: ${reason}`;
    setTtsStatus(fallbackReason);
    const result = await speakWithDeviceFallback(fallbackText);
    if (!result) setTtsStatus(`Fallback failed (${reason}). Trying next line.`);
    return result;
  };

  const getUsageHeaderNumber = (value: string | null): number | null => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const updateTtsUsageBanner = (res: Response) => {
    const plan = res.headers.get('X-Remy-Voice-Plan');
    const allowed = getUsageHeaderNumber(res.headers.get('X-Remy-Voice-Allowed'));
    const used = getUsageHeaderNumber(res.headers.get('X-Remy-Voice-Used'));
    const overage = getUsageHeaderNumber(res.headers.get('X-Remy-Voice-Overage'));
    const remaining = getUsageHeaderNumber(res.headers.get('X-Remy-Voice-Remaining-Included'));
    if (plan && allowed !== null && used !== null && remaining !== null) {
      if (overage && overage > 0) {
        setTtsStatus(`Voice usage: ${plan} plan, ${used}/${allowed} included + ${overage} overage this month.`);
        return;
      }
      if (remaining <= 1000) {
        setTtsStatus(`Voice usage: ${used}/${allowed} included this month (${plan} plan).`);
        return;
      }
      if (ttsStatus && ttsStatus.startsWith('Voice usage:') && remaining > 1000) {
        setTtsStatus('');
      }
    }
  };

  const handleSpokenText = (text: string) => {
    const quickOutcome = parseOutcomeFromText(text);
    if (quickOutcome && handsFreeRef.current && activeJobRef.current) {
      logOutcome(quickOutcome);
      return;
    }
    doSend(text, sessionMessagesRef.current, doctrineRef.current, activeJobRef.current, memoriesRef.current);
  };

  const acquireWakeLock = async () => {
    try {
      if (typeof navigator === 'undefined' || !('wakeLock' in navigator) || wakeLockRef.current) return;
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      wakeLockRef.current?.addEventListener?.('release', () => { wakeLockRef.current = null; });
    } catch {}
  };

  const releaseWakeLock = () => {
    try { wakeLockRef.current?.release(); } catch {}
    wakeLockRef.current = null;
  };

  const metersBetween = (a: {lat: number; lng: number}, b: {lat: number; lng: number}) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  // Auto-brief on arrival: fires once per job, only after the rep has been
  // >400m away (hysteresis — selecting a job while parked at it won't fire).
  const checkArrival = () => {
    const pos = geoRef.current;
    const jg = jobGeoRef.current;
    const st = arrivalStateRef.current;
    const job = activeJobRef.current;
    if (!pos || !jg || !st || !job || jg.jobId !== job.id || st.jobId !== job.id || st.fired) return;
    const meters = metersBetween(pos, jg);
    if (meters > 400) { st.wasFar = true; return; }
    if (meters <= 200 && st.wasFar) {
      // Don't barge into an active exchange — next GPS tick will retry
      if (loadingRef.current || speakingRef.current || ttsPlayingRef.current || listeningRef.current) return;
      st.fired = true;
      doSend(
        `I just pulled up to ${job.customer_name}. Give me the 15-second pre-knock: who they are, the one thing to remember from the notes, and my opener.`,
        sessionMessagesRef.current, doctrineRef.current, job, memoriesRef.current
      );
    }
  };

  // ─── Live GPS — watch continuously, retry on transient failures ───
  // The old one-shot getCurrentPosition (5s timeout, no retry) is why Remy
  // sometimes had "0 GPS" all day: one cold fix failure blinded the session.

  const stopGeoWatch = () => {
    if (geoRetryTimerRef.current) { clearTimeout(geoRetryTimerRef.current); geoRetryTimerRef.current = null; }
    if (geoWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
  };

  const startGeoWatch = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation || geoWatchIdRef.current !== null) return;
    if (geoRef.current === null) setGpsStatus('locating');

    // Fast first fix: a 10-minute-old cached position beats nothing while
    // the high-accuracy watch warms up.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (geoRef.current === null) {
          geoRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setGpsStatus('on');
        }
      },
      () => {},
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 10 * 60 * 1000 }
    );

    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        geoRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsStatus('on');
        checkArrival();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          stopGeoWatch();
          geoRef.current = null;
          setGpsStatus('off');
          return;
        }
        // Timeout / temporarily unavailable: keep the last fix, restart the watch
        stopGeoWatch();
        if (geoRef.current === null) setGpsStatus('locating');
        geoRetryTimerRef.current = setTimeout(() => startGeoWatch(), 15000);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
    );
  };

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
    try {
      const pref = localStorage.getItem(HANDS_FREE_PREF_KEY);
      const prefHandsFree = pref === null ? true : pref === '1';
      if (pref === null) localStorage.setItem(HANDS_FREE_PREF_KEY, '1');
      setHandsFreeWithPreference(prefHandsFree);
    } catch {
      setHandsFreeWithPreference(false);
    }
    initPage();
  }, [isLoaded, user, profile]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Keep refs in sync
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => { listeningRef.current = listening; }, [listening]);

  // First tap anywhere unlocks audio playback for the session (iOS autoplay)
  useEffect(() => {
    const prime = () => primeAudio();
    window.addEventListener('pointerdown', prime, { once: true });
    window.addEventListener('touchstart', prime, { once: true });
    return () => {
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('touchstart', prime);
    };
  }, []);
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

    startGeoWatch();

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
    followUpsRef.current = pendingFollowUps.slice(0, 5);

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
          queueHandsFreeRestart();
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
              setMessages([{ role: 'assistant', content: `You're back. How'd it go with ${lastJobName}? Say won, lost, or follow-up. Otherwise tell me what happened.` }]);
              queueHandsFreeRestart();
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
        setShowOutcomeBtns(false);
        setMessages([{ role: 'assistant', content: `${found.customer_name} loaded. Starting quick brief and staying in ride mode.` }]);
        sessionMessagesRef.current = [];
        setTimeout(() => {
          doSend(
            `Brief me fast. Pulling up to ${found.customer_name}${found.address ? ` at ${found.address}` : ''}${found.notes ? `. Notes: ${found.notes}` : ''}.`,
            [],
            doctrine,
            found,
            memData.memories || []
          );
        }, 120);
        queueHandsFreeRestart();
        return;
      }
    }

    const streakNote = streak >= 3 ? ` ${streak}-day streak — let's keep it going.` : '';
    if (jobData.length > 0) {
      const fuNote = pendingFollowUps.length > 0 ? ` ${pendingFollowUps.length} follow-up${pendingFollowUps.length > 1 ? 's' : ''} pending too.` : '';
      setMessages([{ role: 'assistant', content: `Hey.${streakNote} ${jobData.length} active job${jobData.length > 1 ? 's' : ''} today.${fuNote} Select a job or tap Brief My Day.` }]);
      queueHandsFreeRestart();
    } else {
      const fuNote = pendingFollowUps.length > 0 ? ` But ${pendingFollowUps.length} follow-up${pendingFollowUps.length > 1 ? 's' : ''} pending — check Field Notes.` : ' Create one in Jobs and I will brief you before you knock.';
      setMessages([{ role: 'assistant', content: `Hey.${streakNote} No active jobs yet.${fuNote}` }]);
      queueHandsFreeRestart();
    }
  };

  // ─── TTS queue — plays audio in order, starts immediately when first chunk is ready ───

  const handleAudioDone = () => {
    if (currentUrlRef.current) { URL.revokeObjectURL(currentUrlRef.current); currentUrlRef.current = null; }
    playNextInQueue();
  };

  const getAudioEl = () => {
    if (!audioRef.current) {
      const el = new Audio();
      el.onended = handleAudioDone;
      el.onerror = handleAudioDone;
      audioRef.current = el;
    }
    return audioRef.current;
  };

  // Must be called from inside a user gesture (tap/click). Playing a silent
  // clip blesses the shared element so later programmatic .play() calls work.
  const primeAudio = () => {
    if (audioUnlockedRef.current || ttsPlayingRef.current) return;
    try {
      const el = getAudioEl();
      el.src = SILENT_WAV;
      el.play().then(() => { audioUnlockedRef.current = true; }).catch(() => {});
    } catch {}
  };

  const playNextInQueue = () => {
    if (audioQueueRef.current.length === 0) {
      ttsPlayingRef.current = false;
      setSpeaking(false);
      queueHandsFreeRestart();
      return;
    }
    ttsPlayingRef.current = true;
    setSpeaking(true);
    const item = audioQueueRef.current.shift()!;
    currentUrlRef.current = item.url;
    const el = getAudioEl();
    el.src = item.url;
    el.play().catch((err: any) => {
      if (isNotAllowedPlaybackError(err)) {
        // Autoplay blocked — KEEP the clip queued (don't revoke it!) so the
        // "Enable Audio" tap can replay it via resumeAudioPlayback. Revoking
        // here eats Remy's first reply and the unlock tap plays nothing.
        audioQueueRef.current.unshift(item);
        currentUrlRef.current = null;
        ttsPlayingRef.current = false;
        setSpeaking(false);
        audioPlaybackBlockedRef.current = true;
        setAudioPlaybackBlocked(true);
        setTtsStatus('Tap "Enable Audio" to hear Remy — the browser blocks sound until you interact.');
        return;
      }
      // Transient decode/abort error — skip this clip, keep the queue moving.
      URL.revokeObjectURL(item.url);
      currentUrlRef.current = null;
      const fallbackText = item.text;
      void (async () => {
        await speakWithFallback(fallbackText, 'audio playback failed');
        playNextInQueue();
      })();
    });
  };

  const resumeAudioPlayback = () => {
    // Runs inside a user gesture — playing here blesses the shared element.
    const wasBlocked = audioPlaybackBlockedRef.current;
    audioPlaybackBlockedRef.current = false;
    setAudioPlaybackBlocked(false);
    if (wasBlocked) setTtsStatus('');
    if (!ttsPlayingRef.current && audioQueueRef.current.length > 0) {
      audioUnlockedRef.current = true;
      playNextInQueue();
    } else {
      primeAudio();
    }
  };

  const enqueueTTS = async (text: string) => {
    if (!text.trim()) return;
    ttsRequestQueueRef.current.push(text.trim());
    if (!isGeneratingTtsRef.current) generateTtsQueue();
  };

  const generateTtsQueue = async () => {
    if (isGeneratingTtsRef.current) return;
    isGeneratingTtsRef.current = true;

    // Fetch one clip from /api/voice. Returns 'ok' (queued or handled),
    // 'retry' (transient failure), or 'fatal' (don't retry this text).
    const fetchClip = async (text: string): Promise<'ok' | 'retry' | 'fatal'> => {
      const savedVoice = typeof window !== 'undefined' ? localStorage.getItem('remy_voice') || undefined : undefined;
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: savedVoice }),
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type')?.toLowerCase() || '';
        if (!contentType.includes('audio') && !contentType.includes('octet-stream')) {
          // Never speak the raw response body aloud — it's JSON/HTML garbage.
          // Speak the rep's actual line with the device voice instead.
          if (await speakWithFallback(text, 'non-audio response')) {
            return 'ok';
          }
          setTtsStatus('Voice response came back as non-audio. Next reply should still proceed.');
          return 'fatal';
        }
        const blob = await res.blob();
        updateTtsUsageBanner(res);
        if (!blob.size) {
          if (await speakWithFallback('No audio returned from voice service. Skipping this line.', 'empty audio response')) {
            return 'ok';
          }
          return 'fatal';
        }
        const url = URL.createObjectURL(blob);
        audioQueueRef.current.push({ url, text });
        if (!ttsPlayingRef.current) playNextInQueue();
        return 'ok';
      }

      if (res.status === 402) {
        const plan = res.headers.get('X-Remy-Voice-Plan') || 'free';
        const allowed = getUsageHeaderNumber(res.headers.get('X-Remy-Voice-Allowed'));
        const used = getUsageHeaderNumber(res.headers.get('X-Remy-Voice-Used'));
        const usedText = used !== null ? used : '?';
        const allowedText = allowed !== null ? allowed : '?';
        setTtsStatus(`Voice limit reached for ${plan}: ${usedText}/${allowedText} used. Upgrade to keep hearing Remy.`);
        return 'fatal';
      }

      return res.status === 429 || res.status === 503 || res.status >= 500 ? 'retry' : 'fatal';
    };

    try {
      while (ttsRequestQueueRef.current.length > 0) {
        const text = ttsRequestQueueRef.current.shift()!;
        let done = false;
        for (let attempt = 1; attempt <= TTS_MAX_ATTEMPTS && !done; attempt++) {
          let result: 'ok' | 'retry' | 'fatal' = 'retry';
          try { result = await fetchClip(text); } catch { result = 'retry'; }
          if (result === 'ok' || result === 'fatal') {
            done = true;
          } else if (attempt < TTS_MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, 700 * attempt));
          } else {
            // Out of retries — speak with the device voice rather than going
            // silent, but only if nothing else is already playing.
            const fallbackPlayed = await speakWithFallback(text, 'service retry limit reached');
            if (!fallbackPlayed) {
              setTtsStatus('Voice service hiccup — skipped a line. Next reply will speak normally.');
            } else {
              setTtsStatus('');
            }
            done = true;
          }
        }
      }
    } finally {
      isGeneratingTtsRef.current = false;
      queueHandsFreeRestart();
    }
  };

  const enqueueSpeechText = (text: string): number => {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (!trimmed || trimmed.length < MIN_TTS_CHARS) return 0;
    if (trimmed.length <= MAX_TTS_CHARS) {
      enqueueTTS(trimmed);
      return 1;
    }
    let sent = 0;
    let remaining = trimmed;
    while (remaining.length > MAX_TTS_CHARS) {
      const chunk = remaining.slice(0, MAX_TTS_CHARS);
      let splitAt = chunk.lastIndexOf(' ');
      if (splitAt < MIN_TTS_CHARS) splitAt = MAX_TTS_CHARS;
      const head = remaining.slice(0, splitAt).trim();
      if (head) { enqueueTTS(head); sent++; }
      remaining = remaining.slice(splitAt).trim();
    }
    if (remaining.length >= MIN_TTS_CHARS) { enqueueTTS(remaining); sent++; }
    return sent;
  };

  useEffect(() => {
    if (!audioPlaybackBlocked) return;
    const unlock = () => resumeAudioPlayback();
    const onTouch = () => resumeAudioPlayback();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', onTouch, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', onTouch);
    };
  }, [audioPlaybackBlocked]);

  const stopSpeaking = () => {
    const el = audioRef.current;
    if (el) { el.pause(); el.removeAttribute('src'); }
    if (currentUrlRef.current) { URL.revokeObjectURL(currentUrlRef.current); currentUrlRef.current = null; }
    audioQueueRef.current.forEach(item => URL.revokeObjectURL(item.url));
    audioQueueRef.current = [];
    ttsRequestQueueRef.current = [];
    if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); }
    ttsPlayingRef.current = false;
    setSpeaking(false);
  };

  // ─── Streaming doSend ───

  const doSend = async (text: string, currentMessages: Message[], currentDoctrine: string, currentJob: Job | null, currentMemories: {content: string}[]) => {
    const jobContext = currentJob
      ? `Customer: ${currentJob.customer_name}\nAddress: ${currentJob.address || 'Not provided'}\nNotes: ${currentJob.notes || 'None'}\nJob type: ${currentJob.job_type || 'General'}${currentJob.deal_value ? `\nDeal value: $${currentJob.deal_value.toLocaleString()}` : ''}${formatApptTime(currentJob.scheduled_at) ? `\nAppointment: ${formatApptTime(currentJob.scheduled_at)}` : ''}`
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
        body: JSON.stringify({
          messages: [...currentMessages, userMsg],
          doctrine: currentDoctrine,
          jobContext,
          memories: currentMemories,
          repId: user?.id,
          jobId: currentJob?.id,
          userLat: geoRef.current?.lat,
          userLng: geoRef.current?.lng,
          isHandsFree: handsFreeRef.current,
          localHour: new Date().getHours(),
        }),
      });

      if (!res.ok || !res.body) throw new Error('Bad response');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let sentenceBuffer = '';
      let speechChunks = 0;

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
            speechChunks += enqueueSpeechText(parts[i]);
          }
          sentenceBuffer = parts[parts.length - 1];
        }
      }

      // Flush any remaining text; if the whole reply was too short to pass
      // the min-chars filter, speak it whole so short answers aren't silent.
      speechChunks += enqueueSpeechText(sentenceBuffer);
      if (speechChunks === 0 && fullText.trim()) enqueueTTS(fullText.trim().slice(0, MAX_TTS_CHARS));

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
    queueHandsFreeRestart();
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
      ? `Customer: ${currentJob.customer_name}\nAddress: ${currentJob.address || 'Not provided'}\nNotes: ${currentJob.notes || 'None'}\nJob type: ${currentJob.job_type || 'General'}${currentJob.deal_value ? `\nDeal value: $${currentJob.deal_value.toLocaleString()}` : ''}${formatApptTime(currentJob.scheduled_at) ? `\nAppointment: ${formatApptTime(currentJob.scheduled_at)}` : ''}`
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
          isHandsFree: handsFreeRef.current,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Bad response');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let sentenceBuffer = '';
      let speechChunks = 0;

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
            speechChunks += enqueueSpeechText(parts[i]);
          }
          sentenceBuffer = parts[parts.length - 1];
        }
      }

      speechChunks += enqueueSpeechText(sentenceBuffer);
      if (speechChunks === 0 && fullText.trim()) enqueueTTS(fullText.trim().slice(0, MAX_TTS_CHARS));

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
    queueHandsFreeRestart();
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
    // Never open the mic while Remy is loading, talking, or about to talk —
    // an active recognition session mutes media playback on iOS.
    if (loadingRef.current || listeningRef.current || recognitionRef.current) return;
    if (ttsPlayingRef.current || isGeneratingTtsRef.current || audioQueueRef.current.length > 0) return;
    if (micRestartTimerRef.current) { clearTimeout(micRestartTimerRef.current); micRestartTimerRef.current = null; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { startListening(); return; }
    try {
      const recognition = new SR();
      recognitionRef.current = recognition;
      listeningRef.current = true;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      // Zombie-session watchdog: iOS Safari sometimes keeps a recognition
      // session "open" but stops delivering results AND never fires onend —
      // the mic looks live but is dead. If nothing arrives for 20s, kill the
      // session ourselves and restart. Any result re-arms the timer.
      const clearWatchdog = () => {
        if (recWatchdogRef.current) { clearTimeout(recWatchdogRef.current); recWatchdogRef.current = null; }
      };
      const armWatchdog = () => {
        clearWatchdog();
        recWatchdogRef.current = setTimeout(() => {
          recWatchdogRef.current = null;
          if (recognitionRef.current !== recognition) return;
          try { recognition.abort(); } catch {}
          recognitionRef.current = null;
          listeningRef.current = false;
          setListening(false);
          setInput('');
          queueHandsFreeRestart(200);
        }, 20000);
      };
      armWatchdog();

      recognition.onstart = () => setListening(true);
      recognition.onresult = (e: any) => {
        armWatchdog();
        const allTranscript = Array.from(e.results)
          .map((result: any) => result[0]?.transcript || '')
          .join(' ')
          .trim();
        if (!allTranscript) return;
        setInput(allTranscript);
        const last = e.results[e.results.length - 1];
        if (!last.isFinal) return;
        clearWatchdog();
        recognitionRef.current = null;
        listeningRef.current = false;
        setListening(false);
        setInput('');
        handleSpokenText(allTranscript);
      };
      recognition.onerror = (e: any) => {
        clearWatchdog();
        listeningRef.current = false;
        setListening(false);
        setInput('');
        recognitionRef.current = null;
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed' || e?.error === 'audio-capture') {
          setHandsFreeWithPreference(false);
          return;
        }
        queueHandsFreeRestart(500);
      };
      recognition.onend = () => {
        clearWatchdog();
        listeningRef.current = false;
        setListening(false);
        setInput('');
        recognitionRef.current = null;
        queueHandsFreeRestart();
      };
      recognition.start();
      setListening(true);
    } catch {
      listeningRef.current = false;
      recognitionRef.current = null;
      startListening();
    }
  };

  const stopVADListening = () => {
    if (micRestartTimerRef.current) { clearTimeout(micRestartTimerRef.current); micRestartTimerRef.current = null; }
    if (recWatchdogRef.current) { clearTimeout(recWatchdogRef.current); recWatchdogRef.current = null; }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    listeningRef.current = false;
    setListening(false);
    setInput('');
  };

  // Manual mic tap = barge-in: cut Remy off and listen right away.
  const interruptAndListen = () => {
    primeAudio(); // user gesture — keep audio unlocked for her reply
    if (speakingRef.current || ttsPlayingRef.current) stopSpeaking();
    startVADListening();
  };

  const toggleHandsFree = () => {
    const next = !handsFree;
    setHandsFreeWithPreference(next);
    if (next) {
      primeAudio(); // user gesture — unlock audio for the whole session
      queueHandsFreeRestart(150);
    } else {
      stopVADListening();
    }
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
      if (data.text?.trim()) await handleSpokenText(data.text);
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

  // Stop the GPS watch when leaving the page
  useEffect(() => () => stopGeoWatch(), []);

  // Hold a screen wake lock while hands-free is on; release when it's off
  useEffect(() => {
    if (handsFree) acquireWakeLock();
    else releaseWakeLock();
    return () => releaseWakeLock();
  }, [handsFree]);

  // Liveness heartbeat: hands-free must never stay silently dead. Whatever
  // edge case kills the restart chain (zombie recognition, dropped event,
  // future regression), this revives the mic within ~5 seconds.
  useEffect(() => {
    const id = setInterval(() => {
      if (!handsFreeRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (micRestartTimerRef.current) return; // a restart is already scheduled
      if (speechPipelineIdle()) startVADListening();
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Backgrounding the tab kills the mic and auto-releases the wake lock.
  // Stop cleanly on hide; re-arm everything when the rep comes back.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (handsFreeRef.current) {
          acquireWakeLock();
          queueHandsFreeRestart(600);
        }
        startGeoWatch();
      } else {
        stopVADListening();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Geocode the active job once so arrival detection has a target
  useEffect(() => {
    jobGeoRef.current = null;
    arrivalStateRef.current = null;
    if (!activeJob?.id || !activeJob.address) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/geo?action=geocode&address=${encodeURIComponent(activeJob.address)}`);
        const data = await res.json();
        if (!cancelled && data.location?.lat && data.location?.lng) {
          jobGeoRef.current = { jobId: activeJob.id, lat: data.location.lat, lng: data.location.lng };
          arrivalStateRef.current = { jobId: activeJob.id, wasFar: false, fired: false };
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [activeJob?.id]);

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
      setHandsFreeWithPreference(next);
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

  const briefDay = async () => {
    // Jobs are usually scheduled by time (which lives in free-text notes),
    // so never hard-sort by distance. Instead hand Remy distance per job AND
    // the note snippets, and let her order the day: appointments first,
    // nearest-first to fill the gaps.
    const pos = geoRef.current;
    const distances = new Map<string, number>();
    if (pos && jobs.length > 1 && jobs.some(j => j.address)) {
      try {
        await Promise.all(jobs.slice(0, 6).map(async j => {
          if (!j.address) return;
          try {
            const r = await fetch(`/api/geo?action=geocode&address=${encodeURIComponent(j.address)}`).then(res => res.json());
            if (r.location?.lat) distances.set(j.id, metersBetween(pos, r.location) / 1609.34);
          } catch {}
        }));
      } catch {}
    }
    const jobList = jobs.slice(0, 5).map(j => {
      const mi = distances.get(j.id);
      const appt = formatApptTime(j.scheduled_at);
      const noteSnip = j.notes ? ` — notes: "${j.notes.slice(0, 80)}"` : '';
      return `${j.customer_name}${j.address ? ` at ${j.address}` : ''}${appt ? ` [appt ${appt}]` : ''}${mi !== undefined ? ` (~${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi from me)` : ''}${j.deal_value ? ` ($${j.deal_value.toLocaleString()})` : ''}${noteSnip}`;
    }).join('; ');
    const routeNote = distances.size > 0 || jobs.some(j => j.scheduled_at)
      ? ' Suggest my run order: appointment times anchor the day (the [appt] tags are exact; notes may mention others), fill the gaps nearest-first. BUT if the geography makes a swap clearly smarter (like I am right next to a later appointment), say so and tell me to call and flip them — name which two and why.'
      : '';
    const pipelineVal = jobs.reduce((sum, j) => sum + (j.deal_value || 0), 0);
    const fuDetails = followUpsRef.current
      .map(n => `${(n.summary || 'follow-up').slice(0, 60)}${n.follow_up_date ? ` (due ${n.follow_up_date})` : ''}`)
      .join('; ');
    const fuNote = followUpCount > 0 ? ` ${followUpCount} follow-up${followUpCount > 1 ? 's' : ''} pending${fuDetails ? `: ${fuDetails}` : '.'}` : '';
    const pipeNote = pipelineVal > 0 ? ` Total pipeline today: $${pipelineVal.toLocaleString()}.` : '';
    doSend(`Give me a quick morning brief.${fuNote}${pipeNote} I have ${jobs.length} active job${jobs.length !== 1 ? 's' : ''} today: ${jobList}.${routeNote} Work any due follow-ups into the plan. What should I know to start strong?`, sessionMessagesRef.current, doctrineRef.current, null, memoriesRef.current);
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
            onClick={() => { stopGeoWatch(); startGeoWatch(); }}
            title={gpsStatus === 'on' ? 'GPS locked — Remy knows where you are' : gpsStatus === 'locating' ? 'Getting GPS fix… tap to retry' : 'No GPS — tap to retry, or allow location for this site'}
            style={{ padding: '4px 7px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1, filter: gpsStatus === 'on' ? 'none' : 'grayscale(1)', opacity: gpsStatus === 'on' ? 1 : gpsStatus === 'locating' ? 0.7 : 0.4, transition: 'all 0.3s' }}
          >
            📍
          </button>
          {activeJob?.address && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeJob.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Navigate to ${activeJob.customer_name}`}
              style={{ padding: '4px 7px', borderRadius: '50%', textDecoration: 'none', fontSize: '0.85rem', lineHeight: 1 }}
            >
              🧭
            </a>
          )}
          {activeJob?.customer_phone && (
            <a
              href={`sms:${activeJob.customer_phone.replace(/[^+\d]/g, '')}?&body=${encodeURIComponent(`Hi ${activeJob.customer_name.split(' ')[0]}, it's ${(profile as any)?.full_name?.split(' ')[0] || 'your rep'}${(profile?.companies as any)?.name ? ` with ${(profile?.companies as any).name}` : ''} — on my way to you now.`)}`}
              title={`Text ${activeJob.customer_name}: on my way`}
              style={{ padding: '4px 7px', borderRadius: '50%', textDecoration: 'none', fontSize: '0.85rem', lineHeight: 1 }}
            >
              💬
            </a>
          )}
          {audioPlaybackBlocked && (
            <button
              onClick={resumeAudioPlayback}
              style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid #f1c40f44', background: '#f1c40f16', color: '#f39c12', fontFamily: "'DM Sans',sans-serif", fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Enable Audio
            </button>
          )}
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

      {ttsStatus && (
        <div style={{ padding: '6px 16px', background: '#1a2a3a', borderTop: `1px solid rgba(241,196,15,0.35)`, color: '#f39c12', fontSize: '0.72rem', fontWeight: 500 }}>
          {ttsStatus}
        </div>
      )}

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
            onClick={listening ? stopVADListening : interruptAndListen}
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
