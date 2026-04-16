// PATCH /api/users/[id]/email — zmień login (e-mail) pracownika (superadmin + pracodawca)

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const EmailSchema = z.object({
  email: z.string().email('Nieprawidłowy format adresu e-mail'),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = EmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = supabaseServer();

  // Pracodawca może zmieniać e-mail tylko pracownikom swojej firmy
  if (auth.role === 'pracodawca') {
    const [{ data: target }, { data: hr }] = await Promise.all([
      supabase.from('user_profiles').select('company_id').eq('id', params.id).single(),
      supabase.from('user_profiles').select('company_id').eq('id', auth.id).single(),
    ]);
    if (!target || target.company_id !== hr?.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { error } = await supabase.auth.admin.updateUserById(params.id, {
    email: parsed.data.email,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: true, email: parsed.data.email });
}
