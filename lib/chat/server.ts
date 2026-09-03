// Wspólna logika komunikatora (server-only): bramka dostępu, uczestnictwo w rozmowie,
// blokady par ról, egzekwowanie polityki z pełnym kontekstem (role + koordynator
// pracownika tymczasowego), znajdowanie/zakładanie rozmów.
//
// Port z BBS-Unified `lib/chat/server.ts` z adaptacjami (spec E6 §3):
//   * `profilesMap` NIE jest tu dublowany — od E7b mieszka w `lib/crm/profiles` (K13).
//   * `NON_STAFF_ROLES`/`isOfficeStaff` → `lib/chat/policy` (definicja po wykluczeniu, K11).
//   * `canChat` (samo `blocked`) → `canConverse` z kontekstem koordynatora (D3).
//   * `requireChatAuth`: BBS bramkował tylko sesją (401); EBS — uprawnieniem `komunikator.czat`
//     i zwraca 403 (K2, K12).
import { getAuthUserWithRole, type AuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';
import { profilesMap } from '@/lib/crm/profiles';
import { canConverse, isTempWorker, type ConverseVerdict } from '@/lib/chat/policy';

export { pairKey } from '@/lib/chat/policy';

/** Zalogowany z uprawnieniem do komunikatora — albo null (route odpowiada 403). */
export async function requireChatAuth(): Promise<AuthUserWithRole | null> {
  const auth = await getAuthUserWithRole();
  if (!auth) return null;
  return (await can(auth, 'komunikator.czat')) ? auth : null;
}

/** Pary ról zablokowane przez właściciela w chat_policy (`role_a|role_b`, posortowane). */
export async function getBlockedPairs(): Promise<Set<string>> {
  const { data } = await (admin() as any).from('chat_policy').select('role_a, role_b, allowed').eq('allowed', false);
  return new Set((data || []).map((r: any) => `${r.role_a}|${r.role_b}`));
}

/** Czy user jest uczestnikiem rozmowy — bramka każdego endpointu wiadomości. */
export async function isParticipant(conversationId: string, userId: string): Promise<boolean> {
  const { data } = await (admin() as any).from('chat_participants').select('user_id')
    .eq('conversation_id', conversationId).eq('user_id', userId).maybeSingle();
  return !!data;
}

/** Wszyscy uczestnicy rozmowy (id) — do broadcastu i polityki przy wysyłce. */
export async function participantIds(conversationId: string): Promise<string[]> {
  const { data } = await (admin() as any).from('chat_participants').select('user_id').eq('conversation_id', conversationId);
  return (data || []).map((p: any) => p.user_id as string);
}

/** Koordynator pracownika tymczasowego (hr_employees.coordinator_id po user_id konta). */
export async function coordinatorOf(userId: string): Promise<string | null> {
  const { data } = await (admin() as any).from('hr_employees').select('coordinator_id')
    .eq('user_id', userId).eq('archived', false).maybeSingle();
  return data?.coordinator_id ?? null;
}

export interface Party { id: string; role: string; full_name: string }

/** `status`/`error` ustawione wtedy i tylko wtedy, gdy `ok === false` (zwykły interfejs — patrz ConverseVerdict). */
export interface ConverseCheck { ok: boolean; status?: 400 | 403; error?: string; parties: Map<string, Party> }

/**
 * Sprawdza politykę dla osoby `me` wobec KAŻDEGO z `otherIds`. Zwraca pierwszą odmowę
 * (z nazwiskiem, żeby komunikat był konkretny) albo ok z mapą profili. Dociąga profile i —
 * tylko gdy po którejś stronie jest pracownik tymczasowy — jego koordynatora.
 */
export async function assertCanConverse(me: { id: string; role: string }, otherIds: string[]): Promise<ConverseCheck> {
  const ids = [...new Set(otherIds.filter(Boolean))];
  const [profiles, blocked] = await Promise.all([profilesMap([me.id, ...ids]), getBlockedPairs()]);

  const parties = new Map<string, Party>();
  for (const [id, p] of profiles) parties.set(id, { id, role: p.role || '', full_name: p.full_name || '—' });

  const myCoordinator = isTempWorker(me.role) ? await coordinatorOf(me.id) : null;

  for (const uid of ids) {
    const other = parties.get(uid);
    if (!other) return { ok: false, status: 400, error: 'Nieznany użytkownik', parties };
    const otherCoordinator = isTempWorker(other.role) ? await coordinatorOf(uid) : null;
    const verdict: ConverseVerdict = canConverse(me.role, other.role, {
      idA: me.id, idB: uid, coordinatorOfA: myCoordinator, coordinatorOfB: otherCoordinator, blocked,
    });
    if (!verdict.ok) return { ok: false, status: 403, error: `${verdict.reason}: ${other.full_name}`, parties };
  }
  return { ok: true, parties };
}

/** Istniejąca rozmowa 1:1 między dwiema osobami (dedupe) — albo null. */
export async function findDirectConversation(a: string, b: string): Promise<string | null> {
  const sb = admin() as any;
  const { data: mine } = await sb.from('chat_participants').select('conversation_id').eq('user_id', a);
  const ids = (mine || []).map((m: any) => m.conversation_id);
  if (!ids.length) return null;
  const { data: convs } = await sb.from('chat_conversations').select('id, chat_participants(user_id)').in('id', ids).eq('type', 'direct');
  const hit = (convs || []).find((c: any) => {
    const us = (c.chat_participants || []).map((p: any) => p.user_id);
    return us.length === 2 && us.includes(a) && us.includes(b);
  });
  return hit?.id ?? null;
}

/** Zakłada rozmowę z uczestnikami (twórca zawsze w środku). Zwraca id albo komunikat błędu. */
export async function createConversation(creatorId: string, memberIds: string[], opts: { group: boolean; name?: string | null }):
  Promise<{ id: string; name: string | null } | { error: string }> {
  const sb = admin() as any;
  const all = [...new Set([creatorId, ...memberIds])];
  const { data: conv, error } = await sb.from('chat_conversations')
    .insert({ type: opts.group ? 'group' : 'direct', name: opts.group ? (opts.name?.trim() || 'Nowa grupa') : null, created_by: creatorId })
    .select().single();
  if (error) return { error: error.message };
  const { error: pErr } = await sb.from('chat_participants').insert(all.map(uid => ({ conversation_id: conv.id, user_id: uid })));
  if (pErr) return { error: pErr.message };
  return { id: conv.id, name: conv.name ?? null };
}

/** Rozmowa 1:1 — istniejąca albo nowa (bez sprawdzania polityki; wołający sprawdza wcześniej). */
export async function findOrCreateDirect(a: string, b: string): Promise<string | { error: string }> {
  const existing = await findDirectConversation(a, b);
  if (existing) return existing;
  const created = await createConversation(a, [b], { group: false });
  return 'error' in created ? created : created.id;
}

/** Znacznik aktywności rozmowy (sortowanie listy). */
export async function touchConversation(conversationId: string): Promise<void> {
  await (admin() as any).from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
}

/** Otwarcie/wysyłka = przeczytane do teraz. */
export async function markRead(conversationId: string, userId: string): Promise<void> {
  await (admin() as any).from('chat_participants').update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId).eq('user_id', userId);
}
