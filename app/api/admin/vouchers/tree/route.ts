// GET /api/admin/vouchers/tree
// Zwraca zagregowane drzewo Firma -> Pracownik przez admin_voucher_tree() RPC.
// Uzywa SECURITY DEFINER - omija limit 1000 wierszy PostgREST.
// Tylko dla superadmin.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function GET(_req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer();

  // admin_voucher_tree() jest SECURITY DEFINER - nie podlega limitowi max_rows
  const { data, error } = await supabase.rpc('admin_voucher_tree');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const companies     = (data as any[]) ?? [];
  const totalVouchers = companies.reduce((s: number, c: any) => s + (c.total   ?? 0), 0);
  const totalPending  = companies.reduce((s: number, c: any) => s + (c.pending ?? 0), 0);

  return NextResponse.json({ companies, totalVouchers, totalPending });
}
