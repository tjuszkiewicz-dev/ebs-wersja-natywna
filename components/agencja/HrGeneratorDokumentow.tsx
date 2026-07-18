'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Loader2, Search, Plus, Pencil, Trash2, Save, X, Download, AlertTriangle, CheckCircle2, Bold, Italic, Underline, List, FilePlus2, BookOpenText, Archive } from 'lucide-react';
import { Hint } from '@/components/ui/Hint';
import { DOC_PLACEHOLDERS, buildDocData, extractPlaceholders, fullName } from '@/lib/hr/docPlaceholders';
import { docCopies } from '@/lib/hr/docRules';

interface Template { id: string; name: string; content_html: string; has_letterhead: boolean; sort: number; category: string; kind?: string }

type DocCategory = 'pracownicze' | 'umowy' | 'benefitowe' | 'koscielne';
const CATEGORIES: { id: DocCategory; label: string }[] = [
  { id: 'pracownicze', label: 'Dokumenty pracownicze' },
  { id: 'umowy',       label: 'Umowy dwujęzyczne' },
  { id: 'benefitowe',  label: 'Dokumenty benefitowe' },
  { id: 'koscielne',   label: 'Dokumenty kościelne' },
];
// kategorie z auto-doborem wersji językowej wg języka pracownika (jak dokumenty kościelne)
const AUTO_LANG_CATEGORIES: DocCategory[] = ['koscielne', 'umowy'];
interface Employee { id: string; first_name: string; last_name: string; status: string; team?: string | null; contract?: { id: string; name: string } | null; [k: string]: any }
interface GenResult { employee_name: string; template_name: string; url?: string | null; missing?: string[]; ok: boolean; error?: string }

const plLabel = (key: string) => DOC_PLACEHOLDERS.find(p => p.key === key)?.label ?? key;

// Język szablonu rozpoznawany z nazwy (szablony dwujęzyczne PL+obcy → język obcy)
type Lang = 'es' | 'en' | 'ru' | 'hi' | 'pl';
const tplLang = (name: string): Lang => {
  const n = name.toLowerCase();
  if (/hiszpa|hszpa|hiszp\.|espa/.test(n)) return 'es';
  if (/angiel|ang\.|english/.test(n)) return 'en';
  if (/rosyj|ros\.|russ/.test(n)) return 'ru';
  if (/hindi|hindus|dewanagari|devanagari/.test(n)) return 'hi';
  return 'pl';
};
const LANG_BADGE: Record<Lang, string> = { es: 'ES', en: 'EN', ru: 'RU', hi: 'HI', pl: 'PL' };
const LANG_NAME: Record<Lang, string> = { es: 'hiszpański', en: 'angielski', ru: 'rosyjski', hi: 'hindi', pl: 'polski' };

export function HrGeneratorDokumentow() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selEmp, setSelEmp] = useState<Set<string>>(new Set());
  const [selTpl, setSelTpl] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [docDate, setDocDate] = useState(''); // data drukowana w dokumentach; puste = dzisiaj
  const [results, setResults] = useState<GenResult[]>([]);
  const [editTpl, setEditTpl] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState<DocCategory>('pracownicze');
  // Umowy dwujęzyczne: wymuszony drugi język ('' = automatycznie wg języka pracownika)
  const [forceUmowaLang, setForceUmowaLang] = useState<'' | Lang>('');
  const [showInstruction, setShowInstruction] = useState(false);
  const [zipping, setZipping] = useState<string | null>(null);

  // Paczki ZIP: osobny plik na każdego pracownika (PDF-y z ostatniego generowania)
  const downloadZips = async () => {
    const ok = results.filter(r => r.ok && r.url);
    if (!ok.length) return;
    const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
    const byEmp = new Map<string, GenResult[]>();
    for (const r of ok) byEmp.set(r.employee_name, [...(byEmp.get(r.employee_name) || []), r]);
    try {
      const JSZip = (await import('jszip')).default; // ~100 kB — ładowane dopiero przy kliknięciu
      let i = 0;
      for (const [emp, docs] of byEmp) {
        i++;
        setZipping(`Pakowanie ${i}/${byEmp.size}: ${emp}…`);
        const zip = new JSZip();
        for (const d of docs) {
          const res = await fetch(d.url!);
          if (!res.ok) throw new Error(`Nie udało się pobrać: ${d.template_name}`);
          zip.file(`${safe(d.template_name)}.pdf`, await res.arrayBuffer());
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: `${safe(emp)} — dokumenty.zip` });
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      }
      setZipping(null);
    } catch (e) {
      setZipping(null);
      window.alert(e instanceof Error ? e.message : 'Błąd pakowania ZIP');
    }
  };

  // JEDEN PDF: skleja wszystkie wygenerowane dokumenty (kolejność: pracownik → dokument)
  const [merging, setMerging] = useState(false);
  const mergeToOnePdf = async (items: GenResult[]) => {
    const ok = items.filter(r => r.ok && r.url);
    if (!ok.length) return;
    setMerging(true);
    try {
      const { PDFDocument } = await import('pdf-lib'); // ładowane dopiero przy użyciu
      const out = await PDFDocument.create();
      for (const r of ok) {
        const copies = docCopies(r.template_name); // instrukcja: umowy/zaświadczenia/dekrety ×2
        setProgress(`Łączę w jeden PDF: ${r.template_name}${copies > 1 ? ` (×${copies})` : ''}…`);
        const res = await fetch(r.url!);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        // egzemplarze wg instrukcji: dokument trafia do wydruku tyle razy, ile kopii
        for (let c = 0; c < copies; c++) {
          const src = await PDFDocument.load(buf);
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach(pg => out.addPage(pg));
        }
      }
      const bytes = await out.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const who = [...new Set(ok.map(r => r.employee_name))];
      const fname = (who.length === 1 ? who[0] : `${who.length} pracowników`).replace(/[\/:*?"<>|]+/g, '');
      const a = Object.assign(document.createElement('a'), { href: url, download: `Dokumenty — ${fname} (${out.getPageCount()} str.).pdf` });
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setProgress('');
    } catch (e) { setProgress(''); window.alert(e instanceof Error ? e.message : 'Błąd łączenia PDF'); }
    finally { setMerging(false); }
  };

  // AUTO-ZAZNACZANIE (dokumenty kościelne): komplet PL + wersje obcojęzyczne
  // w języku zaznaczonych pracowników (pole „Język dokumentów" w kartotece,
  // wypełniane automatycznie z paszportu przy OCR)
  useEffect(() => {
    if (!AUTO_LANG_CATEGORIES.includes(category as DocCategory) || selEmp.size === 0) return;
    // Umowy dwujęzyczne z WYMUSZONYM drugim językiem → zaznacz tylko tę wersję
    if (category === 'umowy' && forceUmowaLang) {
      setSelTpl(new Set(templates.filter(t => (t.category || 'pracownicze') === 'umowy' && tplLang(t.name) === forceUmowaLang).map(t => t.id)));
      return;
    }
    const langs = new Set(employees.filter(e => selEmp.has(e.id)).map(e => e.language).filter(Boolean));
    if (!langs.size) return;
    setSelTpl(new Set(
      templates
        .filter(t => (t.category || 'pracownicze') === category)
        .filter(t => { const l = tplLang(t.name); return l === 'pl' || langs.has(l); })
        .map(t => t.id)
    ));
  }, [selEmp, category, templates, employees, forceUmowaLang]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rt, re, rc] = await Promise.all([
        fetch('/api/hr/doc-templates', { credentials: 'same-origin' }),
        fetch('/api/hr/employees', { credentials: 'same-origin' }),
        fetch('/api/hr/employees?candidates=1', { credentials: 'same-origin' }),
      ]);
      const dt = rt.ok ? await rt.json() : { templates: [] };
      const de = re.ok ? await re.json() : { employees: [] };
      const dc = rc.ok ? await rc.json() : { employees: [] };
      const tpls: Template[] = dt.templates || [];
      setTemplates(tpls);
      // kandydaci z Poczekalni na początku listy — dokumenty (pełnomocnictwa, kwestionariusze)
      // generuje się PRZED przydzieleniem do kontraktu, po zgłoszeniu i przydziale noclegu
      setEmployees([...(dc.employees || []).map((e: any) => ({ ...e, candidate: true })), ...(de.employees || [])]);
      // startuj na pierwszej kategorii, która ma szablony
      setCategory(c => (tpls.some(t => t.category === c) ? c : (CATEGORIES.find(x => tpls.some(t => t.category === x.id))?.id ?? c)));
    } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const catTemplates = templates.filter(t => (t.category || 'pracownicze') === category);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n);
  };

  const filteredEmp = employees.filter(e => !search.trim() || fullName(e).toLowerCase().includes(search.toLowerCase().trim()));

  // pre-flight: braki danych dla wybranych par
  const warnings: { emp: string; fields: string[] }[] = [];
  if (selEmp.size && selTpl.size) {
    const usedKeys = new Set<string>();
    for (const t of templates) if (selTpl.has(t.id)) extractPlaceholders(t.content_html).forEach(k => usedKeys.add(k));
    usedKeys.delete('dzis');
    for (const e of employees) {
      if (!selEmp.has(e.id)) continue;
      const data = buildDocData(e);
      const miss = [...usedKeys].filter(k => !data[k]);
      if (miss.length) warnings.push({ emp: fullName(e), fields: miss });
    }
  }

  const generate = async () => {
    const empIds = [...selEmp]; const tplIds = [...selTpl];
    if (!empIds.length || !tplIds.length) return;
    setGenerating(true); setResults([]); setProgress('');
    const all: GenResult[] = [];
    try {
      // Dobór wg języka: szablon obcojęzyczny (ES/RU/HI/EN) generujemy pracownikowi
      // TYLKO gdy zgadza się z jego językiem; PL i uniwersalne (tplLang='pl') zawsze.
      // Gdy pracownik nie ma ustawionego języka — bez filtra (jak dotąd).
      const perEmp = empIds.map(empId => {
        const empLang = employees.find(e => e.id === empId)?.language;
        const ids = tplIds.filter(id => {
          const t = templates.find(x => x.id === id);
          const l = t ? tplLang(t.name) : 'pl';
          if (l === 'pl') return true;                                   // PL / uniwersalne zawsze
          if (forceUmowaLang && t?.category === 'umowy') return l === forceUmowaLang; // wymuszony drugi język umowy
          return empLang ? l === empLang : true;                        // wg języka pracownika
        });
        return { empId, ids };
      });
      const total = perEmp.reduce((a, x) => a + x.ids.length, 0); let done = 0;
      if (!total) { setProgress('Żaden dokument nie pasuje do języka wybranych pracowników (ustaw język w kartotece).'); setGenerating(false); return; }
      // partie ≤6 par (limit czasu serverless): per pracownik, szablony dzielone po 6
      for (const { empId, ids } of perEmp) {
        for (let i = 0; i < ids.length; i += 6) {
          const chunk = ids.slice(i, i + 6);
          setProgress(`Generowanie ${done + 1}–${Math.min(done + chunk.length, total)} z ${total}…`);
          const r = await fetch('/api/hr/doc-generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
            body: JSON.stringify({ employee_ids: [empId], template_ids: chunk, doc_date: docDate || undefined }),
          });
          // serwer przy timeoucie/awarii zwraca stronę tekstową (nie JSON) — czytamy surowo
          const raw = await r.text();
          let d: any = null;
          try { d = JSON.parse(raw); } catch { /* nie-JSON */ }
          if (!r.ok || !d) {
            const msg = d?.error
              || (r.status === 504 || /timeout|FUNCTION_INVOCATION/i.test(raw) ? 'Przekroczono czas generowania — spróbuj mniej dokumentów naraz' : `Błąd serwera (${r.status})`);
            throw new Error(msg);
          }
          all.push(...(d.results || []));
          done += chunk.length;
          setResults([...all]);
        }
      }
      setProgress('');
      // JEDEN plik PDF ze wszystkimi dokumentami w środku — od razu do pobrania
      await mergeToOnePdf(all);
    } catch (e) { setProgress(e instanceof Error ? e.message : 'Błąd'); }
    finally { setGenerating(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-sans text-lg font-bold text-slate-900">Generator dokumentów</h2>
        <p className="text-sm text-slate-500">Zaznacz pracowników i dokumenty — PDF-y trafią do teczek pracowników i do pobrania</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pracownicy */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pracownicy ({selEmp.size}/{employees.length}) <Hint text="Zaznacz osoby, dla których generujesz dokumenty. W kategorii kościelnej zaznaczenie pracownika automatycznie dobiera komplet dokumentów w jego języku." /></p>
            <button onClick={() => setSelEmp(selEmp.size === filteredEmp.length ? new Set() : new Set(filteredEmp.map(e => e.id)))} className="ml-auto text-xs font-medium text-primary-600 hover:underline">{selEmp.size === filteredEmp.length ? 'Odznacz' : 'Zaznacz wszystkich'}</button>
          </div>
          <div className="relative mb-2 px-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj…" className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            {loading ? <div className="flex justify-center py-6 text-slate-300"><Loader2 size={18} className="animate-spin" /></div>
              : filteredEmp.map(e => (
              <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={selEmp.has(e.id)} onChange={() => toggle(selEmp, e.id, setSelEmp)} />
                <span className="font-medium text-slate-700">{fullName(e)}</span>
                {e.candidate && <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">kandydat</span>}
                {e.language && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{LANG_BADGE[e.language as Lang] ?? e.language}</span>}
                <span className="ml-auto text-xs text-slate-400">{e.candidate ? 'Poczekalnia' : (e.contract?.name || '—')}{e.team ? ` · ${e.team}` : ''}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Dokumenty */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Dokumenty ({selTpl.size}/{templates.length}) <Hint text="Szablony do wygenerowania. Ołówek otwiera edytor treści; plakietka pokazuje język (PL/ES/EN/RU). Znaczniki {{...}} wypełniają się danymi z kartoteki." /></p>
            <button onClick={() => setCreating(true)} className="ml-auto flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"><FilePlus2 size={13} /> Nowy szablon</button><Hint text="Tworzy pusty szablon w aktywnej kategorii — treść piszesz w edytorze wizualnym, znaczniki wstawiasz z listy." className="self-center" />
          </div>
          {/* Kategorie dokumentów */}
          <div className="mb-2 flex gap-1 border-b border-slate-100 px-1">
            {CATEGORIES.map(c => {
              const count = templates.filter(t => (t.category || 'pracownicze') === c.id).length;
              return (
                <button key={c.id} onClick={() => setCategory(c.id)}
                  className={`-mb-px border-b-2 px-2.5 py-1.5 text-xs font-medium transition ${category === c.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  {c.label} <span className="text-slate-300">({count})</span>
                </button>
              );
            })}
          </div>
          {category === 'koscielne' && (
            <div className="mb-2 space-y-2 px-1">
              <button onClick={() => setShowInstruction(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-700">
                <BookOpenText size={16} /> Instrukcja wypełniania dokumentów
              </button>
              <div className="mt-1 flex justify-center"><Hint text="Instrukcja od zleceniodawcy: ile egzemplarzy drukować (dwustronnie), jak wypełniać każdy dokument i jaki jest obieg podpisów." /></div>
              <p className="text-[11px] leading-snug text-slate-400">
                Po zaznaczeniu pracowników dokumenty zaznaczają się automatycznie: komplet po polsku + wersje w języku pracownika (pole „Język dokumentów" w kartotece, wypełniane z paszportu przy OCR).
              </p>
              {(() => {
                const noLang = employees.filter(e => selEmp.has(e.id) && !e.language);
                return noLang.length > 0 && (
                  <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                    Bez ustawionego języka: {noLang.map(e => fullName(e)).join(', ')} — ustaw „Język dokumentów" w kartotece, żeby auto-zaznaczanie ich objęło.
                  </p>
                );
              })()}
            </div>
          )}
          <div className="max-h-[300px] space-y-0.5 overflow-y-auto">
            {catTemplates.length === 0 && <p className="py-6 text-center text-sm italic text-slate-300">Brak szablonów w tej kategorii — kliknij „Nowy szablon"</p>}
            {catTemplates.map(t => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={selTpl.has(t.id)} onChange={() => toggle(selTpl, t.id, setSelTpl)} />
                <span className="min-w-0 flex-1 cursor-pointer truncate text-slate-700" onClick={() => toggle(selTpl, t.id, setSelTpl)}>{t.name}</span>
                {t.kind && t.kind !== 'html'
                  ? <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-600" title="Oficjalny wypełnialny PDF urzędowy — dane wstawiane automatycznie z kartoteki">PDF urzędowy</span>
                  : <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${tplLang(t.name) === 'pl' ? 'bg-slate-100 text-slate-500' : 'bg-primary-50 text-primary-600'}`}>{LANG_BADGE[tplLang(t.name)]}</span>}
                {(!t.kind || t.kind === 'html')
                  ? <button onClick={() => setEditTpl(t)} title="Edytuj szablon" className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-primary-600"><Pencil size={14} /></button>
                  : <span className="shrink-0 p-1 text-slate-300" title="Formularz urzędowy — treści nie edytuje się"><FileText size={14} /></span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ostrzeżenia o brakach */}
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-1.5 flex items-center gap-2 font-semibold text-amber-800"><AlertTriangle size={16} /> Braki danych ({warnings.length} os.) — w PDF pojawią się kropki do ręcznego uzupełnienia</p>
          <div className="max-h-40 space-y-0.5 overflow-y-auto text-sm">
            {warnings.map((w, i) => (
              <p key={i} className="text-amber-800"><span className="font-medium">{w.emp}</span>: <span className="text-amber-700">{w.fields.map(plLabel).join(', ')}</span></p>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Data na dokumentach
            <Hint text="Data drukowana w dokumentach (umowa, dekrety, zaświadczenie — znacznik „dzisiejsza data”). Puste = dzień generowania. Ustaw np. datę podpisania, żeby na wszystkich papierach była jednakowa i zgodna z instrukcją." />
          </p>
          <div className="flex items-center gap-2">
            <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300" />
            {docDate
              ? <button type="button" onClick={() => setDocDate('')} className="text-xs font-medium text-slate-400 hover:text-slate-600 hover:underline">dzisiaj</button>
              : <span className="text-xs text-slate-400">= dzisiaj</span>}
          </div>
        </div>

        {/* Umowy dwujęzyczne: wybór drugiego języka (kolumna po prawej) */}
        {category === 'umowy' && (
          <div>
            <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Drugi język umowy
              <Hint text="Wersja obcojęzyczna umowy (prawa kolumna). Automatycznie = wg języka pracownika z kartoteki; albo wymuś jeden język dla wszystkich zaznaczonych (np. gdy pracownik nie ma ustawionego języka)." />
            </p>
            <select value={forceUmowaLang} onChange={e => setForceUmowaLang(e.target.value as '' | Lang)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300">
              <option value="">Automatycznie (wg pracownika)</option>
              <option value="es">Hiszpański</option>
              <option value="ru">Rosyjski</option>
              <option value="hi">Hindi</option>
              <option value="en">Angielski</option>
            </select>
          </div>
        )}

        <button onClick={generate} disabled={generating || !selEmp.size || !selTpl.size}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          {generating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          Generuj PDF ({selEmp.size * selTpl.size})
        </button>
        <Hint text="Generuje dokumenty dla każdej pary pracownik × dokument i NA KONIEC skleja wszystko w JEDEN wielostronicowy PDF, który sam się pobiera (do wydruku za jednym razem). Pojedyncze PDF-y lądują też w teczkach pracowników; braki danych wychodzą jako kropki + ostrzeżenie." className="self-center" />
        {progress && <p className="text-sm text-slate-500">{progress}</p>}
      </div>

      {/* Wyniki */}
      {results.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-700">Wygenerowane ({results.filter(r => r.ok).length}/{results.length}) — zapisane też w teczkach pracowników</p>
            {results.some(r => r.ok && r.url) && (
              <span className="ml-auto flex items-center gap-1.5">
                <button onClick={() => mergeToOnePdf(results)} disabled={merging}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {merging ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Pobierz 1 PDF (komplet)
                </button>
                <Hint text="Skleja WSZYSTKIE wygenerowane dokumenty w jeden wielostronicowy PDF (kolejność: pracownik → dokument) — idealny do wydruku za jednym razem. Pobiera się też automatycznie po generowaniu." />
                <button onClick={downloadZips} disabled={zipping !== null}
                  className="flex items-center gap-2 rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                  {zipping !== null ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                  {zipping ?? 'Pobierz paczkę dokumentów (ZIP)'}
                </button>
                <Hint text="Pakuje wygenerowane PDF-y w ZIP-y — OSOBNY plik dla każdego pracownika (imię i nazwisko w nazwie)." />
              </span>
            )}
          </div>
          <div className="max-h-80 divide-y divide-slate-50 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                {r.ok ? <CheckCircle2 size={15} className="shrink-0 text-emerald-500" /> : <AlertTriangle size={15} className="shrink-0 text-red-500" />}
                <span className="font-medium text-slate-700">{r.employee_name}</span>
                <span className="text-slate-400">· {r.template_name}</span>
                {docCopies(r.template_name) > 1 && <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600" title="Liczba egzemplarzy do druku wg instrukcji">×{docCopies(r.template_name)}</span>}
                {r.missing && r.missing.length > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">braki: {r.missing.map(plLabel).join(', ')}</span>}
                {!r.ok && <span className="text-xs text-red-600">{r.error}</span>}
                {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100"><Download size={13} /> PDF</a>}
              </div>
            ))}
          </div>
        </div>
      )}

      {(editTpl || creating) && (
        <TemplateEditor
          template={editTpl}
          defaultCategory={category}
          onClose={() => { setEditTpl(null); setCreating(false); }}
          onSaved={() => { setEditTpl(null); setCreating(false); load(); }}
        />
      )}
      {showInstruction && <InstructionModal onClose={() => setShowInstruction(false)} />}
    </div>
  );
}

// ── Instrukcja wypełniania dokumentów kościelnych (od zleceniodawcy) ──────────
function InstructionModal({ onClose }: { onClose: () => void }) {
  const H = 'mt-4 mb-1.5 font-sans text-sm font-bold uppercase tracking-wide text-slate-800';
  const LI = 'flex gap-2 text-sm text-slate-700';
  const dot = <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />;
  const copies: [string, string][] = [
    ['Umowa w ramach posługi (po polsku)', '×2'],
    ['Umowa w ramach posługi w języku obcym', '×2'],
    ['Zaświadczenie Zakonu w języku obcym', '×2'],
    ['Oświadczenie wykonawcy po polsku', '×1'],
    ['Oświadczenie wykonawcy w języku obcym', '×1'],
    ['Kwestionariusz po polsku', '×1'],
    ['Kwestionariusz w języku obcym', '×1'],
    ['Dekret powołania (w języku obcym)', '×2'],
    ['Dekret delegacji (w języku obcym)', '×2'],
    ['Pełnomocnictwo ogólne', '×1'],
    ['Pełnomocnictwo — P. Maciej', '×1'],
    ['Pełnomocnictwo — mec. Rał', '×1'],
    ['Pełnomocnictwo do ZUS BEZ SYGNATURY (PL + język obcy)', '×1'],
    ['Pełnomocnictwo do ZUS Z SYGNATURĄ (PL + język obcy)', '×1'],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="flex items-center gap-2 font-sans font-bold text-slate-900"><BookOpenText size={18} className="text-red-600" /> Instrukcja wypełniania dokumentów kościelnych</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Wszystkie dokumenty drukujemy DWUSTRONNIE. Wersje obcojęzyczne wybieramy w języku, którym włada pracownik (hiszpański, angielski lub rosyjski).</p>

          <p className={H}>Liczba egzemplarzy</p>
          <div className="overflow-hidden rounded-lg border border-slate-100">
            {copies.map(([doc, n], i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-1.5 text-sm ${i % 2 ? 'bg-slate-50/60' : ''}`}>
                <span className="text-slate-700">{doc}</span>
                <span className="font-bold text-slate-900">{n}</span>
              </div>
            ))}
          </div>

          <p className={H}>Jak wypełniać poszczególne dokumenty</p>
          <div className="space-y-2">
            <p className={LI}>{dot}<span><b>Umowa w ramach posługi (po polsku i w języku obcym)</b> — wpisz wskazane dane cudzoziemca oraz datę zawarcia umowy. Ta sama data musi się znaleźć w §4 umowy, jako data, od której umowa zostaje zawarta. Cudzoziemiec podpisuje się w miejscu „wykonujący".</span></p>
            <p className={LI}>{dot}<span><b>Zaświadczenie Zakonu</b> — w prawym górnym rogu wpisz datę, od kiedy osoba pełni posługę; w pierwszym zdaniu uzupełnij dane osoby. Cudzoziemiec podpisuje się w miejscu „otrzymałem".</span></p>
            <p className={LI}>{dot}<span><b>Kwestionariusz osobowy</b> — wypełnij dane wykonawcy oraz adres zamieszkania cudzoziemca. Podpis w prawym dolnym rogu ostatniej strony.</span></p>
            <p className={LI}>{dot}<span><b>Oświadczenie wykonawcy</b> — niczego nie wypełniamy; cudzoziemiec podpisuje się tylko w miejscu „podpis".</span></p>
            <p className={LI}>{dot}<span><b>Dekret powołania (Dekret P)</b> — w prawym górnym rogu wpisz datę powołania (musi być spójna z datą zawarcia umowy) — zarówno na wersji polskiej, jak i obcojęzycznej. W miejscu „b." wpisz imię i nazwisko cudzoziemca, poniżej datę i miejsce urodzenia. Podpis w lewym dolnym rogu, w miejscu wykropkowanym. <b>Dekret delegacji (Dekret D)</b> — wypełniamy analogicznie.</span></p>
            <p className={LI}>{dot}<span><b>Pełnomocnictwo ogólne</b> — w miejscu „imię i nazwisko mocodawcy" wpisz imię i nazwisko cudzoziemca; podpis w prawym dolnym rogu. <b>Niczego więcej nie wpisujemy.</b></span></p>
            <p className={LI}>{dot}<span><b>Pełnomocnictwa dla P. Macieja i mec. Rała</b> — w danych osobowych cudzoziemca wpisz imię i nazwisko, nr paszportu i datę urodzenia; podpisy w miejscach wykropkowanych. <b>Niczego więcej nie wpisujemy.</b></span></p>
            <p className={LI}>{dot}<span><b>Pełnomocnictwo do ZUS (z sygnaturą i bez sygnatury)</b> — w wersji polskiej i obcojęzycznej wpisz w wyznaczonych miejscach imię i nazwisko, obywatelstwo oraz numer dokumentu tożsamości (z zaznaczeniem, czy to paszport, czy inny dokument). Podpis na ostatniej stronie w miejscach wykropkowanych — pod tekstem polskim i pod tekstem obcojęzycznym. <b className="text-red-600">NIE WPISUJEMY adresu do korespondencji ani daty udzielenia pełnomocnictwa.</b></span></p>
          </div>

          <p className={H}>Obieg dokumentów</p>
          <p className="text-sm text-slate-700">Wszystkie wymienione dokumenty, podpisane przez cudzoziemca, dostarczacie Państwo do nas. Następnie podpisuje je Pan Maciej, po czym zwracamy Państwu po jednym egzemplarzu: umowy w ramach posługi (po polsku i w języku obcym), zaświadczenia Zakonu (po polsku i w języku obcym), dekretu powołania oraz dekretu delegacji.</p>
        </div>
        <div className="border-t border-slate-100 px-5 py-3 text-right">
          <button onClick={onClose} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">Zamknij</button>
        </div>
      </div>
    </div>
  );
}

function TemplateEditor({ template, defaultCategory, onClose, onSaved }: { template: Template | null; defaultCategory: DocCategory; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(template?.name ?? '');
  const [letterhead, setLetterhead] = useState(template?.has_letterhead ?? false);
  const [tplCategory, setTplCategory] = useState<string>(template?.category ?? defaultCategory);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = template?.content_html ?? '<p>Treść dokumentu…</p>';
  }, [template]);

  const cmd = (c: string, v?: string) => { document.execCommand(c, false, v); editorRef.current?.focus(); };
  const insertPlaceholder = (key: string) => { if (!key) return; cmd('insertText', `{{${key}}}`); };

  const save = async () => {
    if (!name.trim()) { setError('Podaj nazwę szablonu'); return; }
    setSaving(true); setError(null);
    try {
      const body = JSON.stringify({ name: name.trim(), content_html: editorRef.current?.innerHTML ?? '', has_letterhead: letterhead, category: tplCategory });
      const r = template
        ? await fetch(`/api/hr/doc-templates/${template.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body })
        : await fetch('/api/hr/doc-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Błąd zapisu');
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!template || !confirm(`Usunąć szablon „${template.name}"?`)) return;
    await fetch(`/api/hr/doc-templates/${template.id}`, { method: 'DELETE', credentials: 'same-origin' });
    onSaved();
  };

  const BTN = 'rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nazwa szablonu…" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-300" />
          <select value={tplCategory} onChange={e => setTplCategory(e.target.value)} className="shrink-0 rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-600">
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={letterhead} onChange={e => setLetterhead(e.target.checked)} /> Logo zakonu w nagłówku</label>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        {/* Pasek narzędzi */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-5 py-2">
          <button onClick={() => cmd('bold')} className={BTN} title="Pogrubienie"><Bold size={15} /></button>
          <button onClick={() => cmd('italic')} className={BTN} title="Kursywa"><Italic size={15} /></button>
          <button onClick={() => cmd('underline')} className={BTN} title="Podkreślenie"><Underline size={15} /></button>
          <button onClick={() => cmd('insertUnorderedList')} className={BTN} title="Lista"><List size={15} /></button>
          <select onChange={e => { cmd('formatBlock', e.target.value); e.target.value = ''; }} defaultValue="" className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600">
            <option value="" disabled>Styl…</option>
            <option value="h1">Nagłówek</option>
            <option value="p">Akapit</option>
          </select>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <select onChange={e => { insertPlaceholder(e.target.value); e.target.value = ''; }} defaultValue="" className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1.5 text-xs font-medium text-primary-700">
            <option value="" disabled>+ Wstaw znacznik (dane pracownika)…</option>
            {DOC_PLACEHOLDERS.map(p => <option key={p.key} value={p.key}>{p.label} — {'{{'}{p.key}{'}}'}</option>)}
          </select>
        </div>

        {/* Edytor */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5">
          {letterhead && <div className="mx-auto mb-3 max-w-[720px] text-center"><img src="/ebs-neon-no-bg.png" alt="" className="inline-block h-12" /></div>}
          <div ref={editorRef} contentEditable suppressContentEditableWarning
            className="doc-editor mx-auto max-w-[720px] rounded-xl border border-slate-200 bg-white p-8 text-[15px] leading-relaxed text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-400 [&_td]:p-1.5 [&_th]:border [&_th]:border-slate-400 [&_h1]:text-lg [&_h1]:font-bold [&_p]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6" />
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3">
          {template && <button onClick={remove} className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 size={14} /> Usuń</button>}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Anuluj</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Zapisz szablon</button>
          </div>
        </div>
      </div>
    </div>
  );
}
