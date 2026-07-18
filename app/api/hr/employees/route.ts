// GET /api/hr/employees — lista · POST — nowy pracownik (kartoteka cudzoziemców)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can, canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { coordinatorGrantedContractIds } from '@/lib/hr/coordinatorScope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const HR_ROLES = ['superadmin', 'dyrektor', 'hr', 'hr_panel', 'pracodawca', 'koordynator'];

// Role, które widzą WSZYSTKICH pracowników i akceptują kandydatów z Poczekalni.
// Zwykły koordynator widzi tylko swoich (coordinator_id = on) — wszędzie w Agencji.
const SEE_ALL_ROLES = ['superadmin', 'dyrektor', 'szef_koordynatorow', 'hr', 'hr_panel', 'pracodawca'];

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const candidates = searchParams.get('candidates') === '1';
  let q = (admin() as any).from('hr_employees').select('*, contract:hr_contracts(id, name), accommodation:hr_accommodations(id, name, address, street, house_no, apartment_no, postal_code, city, voivodeship, county, commune, post_office), hr_documents(count)').order('last_name', { ascending: true });
  // Poczekalnia: ?candidates=1 → tylko kandydaci; domyślnie kandydaci są ukryci
  q = q.eq('candidate', candidates);
  // Archiwum: domyślnie tylko aktywni; ?archived=1 → tylko zarchiwizowani
  q = searchParams.get('archived') === '1' ? q.eq('archived', true) : q.eq('archived', false);
  // koordynator: swoi pracownicy + pracownicy z kontraktów jawnie mu przyznanych (Ustawienia);
  // kandydaci — tylko swoi zgłoszeni
  const seeAll = SEE_ALL_ROLES.includes(auth.role ?? '');
  if (!seeAll) {
    if (candidates) {
      q = q.eq('submitted_by', auth.id);
    } else {
      const granted = auth.role === 'koordynator' ? await coordinatorGrantedContractIds(auth.id) : [];
      q = granted.length
        ? q.or(`coordinator_id.eq.${auth.id},contract_id.in.(${granted.join(',')})`)
        : q.eq('coordinator_id', auth.id);
    }
  }
  const cid = searchParams.get('contractId');
  if (cid) q = q.eq('contract_id', cid);
  if (searchParams.get('unassigned') === '1') q = q.is('contract_id', null);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Poczekalnia: dopisz nazwiska zgłaszających + flagę uprawnienia do akceptacji
  if (candidates) {
    const ids = [...new Set((data ?? []).map((e: any) => e.submitted_by).filter(Boolean))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: users } = await (admin() as any).from('user_profiles').select('id, full_name').in('id', ids);
      for (const u of users ?? []) names.set(u.id, u.full_name || u.id);
    }
    const employees = (data ?? []).map((e: any) => ({ ...e, submitted_by_name: names.get(e.submitted_by) ?? null }));
    return NextResponse.json({ employees, can_accept: ['superadmin', 'dyrektor', 'szef_koordynatorow'].includes(auth.role ?? '') });
  }
  return NextResponse.json({ employees: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => null);
  if (!b?.first_name?.trim() || !b?.last_name?.trim()) {
    return NextResponse.json({ error: 'Imię i nazwisko są wymagane' }, { status: 400 });
  }
  // Zgłoszenie kandydata do Poczekalni: bez kontraktu; koordynatorem domyślnie zgłaszający.
  // Koordynator ZAWSZE zgłasza przez Poczekalnię (nie dodaje wprost do kontraktu).
  const isCandidate = b.candidate === true || auth.role === 'koordynator';

  // zawód/specjalizacja wymagany przy zgłaszaniu kandydata
  if (isCandidate && !b.profession?.trim()) {
    return NextResponse.json({ error: 'Zawód / specjalizacja jest wymagana przy zgłaszaniu kandydata' }, { status: 400 });
  }

  // WALIDACJA CZARNEJ LISTY: nie przyjmujemy ponownie osoby oflagowanej w Archiwum
  // (dopasowanie po nr. paszportu lub po imieniu i nazwisku)
  const fn = b.first_name.trim().toLowerCase();
  const ln = b.last_name.trim().toLowerCase();
  const pass = (b.passport_number || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const { data: black } = await (admin() as any).from('hr_employees')
    .select('first_name, last_name, passport_number, blacklist_reason')
    .eq('blacklisted', true);
  const hit = (black || []).find((x: any) =>
    (pass && (x.passport_number || '').replace(/[^a-z0-9]/gi, '').toLowerCase() === pass) ||
    ((x.first_name || '').trim().toLowerCase() === fn && (x.last_name || '').trim().toLowerCase() === ln));
  if (hit) {
    return NextResponse.json({ error: `Ta osoba jest na CZARNEJ LIŚCIE w Archiwum${hit.blacklist_reason ? ` — powód: ${hit.blacklist_reason}` : ''}. Sprawdź Archiwum przed ponownym przyjęciem.` }, { status: 409 });
  }
  // WALIDACJA DUPLIKATU: nie dodajemy dwa razy tej samej osoby — dopasowanie po nr. paszportu
  if (pass) {
    const { data: dupRows } = await (admin() as any).from('hr_employees')
      .select('*, contract:hr_contracts(id, name), accommodation:hr_accommodations(id, name, address)')
      .eq('archived', false);
    const dup = (dupRows || []).find((x: any) => (x.passport_number || '').replace(/[^a-z0-9]/gi, '').toLowerCase() === pass);
    if (dup) {
      const dupName = [dup.first_name, dup.second_name, dup.last_name, dup.second_last_name].filter(Boolean).join(' ');
      return NextResponse.json({
        error: `Pracownik o tym numerze paszportu już istnieje: ${dupName}${dup.contract?.name ? ` — kontrakt „${dup.contract.name}"` : dup.candidate ? ' — Poczekalnia' : ''}.`,
        duplicate: true, existing: dup,
      }, { status: 409 });
    }
  }
  const { data, error } = await (admin() as any).from('hr_employees').insert({
    candidate: isCandidate,
    submitted_by: isCandidate ? auth.id : null,
    submitted_at: isCandidate ? new Date().toISOString() : null,
    first_name: b.first_name.trim(),
    second_name: b.second_name?.trim() || null,
    last_name: b.last_name.trim(),
    second_last_name: b.second_last_name?.trim() || null,
    language: b.language?.trim() || null,
    profession: b.profession?.trim() || null,
    coordinator_id: isCandidate ? (auth.role === 'koordynator' ? auth.id : b.coordinator_id || null) : (b.coordinator_id || null),
    phone: b.phone?.trim() || null,
    email: b.email?.trim() || null,
    bank_account: b.bank_account?.trim() || null,
    country_of_origin: b.country_of_origin?.trim() || null,
    shoe_size: b.shoe_size?.trim() || null,
    clothing_size: b.clothing_size?.trim() || null,
    notes: b.notes?.trim() || null,
    status: b.status || 'active',
    contract_id: isCandidate ? null : (b.contract_id || null),
    team: b.team?.trim() || null,
    created_by: auth.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
