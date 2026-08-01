'use client';

// Poczekalnia — kandydaci do pracy zgłaszani przez koordynatorów.
// Koordynator widzi tylko swoich zgłoszonych; akceptacja (przypisanie do kontraktu)
// tylko dla szefa koordynatorów / dyrektora / admina. Odrzucenie → Archiwum.
import React, { useState, useEffect, useCallback } from 'react';
import { Hint } from '@/components/ui/Hint';
import { Hourglass, Loader2, Search, Plus, X, CheckCircle2, Trash2, UserPlus, ScanText, FolderOpen } from 'lucide-react';
import { displayName } from '@/lib/hr/docPlaceholders';
import { HrEmployeePanel, Employee, ContractLite, LANGUAGES, PROFESSIONS } from './HrEmployeePanel';

interface Candidate extends Employee { submitted_by_name?: string | null; submitted_at?: string | null }

const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400';
const emptyForm = { first_name: '', second_name: '', last_name: '', second_last_name: '', phone: '', country_of_origin: '', language: '', profession: '' };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><p className={LABEL + ' flex items-center gap-1'}>{label}{hint && <Hint text={hint} />}</p><div className="mt-1">{children}</div></div>;
}

export const HrPoczekalnia: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [contracts, setContracts] = useState<ContractLite[]>([]);
  const [coordinators, setCoordinators] = useState<{ id: string; name: string; role: string }[]>([]);
  const [accommodations, setAccommodations] = useState<{ id: string; name: string }[]>([]);
  const [savingAcc, setSavingAcc] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState('');
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveProgress, setDriveProgress] = useState('');
  const [driveLog, setDriveLog] = useState<string[]>([]);

  // Import CAŁEGO katalogu z Google Drive — pętla po 1 osobie na request
  const importDrive = async () => {
    if (!form.profession) { setError('Najpierw wybierz zawód / specjalizację — zostanie nadany wszystkim importowanym'); return; }
    if (!driveUrl.trim()) { setError('Wklej link do katalogu Google Drive'); return; }
    setDriveBusy(true); setError(null); setDriveLog([]);
    try {
      let offset = 0; let total = Infinity;
      const log: string[] = [];
      while (offset < total) {
        setDriveProgress(`Importuję ${offset + 1}${Number.isFinite(total) ? '/' + total : ''}…`);
        const r = await fetch('/api/hr/candidates/import-drive', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ url: driveUrl, profession: form.profession, offset }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Błąd importu');
        total = d.total ?? total;
        if (d.status) {
          const label = d.status === 'created' ? `✅ ${d.name} (${d.files} dok., ${d.fields} pól)` : d.status === 'skipped' ? `⏭️ ${d.name} — ${d.note}` : d.status === 'blacklist' ? `⛔ ${d.name} — CZARNA LISTA (${d.note})` : `⚠️ ${d.name} — ${d.note}`;
          log.push(label); setDriveLog([...log]);
        }
        offset++;
        if (d.done) break;
      }
      setDriveProgress('');
      await load();
    } catch (e) { setDriveProgress(''); setError(e instanceof Error ? e.message : 'Błąd importu'); }
    finally { setDriveBusy(false); }
  };

  // przydział noclegu kandydatowi (jeszcze PRZED kontraktem) — adres noclegu = adres zamieszkania w dokumentach
  const assignAccommodation = async (c: Candidate, accId: string) => {
    setSavingAcc(c.id);
    try {
      const r = await fetch(`/api/hr/employees/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ accommodation_id: accId || null }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); window.alert(d.error || 'Błąd'); return; }
      await load();
    } finally { setSavingAcc(null); }
  };
  const [canAccept, setCanAccept] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [acceptFor, setAcceptFor] = useState<Candidate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Zgłoszenie ZE ZDJĘCIA PASZPORTU — OCR tworzy kartę (imiona/nazwiska same się wpisują)
  const submitFromPassport = async (file: File) => {
    if (!form.profession) { setError('Najpierw wybierz zawód / specjalizację — potem dodaj zdjęcie paszportu'); return; }
    setScanning(true); setError(null);
    try {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('profession', form.profession);
      if (form.language) fd.set('language', form.language);
      const r = await fetch('/api/hr/candidates/from-passport', { method: 'POST', credentials: 'same-origin', body: fd });
      const d = await r.json().catch(() => ({}));
      // DUPLIKAT po paszporcie → otwórz kartotekę istniejącego pracownika
      if (r.status === 409 && d.duplicate && d.existing) {
        setShowForm(false);
        window.alert(d.error || 'Taki pracownik już istnieje w bazie.');
        setSelected(d.existing as Candidate);
        return;
      }
      if (!r.ok) throw new Error(d.error || 'Błąd odczytu paszportu');
      if (d.ok === false || d.disabled) { setError(d.error || 'OCR paszportu wyłączone — brak ANTHROPIC_API_KEY'); return; }
      setShowForm(false); setForm(emptyForm);
      await load();
      if (d.warning) window.alert(d.warning);
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setScanning(false); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [re, rc, rk, ra] = await Promise.all([
        fetch('/api/hr/employees?candidates=1', { credentials: 'same-origin' }),
        fetch('/api/hr/contracts?names=1', { credentials: 'same-origin' }),
        fetch('/api/hr/coordinators', { credentials: 'same-origin' }),
        fetch('/api/hr/accommodations', { credentials: 'same-origin' }),
      ]);
      const de = re.ok ? await re.json() : { employees: [], can_accept: false };
      const dc = rc.ok ? await rc.json() : { contracts: [] };
      const dk = rk.ok ? await rk.json() : { coordinators: [] };
      setCandidates(de.employees || []);
      setCanAccept(!!de.can_accept);
      setContracts(dc.contracts || []);
      setCoordinators(dk.coordinators || []);
      const da = ra && ra.ok ? await ra.json() : { accommodations: [] };
      setAccommodations((da.accommodations || []).map((a: any) => ({ id: a.id, name: a.name })));
    } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { setError('Imię i nazwisko są wymagane'); return; }
    if (!form.profession) { setError('Wybierz zawód / specjalizację kandydata'); return; }
    setSaving(true); setError(null);
    try {
      const r = await fetch('/api/hr/employees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ ...form, candidate: true }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Błąd zgłoszenia'); }
      setShowForm(false); setForm(emptyForm);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setSaving(false); }
  };

  const reject = async (c: Candidate) => {
    if (!confirm(`Odrzucić kandydata „${displayName(c)}"? Trafi do Archiwum (można przywrócić).`)) return;
    const r = await fetch(`/api/hr/employees/${c.id}/archive`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ action: 'archive' }),
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Błąd'); return; }
    await load();
  };

  const filtered = candidates.filter(c => !search.trim() || displayName(c).toLowerCase().includes(search.toLowerCase().trim()));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-slate-900"><Hourglass size={18} className="text-primary-500" /> Poczekalnia — kandydaci do pracy</h2>
          <p className="text-sm text-slate-500">Zgłoś kandydata, a gdy jest gotowy — przydziel go do kontraktu; zniknie z Poczekalni i pojawi się w Kontraktach{canAccept ? '' : ' (jako Twój pracownik)'}.</p>
        </div>
        <span className="flex items-center gap-1.5"><button onClick={() => { setShowForm(v => !v); setForm(emptyForm); setError(null); }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"><UserPlus size={15} /> Zgłoś kandydata</button><Hint text="Otwiera formularz zgłoszenia kandydata do Poczekalni — ręcznie albo ze zdjęcia paszportu. Kandydat czeka tu na przydział do kontraktu." /></span>
      </div>

      {/* Formularz zgłoszenia */}
      {showForm && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 font-semibold text-slate-800">Nowy kandydat (resztę danych uzupełnisz w karcie lub przez OCR dokumentów)</p>

          {/* Szybka ścieżka: zdjęcie paszportu → AI tworzy kartę */}
          <div className="mb-4 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/40 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary-800"><ScanText size={16} /> Zgłoś ze zdjęcia paszportu (najszybciej)</p>
            <p className="mt-0.5 text-xs text-slate-500">Wybierz zawód poniżej, dodaj zdjęcie — imiona, nazwiska i dane paszportu wpiszą się same (AI). Idealne przy „fikuśnych" nazwiskach.</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) submitFromPassport(f); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} disabled={scanning}
              className="mt-2 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
              {scanning ? <><Loader2 size={15} className="animate-spin" /> Czytam paszport (AI)…</> : <><ScanText size={15} /> Dodaj zdjęcie paszportu</>}
            </button>
            <Hint text="Wgrywasz zdjęcie paszportu (JPG/PNG/PDF), a AI samo wypełnia kartę: imiona, nazwiska, nr i ważność paszportu, datę urodzenia. Wcześniej wybierz zawód poniżej. Skan trafia do teczki dokumentów." className="ml-1.5 align-middle" />
          </div>
          {/* Import całego katalogu z Google Drive */}
          <div className="mb-4 rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <FolderOpen size={16} /> Import całego katalogu z Google Drive
              <Hint text="Dodaje CAŁY katalog z pracownikami z Google Drive: każdy podfolder = jeden kandydat; pliki (zdjęcia paszportów itd.) trafiają do teczek, a AI odczytuje z nich dane i wypełnia karty. WAŻNE: katalog musi mieć PEŁNY DOSTĘP w Google Drive — udostępnianie „każdy, kto ma link, może wyświetlać”. Duplikaty i osoby z czarnej listy są pomijane." />
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input value={driveUrl} onChange={e => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…"
                className="min-w-[260px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              <button onClick={importDrive} disabled={driveBusy}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {driveBusy ? <><Loader2 size={15} className="animate-spin" /> {driveProgress || 'Importuję…'}</> : <><FolderOpen size={15} /> Importuj katalog</>}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Najpierw wybierz zawód poniżej — zostanie nadany wszystkim importowanym. Import idzie osoba po osobie (OCR chwilę trwa).</p>
            {driveLog.length > 0 && (
              <div className="mt-2 max-h-36 space-y-0.5 overflow-y-auto rounded-lg bg-white/70 p-2 text-xs text-slate-700">
                {driveLog.map((l, i) => <p key={i}>{l}</p>)}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Imię (pierwsze) *" hint="Pierwsze imię z paszportu. Pole wymagane — reszta danych może dojść później (OCR dokumentów)."><input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className={INPUT} /></Field>
            <Field label="Drugie imię" hint="Drugie imię z paszportu (Latynosi zwykle mają dwa) — trafia na umowy i dokumenty."><input value={form.second_name} onChange={e => setForm({ ...form, second_name: e.target.value })} className={INPUT} /></Field>
            <Field label="Nazwisko (pierwsze) *" hint="Pierwsze nazwisko (po ojcu). Pole wymagane."><input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className={INPUT} /></Field>
            <Field label="Drugie nazwisko" hint="Drugie nazwisko (po matce) — razem z pierwszym tworzy pełne oficjalne nazwisko na dokumentach."><input value={form.second_last_name} onChange={e => setForm({ ...form, second_last_name: e.target.value })} className={INPUT} /></Field>
            <Field label="Telefon" hint="Numer kontaktowy kandydata — do szybkiego kontaktu przed przydzieleniem do kontraktu."><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={INPUT} /></Field>
            <Field label="Kraj pochodzenia" hint="Skąd pochodzi kandydat (np. Kolumbia). Ustawia też domyślny język dokumentów."><input value={form.country_of_origin} onChange={e => setForm({ ...form, country_of_origin: e.target.value })} className={INPUT} placeholder="np. Kolumbia" /></Field>
            <Field label="Język dokumentów" hint="Język, którym włada kandydat — Generator sam zaznaczy komplet dokumentów w tym języku. OCR paszportu ustawia go automatycznie.">
              <select value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} className={INPUT}>
                <option value="">— nie ustawiono —</option>
                {LANGUAGES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
              </select>
            </Field>
            <Field label="Zawód / specjalizacja *" hint="Wymagane. Zawód fizyczny wspierany przez agencję — ostatnia pozycja to pracownik niewykwalifikowany.">
              <select value={form.profession} onChange={e => setForm({ ...form, profession: e.target.value })} className={INPUT + (!form.profession ? ' border-amber-300' : '')}>
                <option value="">— wybierz zawód —</option>
                {PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Anuluj</button>
            <button onClick={submit} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Zgłoś do Poczekalni</button>
            <Hint text="Zapisuje kandydata w Poczekalni. Nie ma jeszcze kontraktu — dostanie go przy przydzieleniu. Zgłoszenie zapisuje się w Rejestrze zdarzeń." className="self-center" />
          </div>
        </div>
      )}

      {/* Szukajka */}
      <div className="relative mb-3 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj kandydata…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
      </div>

      {/* Lista kandydatów */}
      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white py-10 text-center text-sm italic text-slate-300">Poczekalnia jest pusta</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-50">
            {filtered.map(c => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-slate-50/50">
                <button onClick={() => setSelected(c)} className="min-w-0 text-left font-medium text-slate-800 hover:text-primary-600 hover:underline">{displayName(c)}</button>
                {c.language && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{c.language.toUpperCase()}</span>}
                {(c as any).profession && <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">{(c as any).profession}</span>}
                <span className="text-xs text-slate-400">
                  zgłosił: {c.submitted_by_name || '—'}{c.submitted_at ? ` · ${new Date(c.submitted_at).toLocaleDateString('pl-PL')}` : ''}
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  <select value={(c as any).accommodation_id ?? ''} disabled={savingAcc === c.id} onChange={e => assignAccommodation(c, e.target.value)}
                    className="max-w-[170px] rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600" title="Przydziel nocleg kandydatowi">
                    <option value="">— nocleg —</option>
                    {accommodations.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <Hint text="Przydziela kandydatowi miejsce w bazie noclegowej JESZCZE PRZED kontraktem. Adres noclegu = adres zamieszkania w generowanych dokumentach; zajmuje miejsce w lokalu." />
                  <span className="flex items-center gap-1"><button onClick={() => setAcceptFor(c)} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><CheckCircle2 size={13} /> Przydziel do kontraktu</button><Hint text="Przenosi kandydata do pracowników: wybierasz kontrakt i grupę. Zniknie z Poczekalni i pojawi się w drzewie Kontraktów." /></span>
                  {canAccept && (
                    <span className="flex items-center gap-1"><button onClick={() => reject(c)} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"><Trash2 size={13} /> Odrzuć</button><Hint text="Odrzuca kandydata — trafia do Archiwum z całą kartą i można go później przywrócić. Nic nie jest kasowane." /></span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Karta kandydata — ta sama co karta pracownika */}
      {selected && (
        <HrEmployeePanel
          employee={selected}
          contracts={contracts}
          onClose={() => setSelected(null)}
          onChanged={e => { setSelected(e as Candidate); load(); }}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}

      {acceptFor && (
        <AcceptModal
          candidate={acceptFor}
          contracts={contracts}
          coordinators={coordinators}
          canPickCoordinator={canAccept}
          onClose={() => setAcceptFor(null)}
          onAccepted={() => { setAcceptFor(null); load(); }}
        />
      )}
    </div>
  );
};

// ── Akceptacja: kontrakt (wymagany) + grupa + koordynator (domyślnie zgłaszający) ──
function AcceptModal({ candidate, contracts, coordinators, canPickCoordinator, onClose, onAccepted }: {
  candidate: Candidate; contracts: ContractLite[]; coordinators: { id: string; name: string; role: string }[];
  canPickCoordinator: boolean; onClose: () => void; onAccepted: () => void;
}) {
  const [contractId, setContractId] = useState('');
  const [team, setTeam] = useState('');
  const [coordinatorId, setCoordinatorId] = useState(candidate.coordinator_id || (candidate as any).submitted_by || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!contractId) { setError('Wybierz kontrakt'); return; }
    setSaving(true); setError(null);
    try {
      const r = await fetch(`/api/hr/employees/${candidate.id}/accept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ contract_id: contractId, team, coordinator_id: coordinatorId || null }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Błąd akceptacji'); }
      onAccepted();
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-sans font-bold text-slate-900">Przydział do kontraktu — {displayName(candidate)}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <Field label="Kontrakt / obiekt *" hint="Projekt, na który trafia pracownik po akceptacji. Wymagane — po zapisie kandydat znika z Poczekalni i pojawia się w Kontraktach.">
            <select value={contractId} onChange={e => setContractId(e.target.value)} className={INPUT}>
              <option value="">— wybierz kontrakt —</option>
              {contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Grupa" hint="Zespół w ramach kontraktu (np. Grupa A) — widoczny w drzewie Kontraktów i w rozliczeniach."><input value={team} onChange={e => setTeam(e.target.value)} className={INPUT} placeholder="np. Grupa A" /></Field>
          {canPickCoordinator ? (
            <Field label="Koordynator (domyślnie zgłaszający)" hint="Opiekun pracownika. Domyślnie ten, kto zgłosił kandydata — możesz wskazać innego.">
              <select value={coordinatorId} onChange={e => setCoordinatorId(e.target.value)} className={INPUT}>
                <option value="">— bez koordynatora —</option>
                {coordinators.map(k => <option key={k.id} value={k.id}>{k.name}{k.role !== 'koordynator' ? ` (${k.role})` : ''}</option>)}
              </select>
            </Field>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Pracownik zostanie przypisany do Ciebie jako koordynatora.</p>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Anuluj</button>
          <button onClick={accept} disabled={saving} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Przydziel i przenieś do Kontraktów
          </button>
        </div>
      </div>
    </div>
  );
}
