// POST /api/hr/alerts/pdf — raport PDF „Alarmy wymagające uwagi" z filtrami.
// Body: { kinds?: string[], contract?: string, search?: string, maxDays?: number }
// Serwer liczy alerty od nowa przez ten sam moduł co ekran (lib/hr/alerts —
// buildAlerts/filterAlerts), żeby raport nigdy nie rozjechał się z tym, co
// widać po zastosowaniu filtrów w HrPermitAlerts.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { coordinatorGrantedContractIds } from '@/lib/hr/coordinatorScope';
import { buildAlerts, filterAlerts, groupOf, ALERT_GROUPS, type AlertItem } from '@/lib/hr/alerts';
import { renderOfferPdf } from '@/lib/pdf/renderer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// widoczność jak w kartotece (app/api/hr/employees) — te role widzą wszystkich
const SEE_ALL_ROLES = ['superadmin', 'dyrektor', 'szef_koordynatorow', 'hr', 'hr_panel', 'pracodawca'];

const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('pl-PL') : '—');

// termin w formie jak na ekranie: „za N dni" / „wygasła N dni temu" / „niezgłoszony" / „brak"
function statusLabel(i: AlertItem): string {
  if (i.days == null) return i.kind === 'zus' ? 'niezgłoszony' : 'brak';
  if (i.days < 0) return `wygasła ${-i.days} dni temu`;
  if (i.days === 0) return 'wygasa dziś';
  return `za ${i.days} dni`;
}

function statusClass(i: AlertItem): string {
  if (i.days == null) return '';
  if (i.days < 0) return 'bad';
  return groupOf(i) === 'soon' || groupOf(i) === 'lease' ? 'warn' : '';
}

function buildReportHtml(items: AlertItem[], params: string[]): string {
  const rows = items
    .map(
      (i, n) => `
    <tr>
      <td class="n">${n + 1}</td>
      <td><b>${esc(i.person)}</b></td>
      <td>${esc(i.label)}</td>
      <td>${esc(i.contract || '—')}</td>
      <td>${fmtDate(i.date)}</td>
      <td class="${statusClass(i)}">${esc(statusLabel(i))}</td>
    </tr>`
    )
    .join('');

  const counts = ALERT_GROUPS.map((g) => ({ g, n: items.filter((i) => groupOf(i) === g.id).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.g.label}: <b>${x.n}</b>`)
    .join(' · ');

  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><style>
    body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#0f172a;margin:24px}
    h1{font-size:17px;margin:0 0 2px}
    .sub{color:#64748b;font-size:10px;margin-bottom:2px}
    .params{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;margin:8px 0;font-size:10px;color:#334155}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th{background:#0e2a31;color:#fff;text-align:left;padding:5px 6px;font-size:10px}
    td{border-bottom:1px solid #e2e8f0;padding:4px 6px;vertical-align:top}
    td.n{color:#94a3b8;width:26px}
    td.bad{color:#b91c1c;font-weight:bold}
    td.warn{color:#be123c}
    .empty{padding:18px;text-align:center;color:#94a3b8;font-style:italic}
  </style></head><body>
    <h1>Alarmy wymagające uwagi</h1>
    <p class="sub">Raport wygenerowany ${new Date().toLocaleString('pl-PL')} · pozycji: <b>${items.length}</b></p>
    <div class="params"><b>Parametry filtrowania:</b> ${esc(params.join(' · '))}${counts ? `<br/><b>Podsumowanie:</b> ${counts}` : ''}</div>
    ${
      items.length
        ? `<table>
      <thead><tr><th></th><th>Pracownik / lokal / pojazd</th><th>Czego dotyczy</th><th>Kontrakt</th><th>Termin</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table>`
        : '<p class="empty">Brak pozycji spełniających wybrane kryteria</p>'
    }
  </body></html>`;
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const kinds: string[] = Array.isArray(b?.kinds) ? b.kinds.filter((k: any) => typeof k === 'string') : [];
  const contract: string | null = typeof b?.contract === 'string' && b.contract ? b.contract : null;
  const search: string | null = typeof b?.search === 'string' && b.search.trim() ? b.search.trim() : null;
  const maxDays: number | null = Number.isFinite(Number(b?.maxDays)) && b?.maxDays !== '' && b?.maxDays !== null ? Number(b.maxDays) : null;

  const sb = admin() as any;
  // widoczność jak w kartotece: koordynator widzi swoich + kontrakty przyznane w Ustawieniach
  let q = sb.from('hr_employees').select('*, contract:hr_contracts(id, name)').eq('archived', false).eq('candidate', false);
  if (!SEE_ALL_ROLES.includes(auth.role ?? '')) {
    const granted = auth.role === 'koordynator' ? await coordinatorGrantedContractIds(auth.id) : [];
    q = granted.length
      ? q.or(`coordinator_id.eq.${auth.id},contract_id.in.(${granted.join(',')})`)
      : q.eq('coordinator_id', auth.id);
  }
  const [{ data: emps }, { data: accs }, { data: vehicles }] = await Promise.all([
    q,
    sb.from('hr_accommodations').select('*, contract:hr_contracts(id, name), hr_employees(count)'),
    sb.from('hr_vehicles').select('*, contract:hr_contracts(id, name)').neq('status', 'wycofany'),
  ]);

  const accList = (accs || []).map((a: any) => ({ ...a, assigned_count: a.hr_employees?.[0]?.count ?? 0 }));
  const all = buildAlerts(emps || [], accList, vehicles || []);
  const items = filterAlerts(all, { kinds, contract: contract ?? undefined, search: search ?? undefined, maxDays: maxDays ?? undefined });

  // opis użytych parametrów — drukowany w nagłówku raportu
  const params: string[] = [];
  params.push(kinds.length ? `rodzaje: ${kinds.map((k) => ALERT_GROUPS.find((g) => g.id === k)?.label ?? k).join(', ')}` : 'rodzaje: wszystkie');
  if (contract) params.push(`kontrakt: ${contract}`);
  if (search) params.push(`szukana fraza: „${search}"`);
  if (maxDays != null) params.push(`termin: do ${maxDays} dni`);

  const html = buildReportHtml(items, params);

  try {
    const pdf = await renderOfferPdf(html);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="alarmy-agencja-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Nie udało się wygenerować PDF: ${e?.message || e}` }, { status: 500 });
  }
}
