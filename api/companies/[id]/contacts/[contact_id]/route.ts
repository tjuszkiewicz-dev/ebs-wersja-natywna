// PATCH /api/companies/[id]/contacts/[contact_id] — aktualizuj osobę kontaktową
// DELETE /api/companies/[id]/contacts/[contact_id] — usuń osobę kontaktową
// Wymaga roli superadmin.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

const UpdateSchema = z.object({
  first_name:        z.string().min(1).optional(),
  last_name:         z.string().min(1).optional(),
  phone:             z.string().optional().nullable(),
  email:             z.string().email().optional().nullable(),
  is_decision_maker: z.boolean().optional(),
  is_hr_operator:    z.boolean().optional(),
});

type Params = { params: { id: string; contact_id: string } };

async function requireSuperadmin() {
  const auth = await getAuthUserWithRole();
  if (!auth) return null;
  if (auth.role !== 'superadmin') return null;
  return auth;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireSuperadmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('company_contacts')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.contact_id)
    .eq('company_id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireSuperadmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer();
  const { error } = await supabase
    .from('company_contacts')
    .delete()
    .eq('id', params.contact_id)
    .eq('company_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
