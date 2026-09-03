// GET /api/chat/conversations — lista rozmów usera (uczestnicy, ostatnia wiadomość, nieprzeczytane)
// POST — nowa rozmowa: { user_ids: string[], name?: string } (1 id = direct z dedupe, >1 = grupa)
// Port z BBS-Unified (E6a). Adaptacje: bramka `komunikator.czat` + 403 (K2/K12), polityka przez
// `assertCanConverse` (D3/D6), `profilesMap` z lib/crm/profiles (K13), audyt triggerem (K9).
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { profilesMap } from '@/lib/crm/profiles';
import { requireChatAuth, assertCanConverse, findDirectConversation, createConversation } from '@/lib/chat/server';
import { previewOf, roleLabel } from '@/lib/chat/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sb = admin() as any;

  const { data: mine } = await sb.from('chat_participants').select('conversation_id, last_read_at, muted, pinned, archived').eq('user_id', auth.id);
  const convIds = (mine || []).map((m: any) => m.conversation_id);
  if (!convIds.length) return NextResponse.json({ conversations: [] });
  const lastRead = new Map<string, string>((mine || []).map((m: any) => [m.conversation_id, m.last_read_at]));
  const prefs = new Map<string, any>((mine || []).map((m: any) => [m.conversation_id, m]));

  const [{ data: convs }, { data: parts }] = await Promise.all([
    sb.from('chat_conversations').select('*').in('id', convIds).order('updated_at', { ascending: false }),
    sb.from('chat_participants').select('conversation_id, user_id').in('conversation_id', convIds),
  ]);

  const userIds = [...new Set<string>((parts || []).map((p: any) => p.user_id as string))];
  const profiles = await profilesMap(userIds);

  // ostatnia wiadomość + licznik nieprzeczytanych per rozmowa (2 zapytania zbiorcze)
  const { data: lastMsgs } = await sb
    .from('chat_messages')
    .select('conversation_id, sender_id, kind, content, file_name, deleted_at, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })
    .limit(convIds.length * 4);
  const lastByConv = new Map<string, any>();
  for (const m of lastMsgs || []) if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);

  // nieprzeczytane: wiadomości po last_read_at, nie moje (okno 30 dni)
  const { data: unreadRows } = await sb
    .from('chat_messages')
    .select('conversation_id, sender_id, created_at')
    .in('conversation_id', convIds)
    .neq('sender_id', auth.id)
    .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
  const unread = new Map<string, number>();
  for (const m of unreadRows || []) {
    const lr = lastRead.get(m.conversation_id);
    if (!lr || m.created_at > lr) unread.set(m.conversation_id, (unread.get(m.conversation_id) || 0) + 1);
  }

  const conversations = (convs || []).map((c: any) => {
    const members = (parts || [])
      .filter((p: any) => p.conversation_id === c.id)
      .map((p: any) => {
        const pr = profiles.get(p.user_id);
        return { id: p.user_id, full_name: pr?.full_name || '—', role: pr?.role || '', role_label: roleLabel(pr?.role) };
      });
    const others = members.filter((m: any) => m.id !== auth.id);
    const last = lastByConv.get(c.id);
    return {
      id: c.id, type: c.type,
      name: c.type === 'group' ? (c.name || 'Grupa') : (others[0]?.full_name || '—'),
      members,
      last_message: last ? { kind: last.kind, content: previewOf(last), sender_id: last.sender_id, created_at: last.created_at } : null,
      unread: unread.get(c.id) || 0,
      updated_at: c.updated_at,
      muted: !!prefs.get(c.id)?.muted,
      pinned: !!prefs.get(c.id)?.pinned,
      archived: !!prefs.get(c.id)?.archived,
    };
  });

  // przypięte na górze, reszta wg ostatniej aktywności
  conversations.sort((a: any, z: any) =>
    (Number(z.pinned) - Number(a.pinned)) || String(z.updated_at || '').localeCompare(String(a.updated_at || '')));

  return NextResponse.json({ conversations });
}

export async function POST(request: NextRequest) {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => null);
  const userIds: string[] = [...new Set((Array.isArray(b?.user_ids) ? b.user_ids : []).filter((x: any) => typeof x === 'string' && x !== auth.id))] as string[];
  if (!userIds.length) return NextResponse.json({ error: 'Wybierz rozmówców' }, { status: 400 });

  // polityka: personel bez ograniczeń, pracownik tymczasowy tylko ze swoim koordynatorem,
  // role zewnętrzne nigdy — sprawdzane TU, nie tylko w UI
  const verdict = await assertCanConverse(auth, userIds);
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });

  const isGroup = userIds.length > 1;
  if (!isGroup) {
    const existing = await findDirectConversation(auth.id, userIds[0]);
    if (existing) return NextResponse.json({ id: existing, existing: true });
  }

  const created = await createConversation(auth.id, userIds, { group: isGroup, name: b?.name });
  if ('error' in created) return NextResponse.json({ error: created.error }, { status: 500 });
  return NextResponse.json({ id: created.id, existing: false }, { status: 201 });
}
