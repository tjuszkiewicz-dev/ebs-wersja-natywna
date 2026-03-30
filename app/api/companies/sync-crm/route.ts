// POST /api/companies/sync-crm — synchronizacja firm z zewnętrznego CRM
// Tylko superadmin. Importuje firmy ze statusem SIGNED które nie istnieją w DB (match po NIP).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

// Mockowe dane CRM — w produkcji zastąpić HTTP call do zewnętrznego API
const MOCK_CRM_PAYLOAD = [
  {
    crm_id:        'CRM-1001',
    name:          'Omega Logistics Sp. z o.o.',
    nip:           '7770001122',
    status:        'SIGNED',
    address_street: 'Magazynowa 4',
    address_city:  'Poznań',
    address_zip:   '60-001',
    manager_email: 'adam.d@eliton-benefits.com',
  },
  {
    crm_id:        'CRM-1002',
    name:          'Pixel Art Studio',
    nip:           '8880003344',
    status:        'NEGOTIATION',
    address_street: 'Designerska 8',
    address_city:  'Wrocław',
    address_zip:   '50-001',
  },
  {
    crm_id:        'CRM-1003',
    name:          'Green Energy S.A.',
    nip:           '9990005566',
    status:        'SIGNED',
    address_street: 'Słoneczna 15',
    address_city:  'Gdańsk',
    address_zip:   '80-001',
    manager_email: 'marek.m@eliton-benefits.com',
  },
];

export async function POST(_req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer();

  // Pobierz istniejące NIP-y żeby wykryć duplikaty
  const { data: existingCompanies } = await supabase
    .from('companies')
    .select('nip');

  const existingNips = new Set((existingCompanies ?? []).map((c: any) => c.nip));

  const signedCrmCompanies = MOCK_CRM_PAYLOAD.filter(c => c.status === 'SIGNED');
  const skippedCount = MOCK_CRM_PAYLOAD.length - signedCrmCompanies.length;
  const toImport = signedCrmCompanies.filter(c => !existingNips.has(c.nip));

  if (toImport.length === 0) {
    return NextResponse.json({
      imported: 0,
      skipped: skippedCount,
      message: 'Brak nowych firm o statusie SIGNED w systemie źródłowym.',
    });
  }

  // Pobierz user_profiles by dopasować manager_email → advisor_id
  const managerEmails = toImport
    .map(c => c.manager_email)
    .filter(Boolean) as string[];

  let emailToId: Record<string, string> = {};
  if (managerEmails.length > 0) {
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    if (authUsers?.users) {
      for (const u of authUsers.users) {
        if (u.email && managerEmails.includes(u.email)) {
          emailToId[u.email] = u.id;
        }
      }
    }
  }

  const rows = toImport.map(c => ({
    name:             c.name,
    nip:              c.nip,
    address_street:   c.address_street,
    address_city:     c.address_city,
    address_zip:      c.address_zip,
    advisor_id:       c.manager_email ? (emailToId[c.manager_email] ?? null) : null,
    origin:           'CRM_SYNC' as const,
    external_crm_id:  c.crm_id,
    is_sync_managed:  true,
  }));

  const { data: inserted, error } = await supabase
    .from('companies')
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    imported:  inserted?.length ?? 0,
    skipped:   skippedCount,
    companies: inserted,
  });
}
