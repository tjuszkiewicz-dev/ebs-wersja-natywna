// POST /api/chat/presence — „jestem tu" (heartbeat co ~2 min z otwartego komunikatora).
// Zapisuje user_profiles.last_seen_at (kolumna z migracji 053); katalog wylicza z tego
// status online / ostatnio widziany. Port z BBS-Unified (E6a): bramka + 403.
import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { requireChatAuth } from '@/lib/chat/server';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!isUuid(auth.id)) return NextResponse.json({ ok: true });   // konto testowe (nie-UUID)
  await (admin() as any).from('user_profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', auth.id);
  return NextResponse.json({ ok: true });
}
