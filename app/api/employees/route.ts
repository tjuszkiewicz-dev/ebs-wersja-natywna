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
  const supabase = supabaseServer();

  // Pobierz profile pracowników tej firmy
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, pesel, phone_number, department, position, contract_type, hire_date, status, iban, iban_verified, created_at, role, company_id, temp_password')
    .eq('company_id', companyId)
    .eq('role', 'pracownik')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profiles || profiles.length === 0) return NextResponse.json([]);

  // Pobierz emaile z auth.users (service_role)
  const userIds = profiles.map(p => p.id);
  let emailMap: Record<string, string> = {};
  try {
    const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authList?.users) {
      for (const u of authList.users) {
        if (userIds.includes(u.id)) emailMap[u.id] = u.email ?? '';
      }
    }
  } catch (_) {}

  const result = profiles.map(p => ({
    id:            p.id,
    full_name:     p.full_name,
    email:         emailMap[p.id] ?? '',
    pesel:         p.pesel,
    phone_number:  p.phone_number,
    department:    p.department,
    position:      p.position,
    contract_type: p.contract_type,
    hire_date:     p.hire_date,
    status:        (p.status ?? 'active') as 'active' | 'inactive' | 'anonymized',
    iban:          p.iban,
    iban_verified: p.iban_verified ?? false,
    created_at:    p.created_at,
    temp_password: p.temp_password ?? null,
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
  const supabase = supabaseServer();
  const now = new Date().toISOString();
  const normalizedEmail = email.toLowerCase().trim();

  // Generuj tymczasowe hasło
  const tempPassword =
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    Math.random().toString(36).slice(2, 6) +
    Math.floor(10 + Math.random() * 90) +
    '!';

  // Utwórz konto w Supabase Auth
  const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError || !newUser.user) {
    return NextResponse.json(
      { error: authError?.message ?? 'Nie udało się utworzyć konta' },
      { status: 400 }
    );
  }

  const userId = newUser.user.id;
  const rawIban = iban ? iban.replace(/\s+/g, '').toUpperCase() : null;
  const isUZ = contractType === 'UZ';

  // Utwórz profil użytkownika
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      id:               userId,
      role:             'pracownik',
      full_name:        `${firstName} ${lastName}`,
      company_id:       companyId,
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
      temp_password:    tempPassword,
    });

  if (profileError) {
    // Cleanup: usuń konto auth żeby nie zostawać sierotą
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({
    id:           userId,
    email:        normalizedEmail,
    name:         `${firstName} ${lastName}`,
    tempPassword,
    companyId,
  }, { status: 201 });
}
