// Kolejka zgłoszeń BOK — strona serwerowa: bramka uprawnień, lista z filtrem i licznikami,
// dekoracja wierszy danymi pracownika/obsługującego, zapis obsługi. Czysta logika (statusy,
// filtry, patch) siedzi w ./bokQueue — tu tylko I/O na service_role.
// Spec: docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §11.
import { NextResponse } from 'next/server';
import { getAuthUserWithRole, type AuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { supabaseServer } from '@/lib/supabase';
import {
  type HandlingInput, type QueueKind, type QueueStatus, QUEUE_STATUSES,
  autoServiceIds, buildHandlingPatch, parsePaging, parseStatusFilter, partnerFor, statusesForFilter,
} from './bokQueue';

/** Klucz z rejestru uprawnień (grupa „Benefity"); superadmin/owner ma go zawsze. */
export const BOK_QUEUE_PERMISSION = 'benefity.zgloszenia';

const TABLE: Record<QueueKind, string> = { orders: 'benefit_order_fulfillments', inquiries: 'benefit_inquiries' };
const DATE_COL: Record<QueueKind, string> = { orders: 'ordered_at', inquiries: 'created_at' };
const COLS: Record<QueueKind, string> = {
  orders:    'id, transaction_id, user_id, service_id, service_name, amount, fulfillment, status, note, handled_by, handled_at, ordered_at, updated_at',
  inquiries: 'id, user_id, service_id, service_name, partner, status, note, handled_by, handled_at, created_at, updated_at',
};

/** 401 bez sesji, 403 bez uprawnienia — wzorzec agencji/CRM (`can()`), nie lista ról w kodzie. */
export async function bokQueueGate(): Promise<{ auth: AuthUserWithRole; res?: undefined } | { auth?: undefined; res: NextResponse }> {
  const auth = await getAuthUserWithRole();
  if (!auth) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!(await can(auth, BOK_QUEUE_PERMISSION))) return { res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { auth };
}

export interface QueueEmployee {
  id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
}

/** Wiersz kolejki w kształcie wspólnym dla obu tabel (ekran nie musi wiedzieć, skąd pochodzi). */
export interface QueueRow {
  id: string;
  kind: QueueKind;
  service_id: string;
  service_name: string;
  partner: string | null;
  amount: number | null;          // punkty — tylko zamówienia
  fulfillment: 'auto' | 'bok' | null; // tylko zamówienia
  transaction_id: string | null;  // tylko zamówienia (wpis w księdze)
  status: QueueStatus;
  note: string | null;
  created_at: string;             // zamówienia: data z księgi (ordered_at)
  handled_by: string | null;
  handled_by_name: string | null;
  handled_at: string | null;
  employee: QueueEmployee;
}

type RawRow = Record<string, any>;

/**
 * Dane pracownika do kontaktu (imię i nazwisko, e-mail logowania, telefon, firma) i nazwisko
 * obsługującego. E-maile z `auth.users` przez `listUsers` — konwencja repo (/api/users);
 * `contact_email` z profilu jako zapas.
 */
export async function decorateQueueRows(kind: QueueKind, raw: RawRow[]): Promise<QueueRow[]> {
  const supabase = supabaseServer();
  const db = supabase as any;
  const userIds = [...new Set(raw.map(r => r.user_id).filter(Boolean) as string[])];
  const handlerIds = [...new Set(raw.map(r => r.handled_by).filter(Boolean) as string[])];
  const allIds = [...new Set([...userIds, ...handlerIds])];

  const profiles = new Map<string, { full_name: string | null; phone_number: string | null; company_id: string | null; contact_email: string | null }>();
  const companies = new Map<string, string>();
  const emails = new Map<string, string>();

  if (allIds.length) {
    const { data } = await db.from('user_profiles')
      .select('id, full_name, phone_number, company_id, contact_email').in('id', allIds);
    for (const p of data ?? []) profiles.set(p.id, p);
  }
  const companyIds = [...new Set(userIds.map(id => profiles.get(id)?.company_id).filter(Boolean) as string[])];
  if (companyIds.length) {
    const { data } = await db.from('companies').select('id, name').in('id', companyIds);
    for (const c of data ?? []) companies.set(c.id, c.name);
  }
  if (userIds.length) {
    const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? []) if (u.email) emails.set(u.id, u.email);
  }

  return raw.map((r): QueueRow => {
    const p = r.user_id ? profiles.get(r.user_id) : undefined;
    const h = r.handled_by ? profiles.get(r.handled_by) : undefined;
    return {
      id: r.id,
      kind,
      service_id: r.service_id,
      service_name: r.service_name,
      partner: kind === 'orders' ? (partnerFor(r.service_id) ?? null) : (r.partner ?? null),
      amount: kind === 'orders' ? Number(r.amount ?? 0) : null,
      fulfillment: kind === 'orders' ? r.fulfillment : null,
      transaction_id: kind === 'orders' ? r.transaction_id : null,
      status: r.status,
      note: r.note ?? null,
      created_at: kind === 'orders' ? r.ordered_at : r.created_at,
      handled_by: r.handled_by ?? null,
      // `|| '—'`, nie `??`: profil z full_name=NULL ma być kreską, nie pustym stringiem
      handled_by_name: r.handled_by ? (h?.full_name || '—') : null,
      handled_at: r.handled_at ?? null,
      employee: {
        id: r.user_id ?? null,
        name: p?.full_name || (r.user_id ? '—' : 'Konto usunięte'),
        email: (r.user_id && emails.get(r.user_id)) || p?.contact_email || null,
        phone: p?.phone_number || null,
        company: (p?.company_id && companies.get(p.company_id)) || null,
      },
    };
  });
}

export type StatusCounts = Record<QueueStatus, number>;

async function countByStatus(db: any, table: string): Promise<StatusCounts> {
  const results = await Promise.all(QUEUE_STATUSES.map(s =>
    db.from(table).select('id', { count: 'exact', head: true }).eq('status', s)));
  return Object.fromEntries(QUEUE_STATUSES.map((s, i) => [s, results[i].count ?? 0])) as StatusCounts;
}

export interface QueueListResult {
  rows: QueueRow[]; total: number; counts: StatusCounts; limit: number; offset: number; filter: string;
}

/**
 * Lista kolejki. Dla zamówień najpierw samonaprawa z księgi (`bok_sync_order_queue`) — kolejka
 * jest pochodną `voucher_transactions`, więc nie może zgubić zakupu; błąd synchronizacji nie
 * blokuje odczytu (log + to, co już jest w tabeli).
 */
export async function listQueue(kind: QueueKind, sp: URLSearchParams): Promise<QueueListResult> {
  const db = supabaseServer() as any;
  if (kind === 'orders') {
    const { error } = await db.rpc('bok_sync_order_queue', { p_auto_service_ids: autoServiceIds() });
    if (error) console.error('[bok-queue] sync failed', error.message);
  }
  const filter = parseStatusFilter(sp.get('status'));
  const { limit, offset } = parsePaging(sp.get('limit'), sp.get('offset'));
  const { data, count, error } = await db.from(TABLE[kind])
    .select(COLS[kind], { count: 'exact' })
    .in('status', statusesForFilter(filter))
    .order(DATE_COL[kind], { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  const [rows, counts] = await Promise.all([decorateQueueRows(kind, data ?? []), countByStatus(db, TABLE[kind])]);
  return { rows, total: count ?? 0, counts, limit, offset, filter };
}

/** Liczniki obu kolejek naraz — nagłówek ekranu i (w przyszłości) plakietka w menu. */
export async function queueSummary(): Promise<Record<QueueKind, StatusCounts>> {
  const db = supabaseServer() as any;
  const { error } = await db.rpc('bok_sync_order_queue', { p_auto_service_ids: autoServiceIds() });
  if (error) console.error('[bok-queue] sync failed', error.message);
  const [orders, inquiries] = await Promise.all([countByStatus(db, TABLE.orders), countByStatus(db, TABLE.inquiries)]);
  return { orders, inquiries };
}

/** Zapis obsługi (status/notatka). `null` = wiersz nie istnieje. */
export async function patchQueueRow(kind: QueueKind, id: string, input: HandlingInput, actorId: string): Promise<QueueRow | null> {
  const db = supabaseServer() as any;
  const patch = buildHandlingPatch(input, actorId, new Date());
  const { data, error } = await db.from(TABLE[kind]).update(patch).eq('id', id).select(COLS[kind]).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [row] = await decorateQueueRows(kind, [data]);
  return row;
}
