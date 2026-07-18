// GET /api/hr/settlements/transfers?period=YYYY-MM[&format=csv|elixir]
// Paczka przelewów wynagrodzeń: kwota „do wypłaty" (jak w Rozliczeniach) dla pracowników
// z dodatnim saldem i podanym nr konta. CSV (import w bankowości) lub Elixir-0 (bramka bankowa).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';
import { fullName } from '@/lib/hr/docPlaceholders';
import { rentSharePerPerson } from '@/lib/hr/rentShare';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cleanIban = (s?: string | null) => String(s || '').replace(/\s+/g, '').toUpperCase();
const plAmount = (n: number) => n.toFixed(2).replace('.', ',');
const csvCell = (s: string) => `"${String(s).replace(/"/g, '""')}"`;

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.rozliczenia'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (auth.role === 'koordynator') return NextResponse.json({ error: 'Koordynator nie generuje przelewów' }, { status: 403 });
  const url = new URL(request.url);
  const period = url.searchParams.get('period');
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();
  if (!/^\d{4}-\d{2}$/.test(period || '')) return NextResponse.json({ error: 'Podaj okres YYYY-MM' }, { status: 400 });

  const sb = admin() as any;
  const [emp, set, adv, pay] = await Promise.all([
    sb.from('hr_employees').select('id, first_name, second_name, last_name, second_last_name, bank_account, accommodation:hr_accommodations(monthly_rent, rented_spots, capacity)').eq('archived', false).eq('candidate', false),
    sb.from('hr_settlements').select('*').eq('period', period),
    sb.from('hr_advances').select('employee_id, amount').eq('period', period),
    sb.from('hr_payouts').select('employee_id, amount').eq('period', period),
  ]);
  const setMap = new Map((set.data || []).map((s: any) => [s.employee_id, s]));
  const advMap = new Map<string, number>(); for (const a of adv.data || []) advMap.set(a.employee_id, (advMap.get(a.employee_id) || 0) + Number(a.amount || 0));
  const payMap = new Map<string, number>(); for (const p of pay.data || []) payMap.set(p.employee_id, (payMap.get(p.employee_id) || 0) + Number(p.amount || 0));

  const rows: { name: string; iban: string; amount: number; title: string }[] = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const e of emp.data || []) {
    const s: any = setMap.get(e.id);
    const rate = Number(s?.rate || 0), hours = Number(s?.hours || 0);
    const gross = (s?.rate_type === 'monthly') ? rate : rate * hours;
    const remaining = Math.round((gross + Number(s?.bonus || 0) - (advMap.get(e.id) || 0) - (payMap.get(e.id) || 0) - Number(s?.housing_deduction || 0) - Number(s?.other_deduction || 0) - rentSharePerPerson((e as any).accommodation)) * 100) / 100;
    if (remaining <= 0) continue;
    const name = fullName(e);
    const iban = cleanIban((e as any).bank_account);
    if (!iban || iban.replace(/\D/g, '').length < 20) { skipped.push({ name, reason: 'brak/niepełny nr konta' }); continue; }
    rows.push({ name, iban, amount: remaining, title: `Wynagrodzenie ${period}` });
  }

  if (format === 'json') return NextResponse.json({ period, rows, skipped, suma: Math.round(rows.reduce((a, r) => a + r.amount, 0) * 100) / 100 });

  if (format === 'elixir') {
    // Elixir-0 (uproszczony, typ 110 — przelew krajowy). Sortowanie i pełna zgodność zależą od banku.
    const dateStr = period.replace('-', '') + '01';
    const lines = rows.map(r => {
      const grosze = Math.round(r.amount * 100);
      const ibanDigits = r.iban.replace(/\D/g, '');
      const bank = ibanDigits.slice(2, 10); // numer rozliczeniowy banku (8 cyfr po kodzie kraju)
      return ['110', dateStr, grosze, '0', bank, '0', `"${r.iban}"`, `"${r.name}"`, '""', `"${r.title}"`, '', '', '51', ''].join(',');
    });
    const body = '﻿' + lines.join('\r\n') + '\r\n';
    return new NextResponse(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="przelewy-${period}.txt"` } });
  }

  // CSV (domyślny) — import w bankowości elektronicznej: Odbiorca;Nr konta;Kwota;Tytuł
  const header = ['Odbiorca', 'Numer konta', 'Kwota', 'Tytul przelewu'].map(csvCell).join(';');
  const body = '﻿' + [header, ...rows.map(r => [r.name, r.iban, plAmount(r.amount), r.title].map(csvCell).join(';'))].join('\r\n') + '\r\n';
  return new NextResponse(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="przelewy-${period}.csv"` } });
}
