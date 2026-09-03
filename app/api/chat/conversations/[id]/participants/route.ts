// POST /api/chat/conversations/[id]/participants — dodaj osoby do rozmowy.
// Grupa: dopisuje uczestników. Rozmowa 1:1: nie da się jej „rozszerzyć" bez zmiany
// charakteru, więc tworzy NOWĄ grupę (obecni + dodani) i zwraca jej id — jak WhatsApp.
// Port z BBS-Unified (E6a): bramka + 403, polityka `assertCanConverse`, audyt triggerem.
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { profilesMap } from '@/lib/crm/profiles';
import { requireChatAuth, assertCanConverse, createConversation, touchConversation } from '@/lib/chat/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const b = await request.json().catch(() => null);
  const userIds: string[] = [...new Set((Array.isArray(b?.user_ids) ? b.user_ids : []).filter((x: any) => typeof x === 'string'))] as string[];
  if (!userIds.length) return NextResponse.json({ error: 'Wybierz osoby do dodania' }, { status: 400 });

  const sb = admin() as any;

  // tylko uczestnik rozmowy może do niej dodawać
  const { data: parts } = await sb.from('chat_participants').select('user_id').eq('conversation_id', id);
  const current: string[] = (parts || []).map((p: any) => p.user_id);
  if (!current.includes(auth.id)) return NextResponse.json({ error: 'Nie jesteś uczestnikiem tej rozmowy' }, { status: 403 });

  const { data: conv } = await sb.from('chat_conversations').select('id, type, name').eq('id', id).single();
  if (!conv) return NextResponse.json({ error: 'Nie ma takiej rozmowy' }, { status: 404 });

  const toAdd = userIds.filter(u => !current.includes(u));
  if (!toAdd.length) return NextResponse.json({ error: 'Te osoby już są w rozmowie' }, { status: 400 });

  // polityka jak przy tworzeniu rozmowy
  const verdict = await assertCanConverse(auth, toAdd);
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });

  // ── 1:1 → nowa grupa z dotychczasowymi rozmówcami + dodanymi ──
  if (conv.type !== 'group') {
    const all = [...new Set([...current, ...toAdd])];
    const names = await profilesMap(all);
    const groupName = (typeof b?.name === 'string' && b.name.trim())
      || all.map(u => (names.get(u)?.full_name || '').split(' ')[0]).filter(Boolean).slice(0, 4).join(', ')
      || 'Nowa grupa';
    const created = await createConversation(auth.id, all.filter(u => u !== auth.id), { group: true, name: groupName });
    if ('error' in created) return NextResponse.json({ error: created.error }, { status: 500 });
    return NextResponse.json({ id: created.id, created_group: true, added: toAdd.length }, { status: 201 });
  }

  // ── grupa → dopisz uczestników ──
  const { error: insErr } = await sb.from('chat_participants').insert(toAdd.map(uid => ({ conversation_id: id, user_id: uid })));
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  await touchConversation(id);
  return NextResponse.json({ id, created_group: false, added: toAdd.length });
}
