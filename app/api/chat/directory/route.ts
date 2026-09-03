// GET /api/chat/directory — KOMUNIKATOR FIRMOWY: katalog osób, z którymi wolno rozmawiać.
//   people  — personel wewnętrzny (wszystkie role poza zewnętrznymi i pracownikiem tymczasowym),
//             alfabetycznie, każdy z istniejącą rozmową 1:1 (id, ostatnia wiadomość, nieprzeczytane);
//   workers — pracownicy tymczasowi Z KONTEM w portalu, których koordynatorem jest pytający
//             (superadmin: wszyscy) — tylko gdy pytający ma `agencja.kontrakty`;
//   pracownik tymczasowy jako pytający dostaje w `people` wyłącznie swojego koordynatora (D3).
// Nowy użytkownik pojawia się od razu (lista czytana z user_profiles na żywo).
// Port z BBS-Unified (E6a) z macierzą K11 zamiast NON_STAFF_ROLES; sekcja `workers` jest nowa.
import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { canAny } from '@/lib/permissions/server';
import { requireChatAuth, coordinatorOf } from '@/lib/chat/server';
import { isStaff, isTempWorker, TEMP_WORKER_ROLE } from '@/lib/chat/policy';
import { previewOf, roleLabel } from '@/lib/chat/format';
import { displayName } from '@/lib/hr/docPlaceholders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ONLINE_MS = 3 * 60000; // online = ślad aktywności z ostatnich 3 minut (heartbeat z otwartego komunikatora)

export async function GET() {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sb = admin() as any;

  // 1) kandydaci do katalogu
  const { data: profiles } = await sb.from('user_profiles').select('id, full_name, role, last_seen_at')
    .not('full_name', 'is', null).order('full_name');
  const all: any[] = (profiles || []).filter((p: any) => p.id !== auth.id);

  let staff: any[] = [];
  let workerRows: any[] = [];
  if (isTempWorker(auth.role)) {
    const coordinator = await coordinatorOf(auth.id);
    staff = coordinator ? all.filter(p => p.id === coordinator) : [];
  } else {
    staff = all.filter(p => isStaff(p.role));
    // pracownicy tymczasowi z kontem — tylko dla koordynujących
    if (auth.role === 'superadmin' || (await canAny(auth, ['agencja.kontrakty']))) {
      let q = sb.from('hr_employees').select('id, user_id, first_name, second_name, last_name, second_last_name, coordinator_id, language')
        .not('user_id', 'is', null).eq('archived', false);
      if (auth.role !== 'superadmin') q = q.eq('coordinator_id', auth.id);
      const { data: emps } = await q;
      workerRows = emps || [];
    }
  }

  // 2) moje rozmowy 1:1 → mapa rozmówca → { conversationId, last, unread }
  const { data: myParts } = await sb.from('chat_participants').select('conversation_id, last_read_at').eq('user_id', auth.id);
  const myConvIds: string[] = (myParts || []).map((m: any) => m.conversation_id);
  const lastRead = new Map<string, string>((myParts || []).map((m: any) => [m.conversation_id, m.last_read_at]));

  const directOf = new Map<string, { conversationId: string; last: any; unread: number }>();
  if (myConvIds.length) {
    const [{ data: directConvs }, { data: parts }] = await Promise.all([
      sb.from('chat_conversations').select('id').in('id', myConvIds).eq('type', 'direct'),
      sb.from('chat_participants').select('conversation_id, user_id').in('conversation_id', myConvIds),
    ]);
    const directIds = new Set<string>((directConvs || []).map((c: any) => c.id));
    const otherByConv = new Map<string, string>();
    for (const p of parts || []) if (directIds.has(p.conversation_id) && p.user_id !== auth.id) otherByConv.set(p.conversation_id, p.user_id);

    if (directIds.size) {
      const ids = [...directIds];
      const [{ data: lastMsgs }, { data: unreadRows }] = await Promise.all([
        sb.from('chat_messages').select('conversation_id, sender_id, kind, content, file_name, deleted_at, created_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(ids.length * 3),
        sb.from('chat_messages').select('conversation_id, created_at').in('conversation_id', ids).neq('sender_id', auth.id).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      ]);
      const lastByConv = new Map<string, any>();
      for (const m of lastMsgs || []) if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
      const unread = new Map<string, number>();
      for (const m of unreadRows || []) { const lr = lastRead.get(m.conversation_id); if (!lr || m.created_at > lr) unread.set(m.conversation_id, (unread.get(m.conversation_id) || 0) + 1); }

      for (const [convId, otherId] of otherByConv) {
        const last = lastByConv.get(convId);
        directOf.set(otherId, {
          conversationId: convId,
          last: last ? { kind: last.kind, content: previewOf(last), sender_id: last.sender_id, created_at: last.created_at } : null,
          unread: unread.get(convId) || 0,
        });
      }
    }
  }

  const seenAt = new Map<string, string | null>(all.map(p => [p.id, p.last_seen_at ?? null]));
  const entry = (id: string, name: string, role: string, extra: Record<string, unknown> = {}) => {
    const d = directOf.get(id);
    const ls = seenAt.get(id) ?? null;
    return {
      id, name, role, role_label: roleLabel(role),
      online: !!ls && Date.now() - new Date(ls).getTime() < ONLINE_MS,
      last_seen_at: ls,
      conversation_id: d?.conversationId ?? null,
      last_message: d?.last ?? null,
      unread: d?.unread ?? 0,
      ...extra,
    };
  };

  const people = staff.map(p => entry(p.id, p.full_name, p.role));
  const workers = workerRows
    .map(w => entry(w.user_id, displayName(w) || '—', TEMP_WORKER_ROLE, { employee_id: w.id, language: w.language ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  return NextResponse.json({ people, workers, me: { id: auth.id, role: auth.role } });
}
