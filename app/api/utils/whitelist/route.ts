import { NextRequest, NextResponse } from 'next/server';

// GET /api/utils/whitelist?nip=XXXXXXXXXX
// Sprawdza NIP na Białej Liście VAT (MF API)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nip = (searchParams.get('nip') ?? '').replace(/[\s\-]/g, '');

  if (!/^\d{10}$/.test(nip)) {
    return NextResponse.json({ found: null, subjects: [] });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const url = `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${today}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return NextResponse.json({ found: false, subjects: [] });
    const data = await res.json();
    const subjects = data?.result?.subjects ?? [];
    return NextResponse.json({ found: subjects.length > 0, subjects });
  } catch {
    return NextResponse.json({ found: null, subjects: [] });
  }
}
