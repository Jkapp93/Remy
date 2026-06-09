'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const PIN_STATUSES = [
  { key: 'knocked',    label: 'Knocked',    color: '#4a9fd4', bg: 'rgba(74,159,212,0.15)' },
  { key: 'interested', label: 'Interested', color: '#f07a2e', bg: 'rgba(240,122,46,0.15)' },
  { key: 'not_home',  label: 'Not Home',   color: '#f1c40f', bg: 'rgba(241,196,15,0.15)' },
  { key: 'sold',      label: 'Sold',       color: '#3daf76', bg: 'rgba(61,175,118,0.15)' },
  { key: 'skip',      label: 'Skip',       color: '#3d5268', bg: 'rgba(61,82,104,0.15)' },
];

interface CanvassPin {
  id: string;
  lat: number;
  lng: number;
  address: string;
  status: string;
  ts: number;
}

const STORAGE_KEY = 'remy_canvass_pins';

function loadPins(): CanvassPin[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function savePins(pins: CanvassPin[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pins)); } catch {}
}

export default function CanvassPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const [pins, setPins] = useState<CanvassPin[]>([]);
  const [selectedPin, setSelectedPin] = useState<CanvassPin | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    const loaded = loadPins();
    setPins(loaded);
    loadGoogleMaps();
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    setSessionName(today);
  }, []);

  const loadGoogleMaps = () => {
    if ((window as any).google?.maps) { initMap(); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) { existing.addEventListener('load', initMap); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = initMap;
    document.head.appendChild(script);
  };

  const initMap = () => {
    if (!mapRef.current) return;
    const google = (window as any).google;
    const map = new google.maps.Map(mapRef.current, {
      zoom: 17,
      mapTypeId: 'roadmap',
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1a2332' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#7a8fa4' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#0b0f14' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3f52' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111820' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      ],
    });
    mapInstanceRef.current = map;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, () => map.setCenter({ lat: 36.1699, lng: -115.1398 }));
    }

    map.addListener('click', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      dropPin(lat, lng, map);
    });

    setMapReady(true);
    // Plot existing pins
    setTimeout(() => {
      const stored = loadPins();
      stored.forEach(pin => addMarker(pin, map));
    }, 100);
  };

  const dropPin = async (lat: number, lng: number, map: any) => {
    const id = Date.now().toString();
    let address = '';
    try {
      const geocoder = new (window as any).google.maps.Geocoder();
      const result = await new Promise<any>((res) => geocoder.geocode({ location: { lat, lng } }, (r: any, s: any) => res(s === 'OK' ? r[0] : null)));
      address = result?.formatted_address?.split(',')[0] || '';
    } catch {}

    const pin: CanvassPin = { id, lat, lng, address, status: 'knocked', ts: Date.now() };
    const updated = [...loadPins(), pin];
    savePins(updated);
    setPins(updated);
    addMarker(pin, map);
    setSelectedPin(pin);
  };

  const addMarker = (pin: CanvassPin, map: any) => {
    const google = (window as any).google;
    const statusInfo = PIN_STATUSES.find(s => s.key === pin.status) || PIN_STATUSES[0];
    const marker = new google.maps.Marker({
      position: { lat: pin.lat, lng: pin.lng },
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: statusInfo.color,
        fillOpacity: 1,
        strokeColor: '#0b0f14',
        strokeWeight: 2,
      },
      title: pin.address || 'Pin',
    });
    marker.addListener('click', () => {
      const current = loadPins().find(p => p.id === pin.id);
      if (current) setSelectedPin(current);
    });
    markersRef.current[pin.id] = marker;
  };

  const updatePinStatus = (id: string, status: string) => {
    const updated = loadPins().map(p => p.id === id ? { ...p, status } : p);
    savePins(updated);
    setPins(updated);
    setSelectedPin(prev => prev?.id === id ? { ...prev, status } : prev);

    // Update marker color
    const google = (window as any).google;
    const marker = markersRef.current[id];
    const statusInfo = PIN_STATUSES.find(s => s.key === status) || PIN_STATUSES[0];
    if (marker && google) {
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: statusInfo.color,
        fillOpacity: 1,
        strokeColor: '#0b0f14',
        strokeWeight: 2,
      });
    }
  };

  const deletePin = (id: string) => {
    const updated = loadPins().filter(p => p.id !== id);
    savePins(updated);
    setPins(updated);
    setSelectedPin(null);
    const marker = markersRef.current[id];
    if (marker) { marker.setMap(null); delete markersRef.current[id]; }
  };

  const clearAll = () => {
    savePins([]);
    setPins([]);
    setSelectedPin(null);
    setShowClearConfirm(false);
    Object.values(markersRef.current).forEach((m: any) => m.setMap(null));
    markersRef.current = {};
  };

  const counts = PIN_STATUSES.reduce((acc, s) => {
    acc[s.key] = pins.filter(p => p.status === s.key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ background: '#0b0f14', height: '100vh', display: 'flex', flexDirection: 'column', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .status-btn { border: 1px solid; border-radius: 8px; padding: 10px 14px; font-family: 'DM Sans', sans-serif; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.15s; width: 100%; text-align: left; }
        .status-btn.active { opacity: 1; }
        .status-btn:not(.active) { opacity: 0.4; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(11,15,20,0.98)', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link href="/dashboard" style={{ color: '#3d5268', textDecoration: 'none', fontSize: '0.88rem' }}>Back</Link>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1rem' }}>Canvass — {sessionName}</div>
        </div>
        <button onClick={() => setShowClearConfirm(true)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '6px 12px', color: '#3d5268', fontFamily: "'DM Sans',sans-serif", fontSize: '0.75rem', cursor: 'pointer' }}>Clear All</button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '0', overflowX: 'auto', background: '#111820', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        {PIN_STATUSES.map(s => (
          <div key={s.key} style={{ flex: 1, minWidth: '64px', textAlign: 'center', padding: '8px 4px' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color, fontFamily: "'Syne',sans-serif" }}>{counts[s.key] || 0}</div>
            <div style={{ fontSize: '0.6rem', color: '#3d5268', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
        <div style={{ flex: 1, minWidth: '64px', textAlign: 'center', padding: '8px 4px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#e8edf2', fontFamily: "'Syne',sans-serif" }}>{pins.length}</div>
          <div style={{ fontSize: '0.6rem', color: '#3d5268', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Total</div>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        {!mapReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111820', flexDirection: 'column', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', border: '2px solid #f07a2e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ color: '#3d5268', fontSize: '0.82rem' }}>Loading map...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(11,15,20,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '8px 16px', fontSize: '0.72rem', color: '#3d5268', pointerEvents: 'none', backdropFilter: 'blur(10px)', whiteSpace: 'nowrap' }}>
          Tap anywhere on map to drop a pin
        </div>
      </div>

      {/* Pin status modal */}
      {selectedPin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }} onClick={() => setSelectedPin(null)}>
          <div style={{ width: '100%', background: '#111820', borderRadius: '16px 16px 0 0', padding: '20px 16px 32px', border: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1rem', marginBottom: '2px' }}>
                  {selectedPin.address || 'Pin'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#3d5268' }}>{new Date(selectedPin.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
              </div>
              <button onClick={() => deletePin(selectedPin.id)} style={{ background: 'rgba(200,74,74,0.1)', border: '1px solid rgba(200,74,74,0.2)', borderRadius: '6px', padding: '6px 12px', color: '#c84a4a', fontFamily: "'DM Sans',sans-serif", fontSize: '0.75rem', cursor: 'pointer' }}>Remove</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {PIN_STATUSES.map(s => (
                <button
                  key={s.key}
                  className={'status-btn' + (selectedPin.status === s.key ? ' active' : '')}
                  style={{ background: selectedPin.status === s.key ? s.bg : 'transparent', borderColor: selectedPin.status === s.key ? s.color : 'rgba(255,255,255,0.08)', color: selectedPin.status === s.key ? s.color : '#7a8fa4' }}
                  onClick={() => updatePinStatus(selectedPin.id, s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Clear confirm */}
      {showClearConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: '#111820', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '24px', maxWidth: '320px', width: '100%' }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, marginBottom: '8px' }}>Clear all pins?</div>
            <div style={{ color: '#7a8fa4', fontSize: '0.85rem', marginBottom: '20px' }}>This removes all {pins.length} pins from this session.</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={clearAll} style={{ flex: 1, padding: '11px', background: 'rgba(200,74,74,0.1)', border: '1px solid rgba(200,74,74,0.25)', borderRadius: '8px', color: '#c84a4a', fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', cursor: 'pointer' }}>Clear All</button>
              <button onClick={() => setShowClearConfirm(false)} style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#7a8fa4', fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
