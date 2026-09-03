// POST /api/chat/conversations/[id]/messages/[msgId]/reactions  { emoji }
// Przełącznik: ta sama emoji drugi raz = zdjęcie własnej reakcji (jak w WhatsAppie).
// Port z BBS-Unified (E6a): bramka `komunikator.czat` + 403.
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { requireChatAuth, isParticipant, participantIds } from '@/lib/chat/server';
import { notifyChatUsers } from '@/lib/chat/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// dopuszczamy krótkie emoji (z modyfikatorami), nie dowolny tekst
const OK_EMOJI = /^\p{Extended_Pictographic}[\p{Emoji_Modifier}‍️\p{Extended_Pictographic}]{0,6}$/u;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; msgId: string }> }) {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, msgId } = await params;
  if (!(await isParticipant(id, auth.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const b = await request.json().catch(() => null);
  const emoji = String(b?.emoji || '').trim();
  if (!emoji || !OK_EMOJI.test(emoji)) return NextResponse.json({ error: 'Nieprawidłowa reakcja' }, { status: 400 });

  const sb = admin() as any;
  const { data: msg } = await sb.from('chat_messages').select('id, conversation_id').eq('id', msgId).maybeSingle();
  if (!msg || msg.conversation_id !== id) return NextResponse.json({ error: 'Nie ma takiej wiadomości' }, { status: 404 });

  // przełącznik: jeśli już mam tę reakcję → zdejmij
  const { data: existing } = await sb.from('chat_reactions')
    .select('emoji').eq('message_id', msgId).eq('user_id', auth.id).eq('emoji', emoji).maybeSingle();
  if (existing) {
    await sb.from('chat_reactions').delete().eq('message_id', msgId).eq('user_id', auth.id).eq('emoji', emoji);
  } else {
    const { error } = await sb.from('chat_reactions').insert({ message_id: msgId, user_id: auth.id, emoji });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  notifyChatUsers(await participantIds(id), { type: 'update', conversation_id: id, from: auth.id });
  return NextResponse.json({ ok: true, removed: !!existing });
}
