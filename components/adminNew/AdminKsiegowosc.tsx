'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Loader2, Trash2, FileText, TrendingUp, TrendingDown, Scale, PiggyBank, Camera, ChevronDown, ChevronRight, Save, Search, Building2, Contact as ContactIcon, Receipt, Package, Landmark } from 'lucide-react';
import { Hint } from '@/components/ui/Hint';
import { KsiegFirmy, type Company } from './ksiegowosc/KsiegFirmy';
import { KsiegKontrahenci } from './ksiegowosc/KsiegKontrahenci';
import { KsiegKpir, KsiegVat } from './ksiegowosc/KsiegKpirVat';
import { KsiegMagazyn, KsiegSrodkiTrwale } from './ksiegowosc/KsiegMagazynST';
import { KsiegSprawozdania } from './ksiegowosc/KsiegSprawozdania';
// faktury sprzedazowe: Fakturownia (E4 bez wlasnego wystawiania/KSeF) — KsiegFaktury swiadomie NIE portowana (WYKLUCZENIA)

interface Entry {
  id: string; entry_date: string; kind: 'cost' | 'income' | 'deposit'; category?: string | null;
  description?: string | null; contractor?: string | null; invoice_number?: string | null;
  amount: number; file_url?: string | null; file_path?: string | null; source: string; status: string;
}
interface Summary {
  period: string;
  income: { total: number; entries_count: number };
  costs: { total: number; manual: number; by_category: Record<string, number>; auto: { advances: number; payouts: number; rents: number; rents_detail: { id: string; name: string; monthly_rent: number }[]; coordinator_pay?: number; amortization?: number; deductions?: { rent_share?: number; housing: number; other: number; total: number } } };
  result: number; deposits_frozen: number; pending_count: number;
}

const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400';
const money = (n: number) => Number(n || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

const CATEGORIES: [string, string][] = [
  ['czynsz_najmu', 'Czynsz najmu lokalu'],
  ['media', 'Media / opłaty za mieszkanie'],
  ['transport', 'Transport pracowników'],
  ['wynagrodzenia', 'Wynagrodzenia'],
  ['zus_podatki', 'ZUS / podatki'],
  ['paliwo', 'Paliwo'],
  ['biuro', 'Biuro / administracja'],
  ['sprzet', 'Sprzęt / wyposażenie'],
  ['inne', 'Inne'],
];
const catLabel = (c?: string | null) => CATEGORIES.find(([v]) => v === c)?.[1] ?? (c || 'Inne');
const KIND_BADGE: Record<string, string> = {
  cost: 'bg-red-50 text-red-700', income: 'bg-emerald-50 text-emerald-700', deposit: 'bg-amber-50 text-amber-700',
};
const KIND_LABEL: Record<string, string> = { cost: 'Koszt', income: 'Przychód', deposit: 'Kaucja' };
const emptyForm = { kind: 'cost', category: 'inne', amount: '', entry_date: '', contractor: '', invoice_number: '', description: '' };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><p className={LABEL + ' flex items-center gap-1'}>{label}{hint && <Hint text={hint} />}</p><div className="mt-1">{children}</div></div>;
}

type KsiegTab = 'bilans' | 'kontrahenci' | 'kpir' | 'vat' | 'magazyn' | 'srodki' | 'sprawozdania' | 'firmy';

export const AdminKsiegowosc: React.FC = () => {
  // ── multi-firma: przełącznik (aktywna firma w localStorage) + zakładki ──
  const [tab, setTab] = useState<KsiegTab>('bilans');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>('');

  const loadCompanies = useCallback(async () => {
    try {
      const r = await fetch('/api/accounting/companies', { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok) return;
      const list: Company[] = d.companies || [];
      setCompanies(list);
      const saved = typeof window !== 'undefined' ? localStorage.getItem('acc-company') : null;
      const pick = list.find(c => c.id === saved) || list.find(c => c.hr_linked) || list[0];
      if (pick) setCompanyId(prev => prev && list.some(c => c.id === prev) ? prev : pick.id);
    } catch { /* */ }
  }, []);
  useEffect(() => { loadCompanies(); }, [loadCompanies]);
  useEffect(() => { if (companyId) localStorage.setItem('acc-company', companyId); }, [companyId]);

  const [period, setPeriod] = useState(thisMonth());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [canViewAll, setCanViewAll] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [rentsOpen, setRentsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const cid = companyId ? `&company_id=${companyId}` : '';
      const [rs, re] = await Promise.all([
        fetch(`/api/accounting/summary?period=${p}${cid}`, { credentials: 'same-origin' }),
        fetch(`/api/accounting/entries?period=${p}${cid}`, { credentials: 'same-origin' }),
      ]);
      setSummary(rs.ok ? await rs.json() : null);
      const de = re.ok ? await re.json() : { entries: [], canViewAll: false };
      setEntries(de.entries || []);
      setCanViewAll(!!de.canViewAll);
    } catch { /* */ } finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { if (tab === 'bilans') load(period); }, [period, load, tab]);

  const save = async () => {
    const a = Number(form.amount);
    if (!Number.isFinite(a) || a <= 0) { setError('Podaj dodatnią kwotę'); return; }
    setSaving(true); setError(null);
    try {
      const fd = new FormData();
      for (const k of Object.keys(form)) if (form[k]) fd.set(k, form[k]);
      if (!form.entry_date) fd.set('entry_date', `${period}-01` <= new Date().toISOString().slice(0, 10) && period === thisMonth() ? new Date().toISOString().slice(0, 10) : `${period}-01`);
      if (file) fd.set('file', file);
      if (companyId) fd.set('company_id', companyId);
      const r = await fetch('/api/accounting/entries', { method: 'POST', credentials: 'same-origin', body: fd });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Błąd zapisu'); }
      setShowForm(false); setForm(emptyForm); setFile(null);
      await load(period);
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setSaving(false); }
  };

  const remove = async (en: Entry) => {
    if (!confirm(`Usunąć wpis na ${money(en.amount)}?`)) return;
    await fetch(`/api/accounting/entries/${en.id}`, { method: 'DELETE', credentials: 'same-origin' });
    await load(period);
  };

  // AI czyta załączoną fakturę i wypełnia pola formularza (wzorzec TaxHacker)
  const [analyzing, setAnalyzing] = useState(false);
  const analyze = async () => {
    if (!file || analyzing) return;
    setAnalyzing(true); setError(null);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const r = await fetch('/api/accounting/entries/analyze', { method: 'POST', credentials: 'same-origin', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Błąd analizy');
      if (d.disabled) { setError(d.error || 'Odczyt AI wyłączony'); return; }
      setForm((f: any) => ({
        ...f,
        kind: 'cost',
        category: d.category || f.category,
        amount: d.amount != null ? String(d.amount) : f.amount,
        entry_date: d.entry_date || f.entry_date,
        contractor: d.contractor || f.contractor,
        invoice_number: d.invoice_number || f.invoice_number,
        description: d.description || f.description,
      }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd analizy AI'); }
    finally { setAnalyzing(false); }
  };

  const filtered = entries.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [e.contractor, e.description, e.invoice_number, catLabel(e.category)].some(v => (v || '').toLowerCase().includes(q));
  });

  const s = summary;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-slate-900"><BookOpen size={18} className="text-primary-500" /> Księgowość {!s && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">wpisy kosztowe</span>}</h2>
          <p className="text-sm text-slate-500">{s ? 'Bilans firmy — przychody, koszty (auto z modułów + wpisy), kaucje' : 'Dodawaj koszty — trafiają do bilansu firmy'} · Faktury sprzedażowe: Fakturownia</p>
        </div>
        <div className="flex items-end gap-2">
          {companies.length > 0 && (
            <div>
              <p className={LABEL + ' flex items-center gap-1'}>Firma <Hint text="Każda firma ma osobny bilans i kontrahentów. Firmy zakłada się w zakładce Firmy; plakietka Agencja oznacza firmę z automatycznymi składnikami z modułu Agencji Pracy." /></p>
              <select value={companyId} onChange={e => setCompanyId(e.target.value)} className="mt-1 max-w-[220px] rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium">
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {tab === 'bilans' && (
            <>
              <div>
                <p className={LABEL}>Miesiąc</p>
                <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <button onClick={() => { setShowForm(v => !v); setForm(emptyForm); setFile(null); setError(null); }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"><Plus size={16} /> Dodaj wpis</button><Hint text="Otwiera formularz wpisu księgowego (koszt/przychód/kaucja) ze zdjęciem faktury. Wpis od razu zlicza się w bilansie miesiąca." className="self-center" />
            </>
          )}
        </div>
      </div>

      {/* Zakładki modułu księgowego — pod-zakładka Faktury sprzedaży ukryta (WYKLUCZENIA E4: Fakturownia) */}
      <div className="flex gap-1 border-b border-slate-200">
        {([['bilans', 'Bilans', <Scale key="i" size={14} />], ['kontrahenci', 'Kontrahenci', <ContactIcon key="i" size={14} />], ['kpir', 'KPiR', <BookOpen key="i" size={14} />], ['vat', 'Rejestry VAT', <Receipt key="i" size={14} />], ['magazyn', 'Magazyn', <Package key="i" size={14} />], ['srodki', 'Środki trwałe', <Landmark key="i" size={14} />], ['sprawozdania', 'Sprawozdania', <TrendingUp key="i" size={14} />], ['firmy', 'Firmy', <Building2 key="i" size={14} />]] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${tab === id ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === 'kontrahenci' && (companyId ? <KsiegKontrahenci companyId={companyId} /> : <p className="py-8 text-center text-sm italic text-slate-300">Wybierz firmę</p>)}
      {tab === 'kpir' && (companyId ? <KsiegKpir companyId={companyId} /> : <p className="py-8 text-center text-sm italic text-slate-300">Wybierz firmę</p>)}
      {tab === 'vat' && (companyId ? <KsiegVat companyId={companyId} /> : <p className="py-8 text-center text-sm italic text-slate-300">Wybierz firmę</p>)}
      {tab === 'magazyn' && (companyId ? <KsiegMagazyn companyId={companyId} /> : <p className="py-8 text-center text-sm italic text-slate-300">Wybierz firmę</p>)}
      {tab === 'srodki' && (companyId ? <KsiegSrodkiTrwale companyId={companyId} /> : <p className="py-8 text-center text-sm italic text-slate-300">Wybierz firmę</p>)}
      {tab === 'sprawozdania' && (companyId ? <KsiegSprawozdania companyId={companyId} /> : <p className="py-8 text-center text-sm italic text-slate-300">Wybierz firmę</p>)}
      {tab === 'firmy' && <KsiegFirmy onChanged={loadCompanies} />}

      {/* Formularz wpisu */}
      {tab === 'bilans' && showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 font-semibold text-slate-800">Nowy wpis księgowy</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Typ" hint="Koszt = wydatek firmy; Przychód i Kaucja tylko dla ról z pełnym bilansem. Kaucje liczone są osobno (zamrożone środki).">
              <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className={INPUT}>
                <option value="cost">Koszt</option>
                {canViewAll && <option value="income">Przychód</option>}
                {canViewAll && <option value="deposit">Kaucja</option>}
              </select>
            </Field>
            <Field label="Kategoria" hint="Grupuje koszt w strukturze bilansu (czynsz, media, transport, wynagrodzenia…).">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={INPUT}>
                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Kwota (zł) *" hint="Kwota wpisu — od razu wchodzi do bilansu miesiąca. Wymagana, dodatnia."><input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={INPUT} /></Field>
            <Field label="Data" hint="Data księgowania — decyduje, do którego miesiąca bilansu trafi wpis. Puste = dziś."><input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} className={INPUT} /></Field>
            <Field label="Kontrahent" hint="Od kogo faktura / komu zapłacono (np. wynajmujący, przewoźnik)."><input value={form.contractor} onChange={e => setForm({ ...form, contractor: e.target.value })} className={INPUT} placeholder="np. wynajmujący, przewoźnik" /></Field>
            <Field label="Nr faktury" hint="Numer dokumentu księgowego — ułatwia szukanie wpisu."><input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} className={INPUT} /></Field>
            <div className="sm:col-span-2"><Field label="Opis" hint="Krótki opis czego dotyczy wydatek/przychód."><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={INPUT} /></Field></div>
            <Field label="Faktura (zdjęcie / PDF)" hint="Załącz skan lub zdjęcie faktury — będzie podpięte do wpisu. Przycisk AI odczyta z niej kwotę, datę, kontrahenta i dobierze kategorię.">
              <div className="flex items-center gap-2">
                <input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700" />
                {file && (
                  <button onClick={analyze} disabled={analyzing} title="AI odczyta kwotę, datę, kontrahenta i kategorię z załączonej faktury"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100 disabled:opacity-50">
                    {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                    {analyzing ? 'Czytam…' : 'Odczytaj AI'}
                  </button>
                )}
              </div>
            </Field>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button onClick={() => { setShowForm(false); setForm(emptyForm); setFile(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Anuluj</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Zapisz</button>
          </div>
        </div>
      )}

      {tab === 'bilans' && (loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
      ) : (
        <>
          {/* Bilans — tylko superadmin/dyrektor */}
          {s && (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: 'Przychody', value: money(s.income.total), icon: <TrendingUp size={20} />, bg: '#0F6E56' },
                  { label: 'Koszty razem', value: money(s.costs.total), icon: <TrendingDown size={20} />, bg: '#e11d48' },
                  { label: 'Wynik miesiąca', value: money(s.result), icon: <Scale size={20} />, bg: '#0b1622' },
                  { label: 'Kaucje (zamrożone)', value: money(s.deposits_frozen), icon: <PiggyBank size={20} />, bg: '#f0a500' },
                ].map(k => (
                  <div key={k.label} className="rounded-2xl p-4 text-white shadow-sm" style={{ backgroundColor: k.bg }}>
                    <div className="mb-2 opacity-70">{k.icon}</div>
                    <p className="text-2xl font-bold leading-tight">{k.value}</p>
                    <p className="mt-0.5 text-xs opacity-70">{k.label}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Struktura kosztów — {period}</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between border-b border-slate-50 py-1.5"><span className="text-slate-600">Wypłaty pracowników <span className="text-xs text-slate-400">(auto z Rozliczeń)</span></span><span className="font-medium text-slate-800">{money(s.costs.auto.payouts)}</span></div>
                  <div className="flex justify-between border-b border-slate-50 py-1.5"><span className="text-slate-600">Zaliczki pracowników <span className="text-xs text-slate-400">(auto z Rozliczeń)</span></span><span className="font-medium text-slate-800">{money(s.costs.auto.advances)}</span></div>
                  {(s.costs.auto.coordinator_pay ?? 0) > 0 && (
                    <div className="flex justify-between border-b border-slate-50 py-1.5"><span className="text-slate-600">Wynagrodzenia koordynatorów <span className="text-xs text-slate-400">(auto z Rozliczeń)</span></span><span className="font-medium text-slate-800">{money(s.costs.auto.coordinator_pay!)}</span></div>
                  )}
                  {(s.costs.auto.amortization ?? 0) > 0 && (
                    <div className="flex justify-between border-b border-slate-50 py-1.5"><span className="text-slate-600">Amortyzacja środków trwałych <span className="text-xs text-slate-400">(auto — odpis miesięczny)</span></span><span className="font-medium text-slate-800">{money(s.costs.auto.amortization!)}</span></div>
                  )}
                  {(s.costs.auto.deductions?.total ?? 0) > 0 && (
                    <div className="flex justify-between border-b border-slate-50 py-1.5">
                      <span className="text-slate-600">Potrącenia od pracowników <span className="text-xs text-slate-400">(nocleg — udział w czynszu {money(s.costs.auto.deductions!.rent_share ?? 0)} + mieszkanie {money(s.costs.auto.deductions!.housing)} + kary/inne {money(s.costs.auto.deductions!.other)} — pomniejszyły wypłaty)</span></span>
                      <span className="font-medium text-emerald-600">−{money(s.costs.auto.deductions!.total)}</span>
                    </div>
                  )}
                  <div className="border-b border-slate-50 py-1.5">
                    <button onClick={() => setRentsOpen(v => !v)} className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-1 text-slate-600">{rentsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Czynsze najmu lokali <span className="text-xs text-slate-400">(auto z Bazy Noclegowej)</span></span>
                      <span className="font-medium text-slate-800">{money(s.costs.auto.rents)}</span>
                    </button>
                    {rentsOpen && s.costs.auto.rents_detail.length > 0 && (
                      <div className="mt-1 space-y-0.5 pl-6">
                        {s.costs.auto.rents_detail.map(r => (
                          <div key={r.id} className="flex justify-between text-xs text-slate-500"><span>{r.name}</span><span>{money(r.monthly_rent)}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                  {Object.entries(s.costs.by_category).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                    <div key={c} className="flex justify-between border-b border-slate-50 py-1.5"><span className="text-slate-600">{catLabel(c)} <span className="text-xs text-slate-400">(wpisy)</span></span><span className="font-medium text-slate-800">{money(v)}</span></div>
                  ))}
                  <div className="flex justify-between pt-2 font-bold text-slate-900"><span>Koszty razem</span><span>{money(s.costs.total)}</span></div>
                </div>
                {s.pending_count > 0 && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{s.pending_count} wpisów czeka na weryfikację (z aplikacji mobilnej) — nie są wliczone do bilansu.</p>}
              </div>
            </>
          )}

          {/* Lista wpisów */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
              <FileText size={15} className="text-primary-500" />
              <p className="text-sm font-semibold text-slate-700">{canViewAll ? 'Wpisy księgowe' : 'Moje wpisy kosztowe'} ({filtered.length})</p>
              <div className="relative ml-auto min-w-[180px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj…" className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
            </div>
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm italic text-slate-300">Brak wpisów w tym miesiącu</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {filtered.map(e => (
                  <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-slate-50/50">
                    <span className="w-20 shrink-0 text-xs text-slate-400">{new Date(e.entry_date).toLocaleDateString('pl-PL')}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_BADGE[e.kind]}`}>{KIND_LABEL[e.kind]}</span>
                    <span className="shrink-0 text-slate-600">{catLabel(e.category)}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-500">{[e.contractor, e.invoice_number ? `FV ${e.invoice_number}` : null, e.description].filter(Boolean).join(' · ') || '—'}</span>
                    {e.status === 'do_weryfikacji' && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">do weryfikacji</span>}
                    {e.file_url && <a href={e.file_url} target="_blank" rel="noopener noreferrer" title="Otwórz fakturę" className="shrink-0 rounded-lg p-1 text-primary-500 hover:bg-primary-50"><FileText size={15} /></a>}
                    <span className={`w-28 shrink-0 text-right font-semibold ${e.kind === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>{e.kind === 'income' ? '+' : '−'}{money(e.amount)}</span>
                    {canViewAll && <button onClick={() => remove(e)} className="shrink-0 rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ))}
    </div>
  );
};
