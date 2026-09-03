// PATCH /api/chat/conversations/[id]
//   { name }                                   → zmiana nazwy grupy (wspólna dla wszystkich)
//   { muted | pinned | archived | mark_unread } → ustawienia MOJE (per uczestnik)
// Port z BBS-Unified (E6a): bramka `komunikator.czat` + 403, audyt zmiany nazwy triggerem (K9).
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { requireChatAuth, isParticipant, participantIds } from '@/lib/chat/server';
import { notifyChatUsers } from '@/lib/chat/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!(await isParticipant(id, auth.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const b = await request.json().catch(() => null);
  if (!b) return NextResponse.json({ error: 'Nieprawidłowe dane' }, { status: 400 });
  const sb = admin() as any;

  // ── ustawienia moje (nie dotyczą pozostałych uczestników) ──
  const patch: Record<string, any> = {};
  if (typeof b.muted === 'boolean') patch.muted = b.muted;
  if (typeof b.pinned === 'boolean') patch.pinned = b.pinned;
  if (typeof b.archived === 'boolean') patch.archived = b.archived;
  // „oznacz jako nieprzeczytane" = cofnięcie znacznika odczytu przed ostatnią cudzą wiadomość
  if (b.mark_unread === true) {
    const { data: last } = await sb.from('chat_messages').select('created_at').eq('conversation_id', id)
      .neq('sender_id', auth.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!last) return NextResponse.json({ error: 'Brak wiadomości do oznaczenia' }, { status: 400 });
    patch.last_read_at = new Date(new Date(last.created_at).getTime() - 1000).toISOString();
  }
  if (Object.keys(patch).length) {
    const { error } = await sb.from('chat_participants').update(patch).eq('conversation_id', id).eq('user_id', auth.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── nazwa grupy (widoczna dla wszystkich) ──
  if (typeof b.name === 'string') {
    const name = b.name.trim().slice(0, 80);
    if (!name) return NextResponse.json({ error: 'Podaj nazwę grupy' }, { status: 400 });
    const { data: conv } = await sb.from('chat_conversations').select('type, name').eq('id', id).single();
    if (conv?.type !== 'group') return NextResponse.json({ error: 'Nazwę można zmienić tylko w grupie' }, { status: 400 });
    const { error } = await sb.from('chat_conversations').update({ name, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    notifyChatUsers(await participantIds(id), { type: 'update', conversation_id: id, from: auth.id });
  }

  return NextResponse.json({ ok: true });
}
