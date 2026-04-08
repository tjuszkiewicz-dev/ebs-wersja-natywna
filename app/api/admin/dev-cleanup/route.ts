// POST /api/admin/dev-cleanup — TYLKO DEVELOPMENT
// Truncuje tabele transakcyjne (omija trigger immutability przez TRUNCATE)
// i usuwa zamówienia + konta auth pracowników.
// NIGDY nie eksponować w produkcji.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Niedostępne w produkcji' }, { status: 403 });
  }

  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Wymagana rola superadmin' }, { status: 403 });
  }

  const supabase = supabaseServer();
  const results: string[] = [];

  try {
    // 1. TRUNCATE voucher_transactions — omija trigger FOR EACH ROW
    await supabase.rpc('exec_cleanup_sql', {
      sql_query: 'TRUNCATE TABLE voucher_transactions RESTART IDENTITY CASCADE'
    });
    results.push('voucher_transactions: TRUNCATE OK');
  } catch (_) {
    // Fallback: użyj surowego SQL przez pg-meta endpoint (Supabase hosted)
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL
      ?.replace('https://', '')
      .replace('.supabase.co', '');
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const sqlStatements = [
      'TRUNCATE TABLE commissions CASCADE',
      'TRUNCATE TABLE employee_purchases CASCADE',
      'DELETE FROM employee_vouchers',
      'DELETE FROM vouchers',
      'DELETE FROM voucher_accounts',
      'TRUNCATE TABLE voucher_transactions CASCADE',
      'DELETE FROM voucher_orders',
    ];

    for (const sql of sqlStatements) {
      try {
        const resp = await fetch(
          `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${svc}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: sql }),
          }
        );
        const txt = await resp.text();
        results.push(`${sql.split(' ').slice(0, 3).join(' ')}: ${resp.ok ? 'OK' : txt.slice(0, 100)}`);
      } catch (e: any) {
        results.push(`${sql.slice(0, 40)}: ERROR ${e.message}`);
      }
    }
  }

  // 2. Pobierz i usuń konta auth pracowników
  const { data: employees } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('role', 'pracownik');

  if (employees?.length) {
    for (const emp of employees) {
      await supabase.auth.admin.deleteUser(emp.id);
    }
    results.push(`Usunięto ${employees.length} kont auth pracowników`);
  }

  return NextResponse.json({ ok: true, steps: results });
}
