// GET/POST /api/me/worker/chat — kanał pracownik tymczasowy ↔ jego koordynator (spec E6 §4.7, K15).
// CIENKA NAKŁADKA na tabele komunikatora: ta sama rozmowa 1:1, którą koordynator widzi w zwykłym
// ChatApp. Kontrakt narzucony przez stub `WorkerChat` z E2e (TempWorkerDashboard):
//   GET  → { messages: [{ id, mine, worker, pl, created_at }], no_coordinator, coordinator?, lang? }
//          `worker` = treść w języku pracownika, `pl` = po polsku (jedno z nich to oryginał)
//   POST { content } → 201 { id } — z auto-tłumaczeniem na polski (K14)
// Endpoint nie istniał nigdzie (ani w BBS) — to nie jest port.
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { profilesMap } from '@/lib/crm/profiles';
import { requireChatAuth, assertCanConverse, findOrCreateDirect, touchConversation, markRead } from '@/lib/chat/server';
import { isTempWorker } from '@/lib/chat/policy';
import { notifyChatUsers } from '@/lib/chat/realtime';
import { autoTranslateOnSend, normalizeLang } from '@/lib/chat/translate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function workerContext(userId: string) {
  const { data: e } = await (admin() as any).from('hr_employees').select('id, coordinator_id, language')
    .eq('user_id', userId).eq('archived', false).maybeSingle();
  return e as { id: string; coordinator_id: string | null; language: string | null } | null;
}

export async function GET() {
  const auth = await requireChatAuth();
  if (!auth || !isTempWorker(auth.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const e = await workerContext(auth.id);
  if (!e) return NextResponse.json({ error: 'Brak powiązanej kartoteki — zgłoś się do koordynatora' }, { status: 404 });
  if (!e.coordinator_id) return NextResponse.json({ messages: [], no_coordinator: true });

  const conv = await findOrCreateDirect(auth.id, e.coordinator_id);
  if (typeof conv !== 'string') return NextResponse.json({ error: conv.error }, { status: 500 });

  const sb = admin() as any;
  const [{ data: rows }, profiles] = await Promise.all([
    sb.from('chat_messages').select('id, sender_id, kind, content, translated_content, translated_lang, file_name, deleted_at, created_at')
      .eq('conversation_id', conv).order('created_at', { ascending: false }).limit(100),
    profilesMap([e.coordinator_id]),
  ]);

  const lang = normalizeLang(e.language);
  const messages = (rows || []).reverse().map((m: any) => {
    const mine = m.sender_id === auth.id;
    const text = m.deleted_at ? null : (m.kind === 'text' || m.kind === 'system' ? m.content : `📎 ${m.file_name || 'plik'}`);
    const tr = m.deleted_at ? null : m.translated_content;
    // moja wiadomość: oryginał w moim języku, tłumaczenie po polsku;
    // koordynatora: oryginał po polsku, tłumaczenie w moim języku (jeśli jest)
    return {
      id: m.id, mine, kind: m.kind, created_at: m.created_at, deleted: !!m.deleted_at,
      worker: mine ? text : (tr && m.translated_lang === lang ? tr : text),
      pl: mine ? (tr && m.translated_lang === 'pl' ? tr : null) : text,
    };
  });

  await markRead(conv, auth.id);
  notifyChatUsers([e.coordinator_id], { type: 'read', conversation_id: conv, from: auth.id });

  return NextResponse.json({
    messages, no_coordinator: false, conversation_id: conv, lang,
    coordinator: { id: e.coordinator_id, name: profiles.get(e.coordinator_id)?.full_name || 'Koordynator' },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireChatAuth();
  if (!auth || !isTempWorker(auth.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const e = await workerContext(auth.id);
  if (!e) return NextResponse.json({ error: 'Brak powiązanej kartoteki — zgłoś się do koordynatora' }, { status: 404 });
  if (!e.coordinator_id) return NextResponse.json({ error: 'Nie masz jeszcze przypisanego koordynatora' }, { status: 400 });

  const b = await request.json().catch(() => null);
  const content = String(b?.content || '').trim();
  if (!content) return NextResponse.json({ error: 'Pusta wiadomość' }, { status: 400 });

  const verdict = await assertCanConverse(auth, [e.coordinator_id]);
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });

  const conv = await findOrCreateDirect(auth.id, e.coordinator_id);
  if (typeof conv !== 'string') return NextResponse.json({ error: conv.error }, { status: 500 });

  const sb = admin() as any;
  const { data: msg, error } = await sb.from('chat_messages')
    .insert({ conversation_id: conv, sender_id: auth.id, kind: 'text', content: content.slice(0, 8000) })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await Promise.all([touchConversation(conv), markRead(conv, auth.id)]);

  const coordinator = verdict.parties.get(e.coordinator_id)!;
  const translated = await autoTranslateOnSend(msg, auth, [coordinator]).catch(() => null);
  notifyChatUsers([e.coordinator_id], { type: 'message', conversation_id: conv, from: auth.id });

  return NextResponse.json({ id: msg.id, created_at: msg.created_at, translated }, { status: 201 });
}
