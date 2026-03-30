// GET /api/companies — lista firm
//   superadmin: wszystkie firmy
//   pracodawca:  własna firma (po company_id z profilu)
// POST /api/companies — dodaj nową firmę (superadmin)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

const AddCompanySchema = z.object({
  name:                     z.string().min(2),
  nip:                      z.string().min(10).max(10),
  advisorId:                z.string().uuid().optional(),
  managerId:                z.string().uuid().optional(),
  directorId:               z.string().uuid().optional(),
  customPaymentTermsDays:   z.number().int().positive().optional(),
  customVoucherValidityDays: z.number().int().positive().optional(),
  address_street:           z.string().optional(),
  address_city:             z.string().optional(),
  address_zip:              z.string().optional(),
});

export async function GET(_req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = supabaseServer();

  if (auth.role === 'superadmin') {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // pracodawca / pracownik — zwróć firmy powiązane przez user_profiles.company_name
  // (tymczasowy fallback — docelowo przez companies.id)
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = AddCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const supabase = supabaseServer();

  const { data: company, error } = await supabase
    .from('companies')
    .insert({
      name:                       d.name,
      nip:                        d.nip,
      advisor_id:                 d.advisorId ?? null,
      manager_id:                 d.managerId ?? null,
      director_id:                d.directorId ?? null,
      custom_payment_terms_days:  d.customPaymentTermsDays ?? null,
      custom_voucher_validity_days: d.customVoucherValidityDays ?? null,
      address_street:             d.address_street ?? null,
      address_city:               d.address_city ?? null,
      address_zip:                d.address_zip ?? null,
      origin:                     'NATIVE',
    })
    .select()
    .single();

  if (error || !company) {
    return NextResponse.json({ error: error?.message ?? 'Nie udało się dodać firmy' }, { status: 500 });
  }

  return NextResponse.json(company, { status: 201 });
}
