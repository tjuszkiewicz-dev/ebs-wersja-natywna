// GET /api/invoices?companyId=<uuid> — lista dokumentów księgowych (nota + faktura_vat)
// Zwraca financial_documents dla danej firmy, posortowane od najnowszych.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const QuerySchema = z.object({
  companyId: z.string().uuid('Wymagany prawidłowy UUID companyId'),
});

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const parsed = QuerySchema.safeParse({ companyId: searchParams.get('companyId') });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { companyId } = parsed.data;

  // Pracodawca może widzieć tylko dokumenty swojej firmy
  if (auth.role === 'pracodawca') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', auth.id)
      .single();
    if (profile?.company_id !== companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from('financial_documents')
    .select('*')
    .eq('company_id', companyId)
    .order('issued_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
