// PATCH  /api/chat/conversations/[id]/messages/[msgId] — edycja własnej wiadomości tekstowej
// DELETE /api/chat/conversations/[id]/messages/[msgId] — usunięcie własnej wiadomości „dla wszystkich"
//
// Usuwamy miękko (deleted_at) — dymek zostaje jako „wiadomość usunięta", jak w WhatsAppie;
// treść i plik znikają (plik kasowany ze Storage, bo czat może zawierać dane osobowe).
// Port z BBS-Unified (E6a). Adaptacje: bramka + 403; edycja KASUJE zapamiętane tłumaczenie
// (inaczej pod nową treścią wisiałby stary przekład); brak audytu (K9 — decyzja o własnej treści).
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { requireChatAuth, isParticipant, participantIds } from '@/lib/chat/server';
import { notifyChatUsers } from '@/lib/chat/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// okno edycji — po tym czasie treść zostaje (spójność zapisu rozmowy)
const EDIT_WINDOW_MIN = 60;

async function loadOwn(id: string, msgId: string, userId: string) {
  const { data: msg } = await (admin() as any).from('chat_messages').select('*').eq('id', msgId).maybeSingle();
  if (!msg || msg.conversation_id !== id) return { error: 'Nie ma takiej wiadomości', status: 404 as const };
  if (msg.sender_id !== userId) return { error: 'Możesz zmieniać tylko własne wiadomości', status: 403 as const };
  return { msg };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; msgId: string }> }) {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, msgId } = await params;
  if (!(await isParticipant(id, auth.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const own = await loadOwn(id, msgId, auth.id);
  if ('error' in own) return NextResponse.json({ error: own.error }, { status: own.status });
  const msg = own.msg;
  if (msg.deleted_at) return NextResponse.json({ error: 'Wiadomość została usunięta' }, { status: 400 });
  if (msg.kind !== 'text') return NextResponse.json({ error: 'Edytować można tylko wiadomości tekstowe' }, { status: 400 });
  if (Date.now() - new Date(msg.created_at).getTime() > EDIT_WINDOW_MIN * 60000) {
    return NextResponse.json({ error: `Edycja możliwa do ${EDIT_WINDOW_MIN} minut od wysłania` }, { status: 400 });
  }

  const b = await request.json().catch(() => null);
  const content = String(b?.content || '').trim();
  if (!content) return NextResponse.json({ error: 'Pusta treść' }, { status: 400 });

  const { error } = await (admin() as any).from('chat_messages')
    .update({ content: content.slice(0, 8000), edited_at: new Date().toISOString(), translated_content: null, translated_lang: null })
    .eq('id', msgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  notifyChatUsers(await participantIds(id), { type: 'update', conversation_id: id, from: auth.id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; msgId: string }> }) {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, msgId } = await params;
  if (!(await isParticipant(id, auth.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const own = await loadOwn(id, msgId, auth.id);
  if ('error' in own) return NextResponse.json({ error: own.error }, { status: own.status });
  const msg = own.msg;
  if (msg.deleted_at) return NextResponse.json({ ok: true });

  const sb = admin() as any;
  if (msg.file_path) await sb.storage.from('chat-media').remove([msg.file_path]).catch(() => {});
  const { error } = await sb.from('chat_messages')
    .update({ deleted_at: new Date().toISOString(), content: null, file_path: null, translated_content: null, translated_lang: null })
    .eq('id', msgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  notifyChatUsers(await participantIds(id), { type: 'update', conversation_id: id, from: auth.id });
  return NextResponse.json({ ok: true });
}
