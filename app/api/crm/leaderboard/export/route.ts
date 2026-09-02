// GET /api/crm/leaderboard/export?period=… — ranking jako CSV.
// Port z BBS-Unified (E7d). Adaptacje:
//  - bramka `can(auth,'crm.leaderboard')` zamiast listy ról zaszytej w kodzie;
//  - **kolumna „Premia_bazowa" NIE ma zaszytych kwot.** BBS wpisywał na sztywno
//    5000/3000/1000 zł za złoto/srebro/brąz — to jego regulamin premiowy, nie Strattona,
//    a plik trafia do ludzi. Kwoty bierzemy z env `LEADERBOARD_PREMIA_{ZLOTO,SREBRO,BRAZ}`;
//    gdy nie są ustawione, kolumna po prostu nie powstaje (lepiej jej nie mieć niż podać
//    cudzą stawkę). Reguły prowizji MLM pozostają poza zakresem E7 (K8 w specu).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { fetchLeaderboard, type LeaderboardEntry, type Period } from '@/lib/crm/leaderboard';

function premie(): { gold: string; silver: string; bronze: string } | null {
  const g = process.env.LEADERBOARD_PREMIA_ZLOTO;
  const s = process.env.LEADERBOARD_PREMIA_SREBRO;
  const b = process.env.LEADERBOARD_PREMIA_BRAZ;
  if (!g && !s && !b) return null;
  return { gold: g ?? '', silver: s ?? '', bronze: b ?? '' };
}

/**
 * Komórka CSV wg RFC 4180 + ochrona przed wstrzyknięciem formuły.
 * - prefiks `=`, `+`, `-`, `@`, tab, CR poprzedzamy apostrofem (Excel nie policzy tego jako wzoru)
 * - wartość z przecinkiem, cudzysłowem lub nową linią bierzemy w cudzysłowy, a cudzysłowy podwajamy
 */
function csvCell(v: string | number): string {
  const s = String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function buildCsv(entries: LeaderboardEntry[]): string {
  // BOM UTF-8 — bez niego Excel na Windowsie rozjeżdża polskie znaki (ą, ę, ó, ż…)
  const BOM = '﻿';
  const bonus = premie();

  const kolumny = ['Miejsce', 'Handlowiec', 'Leady', 'Umowy', 'Konwersja%'];
  if (bonus) kolumny.push('Premia_bazowa');

  const rows = entries.map(entry => {
    const komorki = [
      csvCell(entry.rank),
      csvCell(entry.full_name),
      csvCell(entry.leads_count),
      csvCell(entry.deals_closed),
      csvCell(entry.conversion_rate.toFixed(2)),
    ];
    if (bonus) komorki.push(csvCell(entry.badge ? bonus[entry.badge] : ''));
    return komorki.join(',');
  });

  return BOM + [kolumny.join(','), ...rows].join('\r\n');
}

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.leaderboard'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const periodParam = new URL(request.url).searchParams.get('period') ?? 'month';
  const period: Period = (['month', 'quarter', 'year'] as const).includes(periodParam as Period)
    ? (periodParam as Period)
    : 'month';

  try {
    const csv = buildCsv(await fetchLeaderboard(auth.id, auth.role, period));
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leaderboard-${period}.csv"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
