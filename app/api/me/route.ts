// GET  /api/me — profil zalogowanego użytkownika
// PATCH /api/me — aktualizacja własnych danych (adres, telefon, email, iban)

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const UpdateSchema = z.object({
  phone_number:   z.string().optional(),
  address_street: z.string().optional(),
  address_zip:    z.string().optional(),
  address_city:   z.string().optional(),
  iban:           z.string().optional(),
}).strict();

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = supabaseServer();

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, pesel, phone_number, department, position, contract_type, hire_date, status, iban, iban_verified, address_street, address_zip, address_city, created_at, role, company_id')
    .eq('id', auth.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pobierz email z auth
  const { data: authUser } = await supabase.auth.admin.getUserById(auth.id);
  const email = authUser?.user?.email ?? '';

  // Saldo voucherów
  const { data: va } = await supabase
    .from('voucher_accounts')
    .select('balance')
    .eq('user_id', auth.id)
    .single();

  return NextResponse.json({ ...profile, email, voucherBalance: va?.balance ?? 0 });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', auth.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
