// GET  /api/employees?companyId=<id>  — kartoteka pracowników firmy
// POST /api/employees                  — dodaj pracownika (tworzy konto auth + profil)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

const QuerySchema = z.object({
  companyId: z.string().min(1),
});

const CreateEmployeeSchema = z.object({
  companyId:    z.string().min(1),
  firstName:    z.string().min(1),
  lastName:     z.string().min(1),
  email:        z.string().email(),
  pesel:        z.string().optional(),
  department:   z.string().optional(),
  position:     z.string().optional(),
  phoneNumber:  z.string().optional(),
  iban:         z.string().optional(),
  contractType: z.enum(['UOP', 'UZ']).optional(),
});

const normPesel = (s?: string | null) => (s ?? '').replace(/\D/g, '');

/**
 * Unikalny e-mail logowania (alias) dla kolejnego rekordu tej samej osoby w innej
 * firmie. Prawdziwy e-mail trzymamy w contact_email. Alias osadza skrót company_id.
 */
function buildLoginAlias(realEmail: string, companyId: string, taken: Set<string>): string {
  const [localRaw, domainRaw] = realEmail.split('@');
  const local = localRaw || 'user';
  const domain = domainRaw || 'ebs.local';
  const tag = companyId.replace(/-/g, '').slice(0, 8);
  let candidate = `${local}+c${tag}@${domain}`.toLowerCase();
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${local}+c${tag}-${n}@${domain}`.toLowerCase();
    n++;
  }
  return candidate;
}

// ── GET — kartoteka pracowników firmy ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const parsed = QuerySchema.safeParse({ companyId: searchParams.get('companyId') });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Wymagany parametr: companyId' }, { status: 400 });
  }

  const { companyId } = parsed.data;
  const supabase = supabaseServer() as any;

  // Pracodawca widzi wyłącznie kartotekę WŁASNEJ firmy (dane wrażliwe: PESEL/IBAN/temp_password)
  if (auth.role === 'pracodawca') {
    const { data: callerProfile } = await supabase
      .from('user_profiles').select('company_id').eq('id', auth.id).single();
    if (callerProfile?.company_id !== companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Pobierz profile pracowników tej firmy
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, pesel, phone_number, department, position, contract_type, hire_date, status, iban, iban_verified, created_at, role, company_id, temp_password, contact_email')
    .eq('company_id', companyId)
    .eq('role', 'pracownik')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profiles || profiles.length === 0) return NextResponse.json([]);

  // Pobierz emaile z auth.users + salda voucherów równolegle
  const userIds = profiles.map(p => p.id);
  let emailMap: Record<string, string> = {};
  const balanceMap: Record<string, number> = {};

  try {
    // Pobierz emaile iterując wszystkie strony auth.users (pagination)
    const allAuthUsers: any[] = [];
    let authPage = 1;
    while (true) {
      const { data: authListData } = await supabase.auth.admin.listUsers({ perPage: 1000, page: authPage });
      const pageUsers = authListData?.users ?? [];
      allAuthUsers.push(...pageUsers);
      if (pageUsers.length < 1000) break;
      authPage++;
    }
    for (const u of allAuthUsers) {
      if (userIds.includes(u.id)) emailMap[u.id] = u.email ?? '';
    }

    const balancesResult = await supabase.from('voucher_accounts').select('user_id, balance').in('user_id', userIds);

    for (const va of balancesResult.data ?? []) {
      if (va.user_id) balanceMap[va.user_id] = va.balance ?? 0;
    }

    // Jeśli pracownik nie ma jeszcze konta voucherowego — utwórz je
    const missingIds = userIds.filter(id => !(id in balanceMap));
    if (missingIds.length > 0) {
      await supabase.from('voucher_accounts').insert(
        missingIds.map(uid => ({ user_id: uid, balance: 0 }))
      );
    }
  } catch (_) {}

  const result = profiles.map(p => ({
    id:             p.id,
    role:           p.role,
    company_id:     p.company_id,
    full_name:      p.full_name,
    email:          p.contact_email || emailMap[p.id] || '',
    login_email:    emailMap[p.id] ?? '',
    pesel:          p.pesel,
    phone_number:   p.phone_number,
    department:     p.department,
    position:       p.position,
    contract_type:  p.contract_type,
    hire_date:      p.hire_date,
    status:         (p.status ?? 'active') as 'active' | 'inactive' | 'anonymized',
    iban:           p.iban,
    iban_verified:  p.iban_verified ?? false,
    created_at:     p.created_at,
    temp_password:  p.temp_password ?? null,
    voucherBalance: balanceMap[p.id] ?? 0,
  }));

  return NextResponse.json(result);
}

// ── POST — utwórz pracownika (konto auth + profil) ────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = CreateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { companyId, firstName, lastName, email, pesel, department, position, phoneNumber, iban, contractType } = parsed.data;
  const supabase = supabaseServer() as any;
  const now = new Date().toISOString();
  const realEmail = email.toLowerCase().trim();
  const peselNorm = normPesel(pesel);

  // Generuj tymczasowe hasło
  const tempPassword =
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    Math.random().toString(36).slice(2, 6) +
    Math.floor(10 + Math.random() * 90) +
    '!';

  // Mapa wszystkich zajętych adresów auth (globalnie unikalne) + id->email.
  const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existingAuthUsers: Array<{ id: string; email?: string }> = listData?.users ?? [];
  const authEmailToId = new Map(
    existingAuthUsers.map((u: { id: string; email?: string }) => [u.email?.toLowerCase() ?? '', u.id])
  );
  const authIdToEmail = new Map(
    existingAuthUsers.map((u: { id: string; email?: string }) => [u.id, u.email?.toLowerCase() ?? ''])
  );
  const takenAuthEmails = new Set<string>([...authEmailToId.keys()].filter(Boolean) as string[]);

  // Czy ta osoba już istnieje W TEJ FIRMIE? (PESEL > e-mail kontaktowy).
  // Deduplikacja ograniczona do firmy — nigdy nie nadpisujemy rekordu innej firmy.
  const { data: companyProfiles } = await supabase
    .from('user_profiles')
    .select('id, pesel, contact_email')
    .eq('company_id', companyId)
    .eq('role', 'pracownik');

  let userId: string | undefined;
  for (const p of companyProfiles ?? []) {
    if (peselNorm && normPesel(p.pesel) === peselNorm) { userId = p.id; break; }
  }
  if (!userId) {
    for (const p of companyProfiles ?? []) {
      const pEmail = (p.contact_email?.toLowerCase() ?? '') || authIdToEmail.get(p.id) || '';
      if (realEmail && pEmail === realEmail) { userId = p.id; break; }
    }
  }

  const existedInCompany = !!userId;

  if (userId) {
    // Aktualizacja istniejącego pracownika tej firmy — zresetuj hasło.
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: tempPassword,
      email_confirm: true,
    });
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  } else {
    // Nowy rekord dla tej firmy. Login = prawdziwy e-mail jeśli wolny, inaczej alias.
    const loginEmail = (realEmail && !takenAuthEmails.has(realEmail))
      ? realEmail
      : buildLoginAlias(realEmail || `${peselNorm || 'user'}@ebs.local`, companyId, takenAuthEmails);

    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email: loginEmail,
      password: tempPassword,
      email_confirm: true,
    });
    if (authError || !newUser.user) {
      return NextResponse.json(
        { error: authError?.message ?? 'Nie udało się utworzyć konta' },
        { status: 400 }
      );
    }
    userId = newUser.user.id;
  }

  const rawIban = iban ? iban.replace(/\s+/g, '').toUpperCase() : null;
  const isUZ = contractType === 'UZ';

  // Upsert profilu użytkownika (company_id zawsze = bieżąca firma)
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert({
      id:               userId,
      role:             'pracownik',
      full_name:        `${firstName} ${lastName}`,
      company_id:       companyId,
      contact_email:    realEmail || null,
      department:       department ?? null,
      position:         position ?? null,
      phone_number:     phoneNumber ?? null,
      pesel:            pesel ?? null,
      iban:             rawIban,
      iban_verified:    !!rawIban,
      iban_verified_at: rawIban ? now : null,
      contract_type:    isUZ ? 'UZ' : 'UOP',
      status:           'active',
      terms_accepted:   true,
      terms_accepted_at: now,
    }, { onConflict: 'id' });

  if (profileError) {
    // Usuwamy świeżo utworzone konto auth tylko jeśli to my je założyliśmy
    if (!existedInCompany) {
      await supabase.auth.admin.deleteUser(userId);
    }
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Zapisz temp_password osobno (kolumna może nie być w cache schemy przy upsert)
  await supabase
    .from('user_profiles')
    .update({ temp_password: tempPassword })
    .eq('id', userId);

  const loginEmailOut = authIdToEmail.get(userId) || realEmail;
  return NextResponse.json({
    id:           userId,
    email:        realEmail,
    loginEmail:   loginEmailOut,
    name:         `${firstName} ${lastName}`,
    tempPassword,
    companyId,
  }, { status: 201 });
}
