'use client';
import { useState, useEffect } from 'react';

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('remy_install_dismissed')) return;

    const ua = navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    const isStandalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;

    if (isStandalone) return;

    setIsIOS(iosDevice);

    if (!iosDevice) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShow(true);
      };
      window.addEventListener('beforeinstallprompt', handler as EventListener);
      return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
    } else {
      // iOS Safari — show instructions after a short delay
      const t = setTimeout(() => setShow(true), 2500);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('remy_install_dismissed', '1');
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999,
      padding: '16px 20px', background: 'rgba(11,15,20,0.97)',
      borderTop: '1px solid rgba(240,122,46,0.25)',
      backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'flex-start', gap: '14px',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e8edf2', marginBottom: '4px' }}>
          Add Remy to your home screen
        </div>
        {isIOS ? (
          <div style={{ fontSize: '0.78rem', color: '#7a8fa4', lineHeight: 1.55 }}>
            Tap <span style={{ color: '#4a9fd4', fontWeight: 500 }}>Share</span> in Safari, then{' '}
            <span style={{ color: '#4a9fd4', fontWeight: 500 }}>Add to Home Screen</span> — works like a native app.
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: '#7a8fa4' }}>
            Install for the full app experience — instant launch, works offline.
          </div>
        )}
      </div>
      {!isIOS && (
        <button
          onClick={install}
          style={{ flexShrink: 0, padding: '8px 18px', background: '#f07a2e', border: 'none', borderRadius: '8px', color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Install
        </button>
      )}
      <button
        onClick={dismiss}
        style={{ flexShrink: 0, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 14px', color: '#3d5268', fontFamily: "'DM Sans',sans-serif", fontSize: '0.82rem', cursor: 'pointer' }}
      >
        {isIOS ? 'Got it' : 'Later'}
      </button>
    </div>
  );
}
