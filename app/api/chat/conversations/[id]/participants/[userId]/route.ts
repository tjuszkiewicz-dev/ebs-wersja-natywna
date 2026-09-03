// DELETE /api/chat/conversations/[id]/participants/[userId]
//   userId === ja  → opuszczam grupę
//   userId ≠ ja    → usuwam kogoś z grupy (może każdy uczestnik — komunikator firmowy
//                     nie ma ról administratora grupy; ślad zostaje w audit_log przez trigger)
// Rozmów 1:1 nie da się opuścić (nie ma czego opuszczać — służy do tego archiwizacja).
// Port z BBS-Unified (E6a): bramka + 403, audyt triggerem (K9).
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { profilesMap } from '@/lib/crm/profiles';
import { requireChatAuth, isParticipant, touchConversation } from '@/lib/chat/server';
import { notifyChatUsers } from '@/lib/chat/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, userId } = await params;
  if (!(await isParticipant(id, auth.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sb = admin() as any;
  const { data: conv } = await sb.from('chat_conversations').select('type, name').eq('id', id).single();
  if (!conv) return NextResponse.json({ error: 'Nie ma takiej rozmowy' }, { status: 404 });
  if (conv.type !== 'group') return NextResponse.json({ error: 'To rozmowa prywatna — możesz ją zarchiwizować' }, { status: 400 });

  const { data: parts } = await sb.from('chat_participants').select('user_id').eq('conversation_id', id);
  const all: string[] = (parts || []).map((p: any) => p.user_id);
  if (!all.includes(userId)) return NextResponse.json({ error: 'Ta osoba nie jest w grupie' }, { status: 400 });

  const { error } = await sb.from('chat_participants').delete().eq('conversation_id', id).eq('user_id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profiles = await profilesMap([auth.id, userId]);
  const who = profiles.get(userId)?.full_name || 'użytkownik';
  const me = profiles.get(auth.id)?.full_name || 'użytkownik';
  const self = userId === auth.id;

  // ślad w rozmowie (jak komunikat systemowy WhatsAppa) — zostaje w historii grupy
  await sb.from('chat_messages').insert({
    conversation_id: id, sender_id: auth.id, kind: 'system',
    content: self ? `${me} opuścił(a) grupę` : `${me} usunął(-ęła) z grupy: ${who}`,
  });
  await touchConversation(id);
  notifyChatUsers(all, { type: 'update', conversation_id: id, from: auth.id });

  return NextResponse.json({ ok: true, left: self });
}
