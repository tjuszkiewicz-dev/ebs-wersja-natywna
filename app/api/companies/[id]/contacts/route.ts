// GET /api/companies/[id]/contacts  — lista osób kontaktowych firmy
// POST /api/companies/[id]/contacts — dodaj osobę kontaktową
// Wymaga roli superadmin.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

const ContactSchema = z.object({
  first_name:        z.string().min(1),
  last_name:         z.string().min(1),
  phone:             z.string().optional().nullable(),
  email:             z.string().email().optional().nullable(),
  is_decision_maker: z.boolean().optional(),
  is_hr_operator:    z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('company_contacts')
    .select('*')
    .eq('company_id', params.id)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('company_contacts')
    .insert({ ...parsed.data, company_id: params.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
