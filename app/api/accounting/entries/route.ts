// GET  /api/accounting/entries?period=YYYY-MM — lista wpisów księgowych
//      superadmin/dyrektor: wszystkie · koordynator: tylko własne
// POST — nowy wpis (multipart: pola + opcjonalny plik faktury zdjęcie/PDF)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can, canAny } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';
import { companyAccess } from '@/lib/accounting/access';

// domyślna firma dla wpisów bez wskazania (powiązana z Agencją)
async function defaultCompanyId(): Promise<string | null> {
  const { data } = await (admin() as any).from('acc_companies').select('id').eq('hr_linked', true).limit(1).maybeSingle();
  return data?.id ?? null;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function monthRange(period: string) {
  const [y, m] = period.split('-').map(Number);
  return { from: `${period}-01`, to: m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01` };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  const sp = new URL(request.url).searchParams;
  const companyId = sp.get('company_id');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // dostęp: przez firmę (multi-firma, m.in. rola ksiegowa) LUB stare uprawnienia ksiegowosc.*
  const viaCompany = companyId ? await companyAccess(auth, companyId) : null;
  if (!viaCompany && !(await canAny(auth, ['ksiegowosc.faktury', 'ksiegowosc.bilans']))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const period = sp.get('period');

  const sb = admin() as any;
  let q = sb.from('acc_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  if (period) { const { from, to } = monthRange(period); q = q.gte('entry_date', from).lt('entry_date', to); }
  if (!viaCompany && !(await can(auth, 'ksiegowosc.bilans'))) q = q.eq('created_by', auth.id);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // podpisane linki do plików faktur (1h)
  const entries = await Promise.all((data || []).map(async (e: any) => {
    if (!e.file_path) return e;
    const { data: s } = await sb.storage.from('invoices').createSignedUrl(e.file_path, 3600);
    return { ...e, file_url: s?.signedUrl || null };
  }));

  return NextResponse.json({ entries, canViewAll: viaCompany ? viaCompany !== 'podglad' : await can(auth, 'ksiegowosc.bilans') });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Nieprawidłowe dane' }, { status: 400 });

  // firma wpisu: wskazana (multi-firma; wymaga companyAccess write) albo domyślna (stare uprawnienia)
  const companyIdRaw = form.get('company_id');
  let companyId = typeof companyIdRaw === 'string' && companyIdRaw ? companyIdRaw : null;
  const viaCompany = companyId ? await companyAccess(auth, companyId, true) : null;
  if (companyId && !viaCompany) return NextResponse.json({ error: 'Brak uprawnień do zapisu w tej firmie' }, { status: 403 });
  if (!companyId) {
    if (!(await canAny(auth, ['ksiegowosc.faktury', 'ksiegowosc.bilans']))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    companyId = await defaultCompanyId();
  }

  const amount = Number(form.get('amount'));
  const kind = String(form.get('kind') || 'cost');
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Kwota musi być dodatnia' }, { status: 400 });
  if (!['cost', 'income', 'deposit'].includes(kind)) return NextResponse.json({ error: 'Nieprawidłowy typ' }, { status: 400 });
  // przychody/kaucje księgują tylko role z pełnym widokiem (lub członkowie firmy z prawem zapisu)
  if (kind !== 'cost' && !viaCompany && !(await can(auth, 'ksiegowosc.bilans'))) return NextResponse.json({ error: 'Tylko koszty' }, { status: 403 });

  const sb = admin() as any;
  let file_path: string | null = null;
  let file_type: string | null = null;
  const file = form.get('file');
  if (file && typeof file !== 'string' && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    const safe = (file.name || 'faktura').replace(/[^\w.\-]+/g, '_').slice(0, 80);
    file_path = `entries/${crypto.randomUUID()}-${safe}`;
    file_type = file.type || 'application/octet-stream';
    const up = await sb.storage.from('invoices').upload(file_path, buf, { contentType: file_type });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
  }

  const str = (k: string) => { const v = form.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };
  const { data, error } = await sb.from('acc_entries').insert({
    entry_date: str('entry_date') || new Date().toISOString().slice(0, 10),
    kind,
    category: str('category'),
    description: str('description'),
    contractor: str('contractor'),
    invoice_number: str('invoice_number'),
    amount,
    file_path, file_type,
    source: 'manual',
    status: 'zaksiegowana',
    company_id: companyId,
    created_by: auth.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
