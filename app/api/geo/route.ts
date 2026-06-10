import { NextRequest, NextResponse } from 'next/server';

// Geo proxy for the mobile app — keeps the Maps key server-side.
// Actions: geocode (address) | nearby (lat, lng, type)
const MAPS_KEY = process.env.GOOGLE_MAPS_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  try {
    if (action === 'geocode') {
      const address = searchParams.get('address') || '';
      if (!address || address.length > 300) {
        return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
      }
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`);
      const data = await res.json();
      return NextResponse.json({ location: data.results?.[0]?.geometry?.location || null });
    }

    if (action === 'nearby') {
      const lat = parseFloat(searchParams.get('lat') || '');
      const lng = parseFloat(searchParams.get('lng') || '');
      const type = (searchParams.get('type') || 'restaurant').replace(/[^a-z_]/g, '');
      if (!isFinite(lat) || !isFinite(lng)) {
        return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
      }
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=3000&type=${type}&key=${MAPS_KEY}`);
      const data = await res.json();
      const places = data.results?.slice(0, 4).map((p: any) => ({ name: p.name, vicinity: p.vicinity, rating: p.rating ?? null })) || [];
      return NextResponse.json({ places });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('Geo route error:', e);
    return NextResponse.json({ error: 'Geo lookup failed' }, { status: 500 });
  }
}
