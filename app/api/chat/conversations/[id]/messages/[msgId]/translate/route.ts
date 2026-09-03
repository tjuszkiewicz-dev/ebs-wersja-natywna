// POST /api/chat/conversations/[id]/messages/[msgId]/translate  { target?: 'pl' }
// Tłumaczenie na żądanie (spec E6 §4.6, D7). NIE jest portem — w BBS tłumaczenie czatu nie ma
// endpointu mimo kolumn w bazie. Pamięć podręczna w chat_messages.translated_*; AI-guard jak w E2d:
// brak klucza → 200 { ok:false, disabled:true }. Zwraca 200 z { ok:false, error } także dla limitu —
// brak tłumaczenia to nie awaria, UI ma pokazać powód.
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { requireChatAuth, isParticipant } from '@/lib/chat/server';
import { translateMessage } from '@/lib/chat/translate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; msgId: string }> }) {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, msgId } = await params;
  if (!(await isParticipant(id, auth.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const target = String(b?.target || 'pl').toLowerCase();

  const { data: msg } = await (admin() as any).from('chat_messages')
    .select('id, conversation_id, kind, content, translated_content, translated_lang, deleted_at')
    .eq('id', msgId).maybeSingle();
  if (!msg || msg.conversation_id !== id) return NextResponse.json({ error: 'Nie ma takiej wiadomości' }, { status: 404 });

  const r = await translateMessage(msg, target, auth);
  return NextResponse.json(r);
}
