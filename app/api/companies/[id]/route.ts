// GET  /api/companies/[id]     → zwraca dane firmy (superadmin / własne konto HR)
// PATCH /api/companies/[id]
//   body: { action: "archive" }    → ustawia archived_at = now()
//   body: { action: "unarchive" }  → ustawia archived_at = null
// Tylko superadmin. Nie usuwa danych — soft archive.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

const PatchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('archive') }),
  z.object({ action: z.literal('unarchive') }),
  z.object({
    action:      z.literal('update_settings'),
    fee_percent: z.number().min(15).max(31).optional(),
    krs:         z.string().optional().nullable(),
    regon:       z.string().optional().nullable(),
    custom_voucher_validity_days: z.number().int().positive().optional().nullable(),
    custom_payment_terms_days:   z.number().int().positive().optional().nullable(),
    voucher_expiry_day:          z.number().int().min(1).max(31).optional(),
    voucher_expiry_hour:         z.number().int().min(0).max(23).optional(),
    voucher_expiry_minute:       z.number().int().min(0).max(59).optional(),
  }),
]);

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Brak id firmy' }, { status: 400 });

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // HR może tylko update_settings na własnej firmie
  const isHrOwnCompany = auth.role === 'pracodawca' && auth.companyId === id && parsed.data.action === 'update_settings';
  if (auth.role !== 'superadmin' && !isHrOwnCompany) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer();

  // Sprawdź czy firma istnieje
  const { data: existing, error: findErr } = await supabase
    .from('companies')
    .select('id, name, archived_at')
    .eq('id', id)
    .single();

  if (findErr || !existing) {
    return NextResponse.json({ error: 'Firma nie istnieje' }, { status: 404 });
  }

  let updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (parsed.data.action === 'update_settings') {
    const d = parsed.data;
    if (d.fee_percent !== undefined)                   updatePayload.fee_percent = d.fee_percent;
    if (d.krs         !== undefined)                   updatePayload.krs = d.krs;
    if (d.regon       !== undefined)                   updatePayload.regon = d.regon;
    if (d.custom_voucher_validity_days !== undefined)  updatePayload.custom_voucher_validity_days = d.custom_voucher_validity_days;
    if (d.custom_payment_terms_days !== undefined)     updatePayload.custom_payment_terms_days = d.custom_payment_terms_days;
    if (d.voucher_expiry_day !== undefined)            updatePayload.voucher_expiry_day = d.voucher_expiry_day;
    if (d.voucher_expiry_hour !== undefined)           updatePayload.voucher_expiry_hour = d.voucher_expiry_hour;
    if (d.voucher_expiry_minute !== undefined)         updatePayload.voucher_expiry_minute = d.voucher_expiry_minute;
    // HR może też zmieniać pola adresowe i nazwę
    if ((d as any).name             !== undefined)     updatePayload.name = (d as any).name;
    if ((d as any).address_street   !== undefined)     updatePayload.address_street = (d as any).address_street;
    if ((d as any).address_city     !== undefined)     updatePayload.address_city = (d as any).address_city;
    if ((d as any).address_zip      !== undefined)     updatePayload.address_zip = (d as any).address_zip;
  } else {
    updatePayload.archived_at = parsed.data.action === 'archive' ? new Date().toISOString() : null;
  }

  const { data: updated, error: updateErr } = await supabase
    .from('companies')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? 'Błąd aktualizacji firmy' },
      { status: 500 },
    );
  }

  return NextResponse.json(updated);
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Brak id firmy' }, { status: 400 });

  // Allow superadmin to fetch any company; other roles can only fetch their own
  if (auth.role !== 'superadmin' && auth.companyId !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, nip, krs, regon, address_street, address_city, address_zip, balance_pending, balance_active, custom_voucher_validity_days, custom_payment_terms_days, voucher_expiry_day, voucher_expiry_hour, voucher_expiry_minute')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Firma nie istnieje' }, { status: 404 });
  }

  return NextResponse.json(data);
}
