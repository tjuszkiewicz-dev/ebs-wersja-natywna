// POST /api/chat/upload — multipart: conversation_id, file, kind? (audio|file|image|recording), duration_sec?
// Zapis do bucketa chat-media + wiadomość w rozmowie.
// Port z BBS-Unified (E6a): bramka + 403, polityka przy wysyłce (K11), push → E6b.
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { requireChatAuth, isParticipant, participantIds, assertCanConverse, touchConversation, markRead } from '@/lib/chat/server';
import { notifyChatUsers } from '@/lib/chat/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB (nagrania spotkań bywają duże)

export async function POST(request: NextRequest) {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Brak danych' }, { status: 400 });
  const conversationId = String(form.get('conversation_id') || '');
  const file = form.get('file') as File | null;
  if (!conversationId || !file) return NextResponse.json({ error: 'Brak pliku lub rozmowy' }, { status: 400 });
  if (!(await isParticipant(conversationId, auth.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Plik za duży (max 50 MB)' }, { status: 400 });

  const others = (await participantIds(conversationId)).filter(u => u !== auth.id);
  const verdict = await assertCanConverse(auth, others);
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });

  const ct = file.type || 'application/octet-stream';
  let kind = String(form.get('kind') || '');
  if (!['audio', 'file', 'image', 'recording'].includes(kind)) {
    kind = ct.startsWith('audio/') ? 'audio' : ct.startsWith('image/') ? 'image' : 'file';
  }
  const duration = Number(form.get('duration_sec')) || null;

  const sb = admin() as any;
  const safeName = (file.name || 'plik').replace(/[^\w.\-() ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+/g, '_').slice(0, 120);
  // KLUCZ w magazynie musi być czystym ASCII — Storage odrzuca polskie znaki
  // i spacje („Invalid key" przy „głosówka-….webm"). Ładna nazwa zostaje
  // w file_name (baza), klucz dostaje wersję transliterowaną.
  const ascii = safeName
    .replace(/[ąĄ]/g, 'a').replace(/[ćĆ]/g, 'c').replace(/[ęĘ]/g, 'e').replace(/[łŁ]/g, 'l')
    .replace(/[ńŃ]/g, 'n').replace(/[óÓ]/g, 'o').replace(/[śŚ]/g, 's').replace(/[źżŹŻ]/g, 'z')
    .replace(/[^\w.\-]+/g, '_');
  const path = `${conversationId}/${crypto.randomUUID()}-${ascii}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const up = await sb.storage.from('chat-media').upload(path, buf, { contentType: ct });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  const { data: msg, error } = await sb.from('chat_messages')
    .insert({ conversation_id: conversationId, sender_id: auth.id, kind, content: null, file_path: path, file_name: safeName, duration_sec: duration })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await Promise.all([touchConversation(conversationId), markRead(conversationId, auth.id)]);

  notifyChatUsers(others, { type: 'message', conversation_id: conversationId, from: auth.id });
  // E6b: push do pozostałych uczestników (sendPushTo)

  const { data: s } = await sb.storage.from('chat-media').createSignedUrl(path, 3600);
  return NextResponse.json({ id: msg.id, url: s?.signedUrl ?? null, kind, created_at: msg.created_at }, { status: 201 });
}
