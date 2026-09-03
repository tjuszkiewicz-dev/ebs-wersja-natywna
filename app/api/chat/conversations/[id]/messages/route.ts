// GET /api/chat/conversations/[id]/messages?before=ISO — wiadomości (50/stronę, od najnowszych)
// POST — wysłanie: { content, reply_to_id? } (media przez /api/chat/upload)
// Port z BBS-Unified (E6a). Adaptacje: bramka `komunikator.czat` + 403; polityka sprawdzana
// PRZY KAŻDEJ WYSYŁCE (K11), nie tylko przy zakładaniu rozmowy; auto-tłumaczenie w rozmowie
// z pracownikiem tymczasowym (K14); `sender_id` może być NULL po usunięciu konta (K7);
// push → E6b (znacznik niżej), audyt → brak na wiadomościach (K9).
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { profilesMap } from '@/lib/crm/profiles';
import { requireChatAuth, isParticipant, participantIds, assertCanConverse, touchConversation, markRead } from '@/lib/chat/server';
import { notifyChatUsers } from '@/lib/chat/realtime';
import { autoTranslateOnSend } from '@/lib/chat/translate';
import { previewOf } from '@/lib/chat/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // synchroniczne tłumaczenie w kanale pracownika (§4.6)

const PAGE = 50;
const DELETED_ACCOUNT = 'Konto usunięte';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!(await isParticipant(id, auth.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const before = new URL(request.url).searchParams.get('before');
  const sb = admin() as any;
  let q = sb.from('chat_messages').select('*').eq('conversation_id', id).order('created_at', { ascending: false }).limit(PAGE);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows: any[] = data || [];
  // cytaty: dociągamy oryginały jednym zapytaniem
  const replyIds = [...new Set(rows.map(m => m.reply_to_id).filter(Boolean))];
  const replies = new Map<string, any>();
  if (replyIds.length) {
    const { data: rs } = await sb.from('chat_messages').select('id, sender_id, kind, content, file_name, deleted_at').in('id', replyIds);
    for (const r of rs || []) replies.set(r.id, r);
  }

  // reakcje emoji pod wiadomościami (zbiorczo)
  const reactByMsg = new Map<string, { emoji: string; count: number; mine: boolean }[]>();
  if (rows.length) {
    const { data: reacts } = await sb.from('chat_reactions').select('message_id, user_id, emoji').in('message_id', rows.map(m => m.id));
    for (const r of reacts || []) {
      const list = reactByMsg.get(r.message_id) || [];
      const hit = list.find(x => x.emoji === r.emoji);
      if (hit) { hit.count++; if (r.user_id === auth.id) hit.mine = true; }
      else list.push({ emoji: r.emoji, count: 1, mine: r.user_id === auth.id });
      reactByMsg.set(r.message_id, list);
    }
  }

  const profiles = await profilesMap([
    ...rows.map(m => m.sender_id),
    ...[...replies.values()].map((r: any) => r.sender_id),
  ]);
  const nameOf = (senderId: string | null) => senderId ? (profiles.get(senderId)?.full_name || '—') : DELETED_ACCOUNT;

  // media: podpisane linki (1h)
  const messages = await Promise.all(rows.reverse().map(async (m: any) => {
    let url: string | null = null;
    if (m.file_path && !m.deleted_at) {
      const { data: s } = await sb.storage.from('chat-media').createSignedUrl(m.file_path, 3600);
      url = s?.signedUrl ?? null;
    }
    const src = m.reply_to_id ? replies.get(m.reply_to_id) : null;
    return {
      id: m.id, sender_id: m.sender_id, sender_name: nameOf(m.sender_id),
      kind: m.kind, content: m.deleted_at ? null : m.content, file_name: m.file_name,
      duration_sec: m.duration_sec, url, created_at: m.created_at,
      deleted: !!m.deleted_at, edited: !!m.edited_at,
      translated: (!m.deleted_at && m.translated_content) ? { content: m.translated_content, lang: m.translated_lang } : null,
      reply_to: src ? { id: src.id, sender_name: nameOf(src.sender_id), preview: previewOf(src, 120) } : null,
      reactions: reactByMsg.get(m.id) || [],
    };
  }));

  // ✓✓: moment, do którego przeczytali WSZYSCY pozostali uczestnicy
  const { data: others } = await sb.from('chat_participants').select('user_id, last_read_at').eq('conversation_id', id).neq('user_id', auth.id);
  const times = (others || []).map((p: any) => p.last_read_at);
  const othersReadAt = times.length && times.every(Boolean)
    ? times.slice().sort()[0]   // najwolniejszy czytelnik decyduje (jak w grupach WhatsAppa)
    : null;

  // otwarcie rozmowy = przeczytane; informujemy nadawców, żeby zobaczyli ✓✓
  await markRead(id, auth.id);
  if (rows.length) notifyChatUsers((others || []).map((p: any) => p.user_id), { type: 'read', conversation_id: id, from: auth.id });

  return NextResponse.json({ messages, has_more: rows.length === PAGE, others_read_at: othersReadAt });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!(await isParticipant(id, auth.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const b = await request.json().catch(() => null);
  const content = String(b?.content || '').trim();
  if (!content) return NextResponse.json({ error: 'Pusta wiadomość' }, { status: 400 });

  // polityka przy wysyłce (K11): zmiana roli albo koordynatora po założeniu rozmowy nie może
  // zostawić otwartego kanału
  const others = (await participantIds(id)).filter(u => u !== auth.id);
  const verdict = await assertCanConverse(auth, others);
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });

  const sb = admin() as any;
  // cytat tylko do wiadomości z TEJ rozmowy
  let replyToId: string | null = null;
  if (typeof b?.reply_to_id === 'string' && b.reply_to_id) {
    const { data: src } = await sb.from('chat_messages').select('id, conversation_id').eq('id', b.reply_to_id).maybeSingle();
    if (src && src.conversation_id === id) replyToId = src.id;
  }

  const { data: msg, error } = await sb.from('chat_messages')
    .insert({ conversation_id: id, sender_id: auth.id, kind: 'text', content: content.slice(0, 8000), reply_to_id: replyToId })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await Promise.all([touchConversation(id), markRead(id, auth.id)]);

  // auto-tłumaczenie (K14): tylko 1:1 z pracownikiem tymczasowym; best-effort
  const otherParties = others.map(u => verdict.parties.get(u)).filter(Boolean) as { id: string; role: string }[];
  const translated = await autoTranslateOnSend(msg, auth, otherParties).catch(() => null);

  // Realtime dostają wszyscy pozostali (to tylko sygnał do odświeżenia widoku)
  notifyChatUsers(others, { type: 'message', conversation_id: id, from: auth.id });
  // E6b: tu dojdzie push (sendPushTo) — poza wyciszonymi, ale ze wzmiankami @Imię mimo wyciszenia

  return NextResponse.json({ id: msg.id, created_at: msg.created_at, translated }, { status: 201 });
}
