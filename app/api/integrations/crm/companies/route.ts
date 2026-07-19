// POST /api/integrations/crm/companies
// Kierunek A: CRM wypycha PODPISANEGO (SIGNED) klienta → EBS tworzy/łączy firmę
// origin=CRM_SYNC. Autoryzacja machine-to-machine: Bearer INTERNAL_API_KEY
// (env po stronie EBS = EBS_API_KEY po stronie CRM). Match po NIP; przedstawiciel
// po EMAILU (manager_email → advisor_id). Zwraca { id, external_crm_id }.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const expected = (process.env.INTERNAL_API_KEY ?? '').trim();
  const provided = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const nip = String(body?.nip ?? '').trim();
  const name = String(body?.name ?? '').trim();
  if (!nip || !name) {
    return NextResponse.json({ error: 'nip i name są wymagane' }, { status: 422 });
  }

  const db = supabaseServer();

  // manager_email → advisor_id (auth.users). Email = klucz przedstawiciela.
  let advisorId: string | null = null;
  const managerEmail = body?.manager_email ? String(body.manager_email).toLowerCase() : null;
  if (managerEmail) {
    const { data: authUsers } = await db.auth.admin.listUsers();
    if (authUsers?.users) {
      for (const u of authUsers.users) {
        if (u.email?.toLowerCase() === managerEmail) {
          advisorId = u.id;
          break;
        }
      }
    }
  }

  const externalCrmId = String(body?.external_crm_id ?? '').trim() || null;

  // Istniejąca firma po NIP → LINKUJEMY (nie clobberujemy origin/advisora firmy NATIVE).
  const { data: existing } = await db
    .from('companies')
    .select('id, external_crm_id')
    .eq('nip', nip)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await db
      .from('companies')
      .update({ external_crm_id: externalCrmId, is_sync_managed: true })
      .eq('id', existing.id)
      .select('id, external_crm_id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: updated.id, external_crm_id: updated.external_crm_id, linked: true }, { status: 200 });
  }

  // fee_percent tylko jeśli w dozwolonym zakresie (CHECK 15–31); inaczej default EBS (20).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = {
    name,
    nip,
    address_street: body?.address_street ?? null,
    address_city: body?.address_city ?? null,
    address_zip: body?.address_zip ?? null,
    advisor_id: advisorId,
    origin: 'CRM_SYNC',
    external_crm_id: externalCrmId,
    is_sync_managed: true,
  };
  const fp = Number(body?.fee_percent);
  if (Number.isFinite(fp) && fp >= 15 && fp <= 31) row.fee_percent = fp;

  const { data: inserted, error } = await db
    .from('companies')
    .insert(row)
    .select('id, external_crm_id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: inserted.id, external_crm_id: inserted.external_crm_id, created: true }, { status: 201 });
}
