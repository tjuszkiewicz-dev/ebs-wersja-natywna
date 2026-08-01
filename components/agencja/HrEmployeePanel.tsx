'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Loader2, Phone, Mail, Landmark, Globe, FolderOpen, User, Briefcase, IdCard, Stamp, Plane, ShieldCheck, BedDouble, CalendarDays, Hash, Archive, ArchiveRestore, KeyRound } from 'lucide-react';
import { HrEmployeeDocs } from './HrEmployeeDocs';
import { HrSchedule } from './HrSchedule';
import { expiryStatus, TONE_BADGE, fmtDate, schengenDeadline } from './expiry';
import { displayName } from '@/lib/hr/docPlaceholders';
import { computeReadiness } from '@/lib/hr/readiness';
import { Hint } from '@/components/ui/Hint';
import { HeartPulse, CheckCircle2, XCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { WORK_STATUSES, workStatusDef } from '@/lib/hr/workStatus';

// Klikalna plakietka statusu pracy — zapis natychmiastowy (bez trybu edycji), jak w BBS.
function WorkStatusBadge({ employee, onChanged }: { employee: Employee; onChanged: (e: Employee) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const def = workStatusDef(employee.work_status);

  const pick = async (id: string) => {
    if (id === employee.work_status) { setOpen(false); return; }
    setOpen(false); setBusy(true);
    try {
      const r = await fetch(`/api/hr/employees/${employee.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ work_status: id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Błąd');
      onChanged(d);
    } catch (e) { alert(e instanceof Error ? e.message : 'Błąd zmiany statusu'); } finally { setBusy(false); }
  };

  return (
    <div className="relative mt-1 inline-block">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${def.badge} disabled:opacity-60`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${def.dot}`} />
        {def.label}
        <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {WORK_STATUSES.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-sans text-slate-700 hover:bg-slate-50"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Checklist „gotowy do pracy" — podsumowanie kompletności dokumentów pracownika
function ReadinessBlock({ employee }: { employee: Employee }) {
  const r = computeReadiness(employee);
  const ICON = { ok: <CheckCircle2 size={15} className="text-emerald-500" />, missing: <XCircle size={15} className="text-slate-300" />, expired: <AlertCircle size={15} className="text-red-500" /> };
  const STAT = { ok: 'ważne', missing: 'brak', expired: 'wygasłe' } as const;
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><HeartPulse size={14} className="text-primary-500" /> Gotowość do pracy</p>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${r.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.ready ? '✓ Gotowy do pracy' : `Niekompletny (${r.done}/${r.total})`}</span>
      </div>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {r.checks.map(c => (
          <div key={c.key} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm ring-1 ring-slate-100">
            {ICON[c.status]}
            <span className="flex-1 text-slate-700">{c.label}</span>
            <span className={`text-[11px] font-semibold ${c.status === 'ok' ? 'text-emerald-600' : c.status === 'expired' ? 'text-red-600' : 'text-slate-400'}`}>{STAT[c.status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface Employee {
  id: string; first_name: string; last_name: string;
  phone?: string | null; email?: string | null; bank_account?: string | null;
  country_of_origin?: string | null; notes?: string | null; status: string;
  contract_id?: string | null; team?: string | null; contract?: { id: string; name: string } | null; created_at?: string;
  residence_card_number?: string | null; residence_card_expiry?: string | null;
  work_permit_number?: string | null; work_permit_expiry?: string | null; visa_expiry?: string | null;
  zus_registration_date?: string | null; pesel?: string | null;
  medical_exam_date?: string | null; medical_exam_expiry?: string | null;
  schengen_entry_date?: string | null;
  passport_number?: string | null; birth_date?: string | null; birth_place?: string | null; gender?: string | null;
  second_name?: string | null; family_name?: string | null; passport_expiry?: string | null; second_last_name?: string | null;
  language?: string | null; coordinator_id?: string | null;
  profession?: string | null; blacklisted?: boolean; blacklist_reason?: string | null;
  shoe_size?: string | null; clothing_size?: string | null;
  accommodation_id?: string | null; accommodation?: { id: string; name: string } | null;
  archived?: boolean; archived_at?: string | null; archived_from?: string | null; archive_reason?: string | null;
  candidate?: boolean;
  work_status?: string | null;
}
export interface ContractLite { id: string; name: string }

const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';
export const LANGUAGES: [string, string][] = [['es', 'Hiszpański'], ['en', 'Angielski'], ['ru', 'Rosyjski'], ['pl', 'Polski']];
export const langLabel = (code?: string | null) => LANGUAGES.find(([c]) => c === code)?.[1] ?? null;

// Zawody fizyczne wspierane przez agencję — „Pracownik niewykwalifikowany" zawsze ostatni
export const PROFESSIONS: string[] = [
  'Pracownik produkcji', 'Pracownik magazynu', 'Komisjoner (picker)', 'Pakowacz', 'Sortowacz',
  'Operator wózka widłowego', 'Operator maszyn', 'Monter', 'Spawacz', 'Ślusarz',
  'Elektryk', 'Hydraulik', 'Mechanik samochodowy', 'Blacharz', 'Lakiernik',
  'Stolarz', 'Cieśla', 'Tapicer', 'Krawiec / szwaczka',
  'Pracownik budowlany', 'Murarz', 'Zbrojarz', 'Tynkarz', 'Malarz budowlany', 'Dekarz', 'Brukarz',
  'Kierowca kat. B', 'Kierowca kat. C / C+E',
  'Pracownik recyklingu / sortowni odpadów', 'Pracownik sprzątający', 'Pracownik gospodarczy',
  'Ogrodnik', 'Pracownik rolny',
  'Rzeźnik / pracownik ubojni', 'Piekarz', 'Cukiernik', 'Kucharz', 'Pomoc kuchenna', 'Kelner', 'Pokojówka / housekeeping',
  'Pracownik niewykwalifikowany',
];
const LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="py-1.5"><p className={LABEL + ' flex items-center gap-1'}>{label}{hint && <Hint text={hint} />}</p><div className="mt-1">{children}</div></div>;
}
function ViewRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <div className="mt-0.5 text-primary-500">{icon}</div>
      <div className="min-w-0 flex-1"><p className={LABEL}>{label}</p><p className="break-words text-sm text-slate-800">{value || <span className="text-slate-300">—</span>}</p></div>
    </div>
  );
}
function ExpiryRow({ icon, label, number, date }: { icon: React.ReactNode; label: string; number?: string | null; date?: string | null }) {
  const st = expiryStatus(date);
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
      <div className="mt-0.5 text-primary-500">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{label}{number ? <span className="ml-2 text-xs font-normal text-slate-400">nr {number}</span> : null}</p>
        <p className="text-xs text-slate-500">ważne do: {fmtDate(date)}</p>
      </div>
      {st && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_BADGE[st.tone]}`}>{st.label}</span>}
    </div>
  );
}
function ZusRow({ date }: { date?: string | null }) {
  const registered = !!date;
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
      <div className="mt-0.5 text-primary-500"><ShieldCheck size={16} /></div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">Zgłoszenie do ZUS</p>
        <p className="text-xs text-slate-500">{registered ? `zgłoszony: ${fmtDate(date)}` : 'brak zgłoszenia'}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${registered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{registered ? 'Zgłoszony' : 'Niezgłoszony'}</span>
    </div>
  );
}

export function HrEmployeePanel({ employee, contracts, onClose, onChanged, onDeleted, mode = 'active' }: {
  employee: Employee; contracts: ContractLite[]; onClose: () => void; onChanged: (e: Employee) => void; onDeleted: (id: string) => void;
  mode?: 'active' | 'archived';
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accommodations, setAccommodations] = useState<{ id: string; name: string }[]>([]);
  const [coordinators, setCoordinators] = useState<{ id: string; name: string; role: string }[]>([]);

  useEffect(() => {
    fetch('/api/hr/accommodations', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : { accommodations: [] }))
      .then(d => setAccommodations(d.accommodations || []))
      .catch(() => {});
    fetch('/api/hr/coordinators', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : { coordinators: [] }))
      .then(d => setCoordinators(d.coordinators || []))
      .catch(() => {});
  }, []);

  const startEdit = () => { setForm({ ...employee, contract_id: employee.contract_id ?? '', team: employee.team ?? '', accommodation_id: employee.accommodation_id ?? '', coordinator_id: employee.coordinator_id ?? '' }); setEditing(true); setError(null); };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const r = await fetch(`/api/hr/employees/${employee.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ ...form, contract_id: form.contract_id || null, accommodation_id: form.accommodation_id || null, coordinator_id: form.coordinator_id || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Błąd');
      setEditing(false); onChanged(d);
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setSaving(false); }
  };

  // „Usuń z kontraktu" = przeniesienie do Archiwum (cała historia zostaje).
  // Modal pozwala oflagować na czerwono (czarna lista) — z wymaganym powodem.
  // konto portalu pracownika (login+hasło startowe generowane przez koordynatora)
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountInfo, setAccountInfo] = useState<{ login: string; password: string; reset: boolean } | null>(null);
  const createAccount = async () => {
    if (accountBusy) return;
    if (accountInfo && !confirm('Konto już istnieje — zresetować hasło pracownika?')) return;
    setAccountBusy(true);
    try {
      const r = await fetch(`/api/hr/employees/${employee.id}/account`, { method: 'POST', credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Błąd tworzenia konta');
      setAccountInfo({ login: j.login, password: j.password, reset: !!j.reset });
    } catch (e) { alert(e instanceof Error ? e.message : 'Błąd'); } finally { setAccountBusy(false); }
  };

  const [archiveModal, setArchiveModal] = useState(false);
  const [blFlag, setBlFlag] = useState(false);
  const [archReason, setArchReason] = useState('');
  const [blReason, setBlReason] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const doArchive = async () => {
    if (!employee.candidate && !archReason.trim()) { setArchiveError('Podaj przyczynę zwolnienia — co się stało (wymagane)'); return; }
    if (blFlag && !blReason.trim() && !archReason.trim()) { setArchiveError('Podaj powód oflagowania (kradzież, porzucenie pracy, zła praca…)'); return; }
    setArchiving(true); setArchiveError(null);
    try {
      const r = await fetch(`/api/hr/employees/${employee.id}/archive`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ action: 'archive', reason: archReason, blacklisted: blFlag, blacklist_reason: blReason || archReason }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Błąd archiwizacji'); }
      setArchiveModal(false);
      onDeleted(employee.id);
    } catch (e) { setArchiveError(e instanceof Error ? e.message : 'Błąd'); } finally { setArchiving(false); }
  };

  const restore = async () => {
    if (employee.blacklisted && !confirm(`„${displayName(employee)}" jest na CZARNEJ LIŚCIE${employee.blacklist_reason ? ` (powód: ${employee.blacklist_reason})` : ''}.\n\nPrzywrócenie ZDEJMIE flagę czarnej listy. Kontynuować?`)) return;
    const r = await fetch(`/api/hr/employees/${employee.id}/archive`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ action: 'restore' }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { alert(d.error || 'Błąd przywracania'); return; }
    if (!d.restored_to_contract) alert('Przywrócono BEZ kontraktu (dawny kontrakt już nie istnieje) — przypisz go w karcie pracownika.');
    onDeleted(employee.id);
  };

  const removeForever = async () => {
    if (!confirm(`USUNĄĆ TRWALE „${displayName(employee)}"?\n\nZnikną też wszystkie dokumenty. Tej operacji nie da się cofnąć.`)) return;
    await fetch(`/api/hr/employees/${employee.id}`, { method: 'DELETE', credentials: 'same-origin' });
    onDeleted(employee.id);
  };

  const contractName = employee.contract?.name || contracts.find(c => c.id === employee.contract_id)?.name;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm" onClick={() => { if (!editing) onClose(); }} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 bg-gradient-to-br from-primary-600 to-primary-500 px-6 py-5 text-white">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">{editing ? 'Edycja pracownika' : 'Karta pracownika'}</p>
            <h3 className="truncate font-sans text-lg font-bold leading-tight">{editing ? displayName(form) : displayName(employee)}</h3>
            {!editing && <WorkStatusBadge employee={employee} onChanged={onChanged} />}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/15"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {editing ? (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              <Field label="Imię (pierwsze) *" hint="Pierwsze imię z paszportu — trafia na wszystkie dokumenty i umowy. Wymagane."><input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className={INPUT} /></Field>
              <Field label="Nazwisko (pierwsze — po ojcu) *" hint="Pierwsze nazwisko (apellido paterno). Wymagane. Na dokumentach łączy się z drugim w pełne nazwisko."><input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className={INPUT} /></Field>
              <Field label="Kontrakt / obiekt" hint="Projekt, na którym pracuje osoba (np. Magazyn SHEIN). Zmiana przenosi pracownika w drzewie Kontraktów.">
                <select value={form.contract_id} onChange={e => setForm({ ...form, contract_id: e.target.value })} className={INPUT}>
                  <option value="">— bez kontraktu —</option>
                  {contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Grupa" hint="Zespół w ramach kontraktu (np. Grupa A) — grupuje ludzi w drzewie i raportach."><input value={form.team ?? ''} onChange={e => setForm({ ...form, team: e.target.value })} className={INPUT} placeholder="np. Grupa A" /></Field>
              <div className="sm:col-span-2"><Field label="Nocleg (baza noclegowa)" hint="Przydział miejsca noclegowego. UWAGA: adres tego noclegu = adres zamieszkania w generowanych dokumentach.">
                <select value={form.accommodation_id ?? ''} onChange={e => setForm({ ...form, accommodation_id: e.target.value })} className={INPUT}>
                  <option value="">— brak / zapewnia pracodawca —</option>
                  {accommodations.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field></div>
              <div className="sm:col-span-2"><Field label="Koordynator (opiekun)" hint="Opiekun pracownika. Koordynator widzi w programie tylko swoich ludzi; wynagrodzenie koordynatora ustawia się w Rozliczeniach.">
                <select value={form.coordinator_id ?? ''} onChange={e => setForm({ ...form, coordinator_id: e.target.value })} className={INPUT}>
                  <option value="">— brak koordynatora —</option>
                  {coordinators.map(c => <option key={c.id} value={c.id}>{c.name}{c.role !== 'koordynator' ? ` (${c.role})` : ''}</option>)}
                </select>
              </Field></div>
              <Field label="Kraj pochodzenia" hint="Obywatelstwo/kraj — używane w pełnomocnictwach i do domyślnego języka dokumentów."><input value={form.country_of_origin ?? ''} onChange={e => setForm({ ...form, country_of_origin: e.target.value })} className={INPUT} /></Field>
              <Field label="Język dokumentów" hint="Język, którym włada pracownik — Generator sam zaznacza komplet dokumentów w tym języku.">
                <select value={form.language ?? ''} onChange={e => setForm({ ...form, language: e.target.value || null })} className={INPUT}>
                  <option value="">— nie ustawiono —</option>
                  {LANGUAGES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
                </select>
              </Field>
              <Field label="Zawód / specjalizacja *" hint="Zawód fizyczny z listy agencji (ostatnia pozycja: pracownik niewykwalifikowany). Wymagany u kandydatów.">
                <select value={form.profession ?? ''} onChange={e => setForm({ ...form, profession: e.target.value || null })} className={INPUT}>
                  <option value="">— wybierz zawód —</option>
                  {PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Status" hint="Aktywny = pracuje i wchodzi do alertów/rozliczeń. Nieaktywny = wstrzymany, znika z alertów terminów.">
                <select value={form.status === 'active' ? 'active' : 'inactive'} onChange={e => setForm({ ...form, status: e.target.value })} className={INPUT}>
                  <option value="active">Aktywny</option>
                  <option value="inactive">Nieaktywny</option>
                </select>
              </Field>
              <Field label="Rozmiar buta" hint="Rozmiar obuwia roboczego (np. 43) — do zamawiania i wydawania BHP."><input value={form.shoe_size ?? ''} onChange={e => setForm({ ...form, shoe_size: e.target.value })} className={INPUT} placeholder="np. 43" /></Field>
              <Field label="Rozmiar ubrania" hint="Rozmiar odzieży roboczej (np. L, XL, 52) — do zamawiania i wydawania BHP."><input value={form.clothing_size ?? ''} onChange={e => setForm({ ...form, clothing_size: e.target.value })} className={INPUT} placeholder="np. L / 52" /></Field>
              <Field label="Telefon" hint="Numer kontaktowy — trafia też do kwestionariusza osobowego."><input value={form.phone ?? ''} onChange={e => setForm({ ...form, phone: e.target.value })} className={INPUT} /></Field>
              <Field label="E-mail" hint="Adres e-mail pracownika (opcjonalny) — do kontaktu."><input value={form.email ?? ''} onChange={e => setForm({ ...form, email: e.target.value })} className={INPUT} /></Field>
              <div className="sm:col-span-2"><Field label="Nr konta bankowego" hint="IBAN do wypłat — wstawia się automatycznie w oświadczeniu wykonawcy. OCR odczytuje go z dokumentów bankowych."><input value={form.bank_account ?? ''} onChange={e => setForm({ ...form, bank_account: e.target.value })} className={INPUT} /></Field></div>
              <Field label="Drugie imię" hint="Drugie imię z paszportu — na dokumentach używamy pełnych oficjalnych imion."><input value={form.second_name ?? ''} onChange={e => setForm({ ...form, second_name: e.target.value })} className={INPUT} /></Field>
              <Field label="Drugie nazwisko (po matce)" hint="Drugie nazwisko (apellido materno) — Latynosi mają zwykle dwa; oba idą na umowy."><input value={form.second_last_name ?? ''} onChange={e => setForm({ ...form, second_last_name: e.target.value })} className={INPUT} /></Field>
              <Field label="Nazwisko rodowe" hint="Nazwisko rodowe (panieńskie) — używane w kwestionariuszu osobowym."><input value={form.family_name ?? ''} onChange={e => setForm({ ...form, family_name: e.target.value })} className={INPUT} /></Field>
              <Field label="Nr paszportu" hint="Seria i numer paszportu — kluczowy identyfikator; używany w pełnomocnictwach i przy kontroli czarnej listy."><input value={form.passport_number ?? ''} onChange={e => setForm({ ...form, passport_number: e.target.value })} className={INPUT} /></Field>
              <Field label="Paszport ważny do" hint="Data ważności paszportu — przy ≤60 dniach pojawia się alert."><input type="date" value={form.passport_expiry ?? ''} onChange={e => setForm({ ...form, passport_expiry: e.target.value })} className={INPUT} /></Field>
              <Field label="Data urodzenia" hint="Data urodzenia z paszportu — wymagana w dekretach i umowach."><input type="date" value={form.birth_date ?? ''} onChange={e => setForm({ ...form, birth_date: e.target.value })} className={INPUT} /></Field>
              <Field label="Miejsce urodzenia" hint="Miejsce urodzenia z paszportu — trafia do dekretów i kwestionariusza."><input value={form.birth_place ?? ''} onChange={e => setForm({ ...form, birth_place: e.target.value })} className={INPUT} /></Field>
              <Field label="Płeć" hint="Rozpoznawana automatycznie z paszportu (pole Sex/MRZ). Można zmienić ręcznie — używana m.in. we wniosku o PESEL."><select value={form.gender ?? ''} onChange={e => setForm({ ...form, gender: e.target.value || null })} className={INPUT}><option value="">— nie podano —</option><option value="M">Mężczyzna</option><option value="K">Kobieta</option></select></Field>
              <div className="sm:col-span-2 mt-2 border-t border-slate-100 pt-2"><p className={LABEL + ' text-primary-600'}>Legalizacja pobytu i pracy</p></div>
              <Field label="Nr karty pobytu" hint="Numer karty pobytu (jeśli posiada)."><input value={form.residence_card_number ?? ''} onChange={e => setForm({ ...form, residence_card_number: e.target.value })} className={INPUT} /></Field>
              <Field label="Karta pobytu — ważna do" hint="Data ważności karty pobytu — przy ≤60 dniach alert legalizacyjny."><input type="date" value={form.residence_card_expiry ?? ''} onChange={e => setForm({ ...form, residence_card_expiry: e.target.value })} className={INPUT} /></Field>
              <Field label="Nr pozwolenia na pracę" hint="Numer pozwolenia na pracę (jeśli posiada)."><input value={form.work_permit_number ?? ''} onChange={e => setForm({ ...form, work_permit_number: e.target.value })} className={INPUT} /></Field>
              <Field label="Pozwolenie — ważne do" hint="Data ważności pozwolenia na pracę — przy ≤60 dniach alert."><input type="date" value={form.work_permit_expiry ?? ''} onChange={e => setForm({ ...form, work_permit_expiry: e.target.value })} className={INPUT} /></Field>
              <Field label="Wiza — ważna do" hint="Data końca wizy / legalnego pobytu — przy ≤60 dniach alert."><input type="date" value={form.visa_expiry ?? ''} onChange={e => setForm({ ...form, visa_expiry: e.target.value })} className={INPUT} /></Field>
              <Field label="Wjazd do strefy Schengen" hint="Data wjazdu do Schengen. Od niej liczy się 90 dni na złożenie wniosku o kartę pobytu — alert pojawia się 30 dni przed końcem tego terminu."><input type="date" value={form.schengen_entry_date ?? ''} onChange={e => setForm({ ...form, schengen_entry_date: e.target.value })} className={INPUT} /></Field>
              <Field label="Zgłoszenie do ZUS (data)" hint="Data zgłoszenia do ZUS — brak daty podbija alert „bez ZUS”."><input type="date" value={form.zus_registration_date ?? ''} onChange={e => setForm({ ...form, zus_registration_date: e.target.value })} className={INPUT} /></Field>
              <Field label="Numer PESEL" hint="PESEL (11 cyfr) — brak PESEL podbija alert na głównym widoku; używany w dokumentach."><input value={form.pesel ?? ''} onChange={e => setForm({ ...form, pesel: e.target.value })} className={INPUT} placeholder="11 cyfr" /></Field>
              <Field label="Badania lekarskie (data)" hint="Data wykonania badań medycyny pracy."><input type="date" value={form.medical_exam_date ?? ''} onChange={e => setForm({ ...form, medical_exam_date: e.target.value })} className={INPUT} /></Field>
              <Field label="Badania ważne do" hint="Data ważności badań lekarskich — wchodzi do checklisty „gotowy do pracy”; wygasłe blokują gotowość."><input type="date" value={form.medical_exam_expiry ?? ''} onChange={e => setForm({ ...form, medical_exam_expiry: e.target.value })} className={INPUT} /></Field>
              <div className="sm:col-span-2"><Field label="Notatki" hint="Wewnętrzne uwagi o pracowniku — nie trafiają do żadnych dokumentów."><textarea value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className={INPUT + ' resize-y'} /></Field></div>
              {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}
            </div>
          ) : (
            <>
              {employee.archived && (
                <div className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${employee.blacklisted ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
                  <Archive size={15} /> W archiwum{employee.archived_at ? ` od ${fmtDate(employee.archived_at)}` : ''}{employee.archived_from ? ` · był w: ${employee.archived_from}` : ''}{employee.archive_reason ? ` · przyczyna: ${employee.archive_reason}` : ''}
                </div>
              )}
              {employee.blacklisted && (
                <div className="mb-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white">
                  ⛔ CZARNA LISTA{employee.blacklist_reason ? ` — powód: ${employee.blacklist_reason}` : ''}
                </div>
              )}
              <ViewRow icon={<Briefcase size={16} />} label="Kontrakt / obiekt" value={contractName ? `${contractName}${employee.team ? ` · ${employee.team}` : ''}` : null} />
              <ViewRow icon={<BedDouble size={16} />} label="Nocleg" value={employee.accommodation?.name || null} />
              <ViewRow icon={<User size={16} />} label="Koordynator" value={coordinators.find(c => c.id === employee.coordinator_id)?.name || null} />
              <ViewRow icon={<Briefcase size={16} />} label="Zawód / specjalizacja" value={employee.profession || null} />
              <ViewRow icon={<Globe size={16} />} label="Kraj pochodzenia" value={employee.country_of_origin} />
              <ViewRow icon={<Globe size={16} />} label="Język dokumentów" value={langLabel(employee.language)} />
              <ViewRow icon={<Briefcase size={16} />} label="Rozmiar buta / ubrania" value={[employee.shoe_size, employee.clothing_size].filter(Boolean).join(' / ') || null} />
              <ViewRow icon={<Phone size={16} />} label="Telefon" value={employee.phone} />
              <ViewRow icon={<Mail size={16} />} label="E-mail" value={employee.email} />
              <ViewRow icon={<Landmark size={16} />} label="Nr konta bankowego" value={employee.bank_account} />
              <ViewRow icon={<User size={16} />} label="Drugie imię / drugie nazwisko / rodowe" value={[employee.second_name, employee.second_last_name, employee.family_name].filter(Boolean).join(' / ') || null} />
              <ViewRow icon={<User size={16} />} label="Data i miejsce urodzenia" value={[fmtDate(employee.birth_date), employee.birth_place].filter(Boolean).join(', ') || null} />
              <ViewRow icon={<User size={16} />} label="Płeć" value={employee.gender === 'M' ? 'Mężczyzna' : employee.gender === 'K' ? 'Kobieta' : null} />
              <div className="flex items-start gap-3 border-b border-slate-100 py-2.5">
                <div className="mt-0.5 text-primary-500"><User size={16} /></div>
                <div className="min-w-0 flex-1">
                  <p className={LABEL}>Status</p>
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${employee.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{employee.status === 'active' ? 'Aktywny' : 'Nieaktywny'}</span>
                </div>
              </div>
              <div className="mt-4">
                <p className={LABEL + ' mb-2 flex items-center gap-1.5'}><IdCard size={14} className="text-primary-500" /> Legalizacja pobytu i pracy</p>
                <div className="space-y-1.5">
                  <ExpiryRow icon={<IdCard size={16} />} label="Paszport" number={employee.passport_number} date={employee.passport_expiry} />
                  <ExpiryRow icon={<IdCard size={16} />} label="Karta pobytu" number={employee.residence_card_number} date={employee.residence_card_expiry} />
                  <ExpiryRow icon={<Stamp size={16} />} label="Pozwolenie na pracę" number={employee.work_permit_number} date={employee.work_permit_expiry} />
                  <ExpiryRow icon={<Plane size={16} />} label="Wiza" date={employee.visa_expiry} />
                  {employee.schengen_entry_date && (
                    <ExpiryRow icon={<Plane size={16} />} label={`Karta pobytu — 90 dni od wjazdu Schengen (wjazd ${fmtDate(employee.schengen_entry_date)})`} date={schengenDeadline(employee.schengen_entry_date)} />
                  )}
                  <ZusRow date={employee.zus_registration_date} />
                  <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                    <div className="mt-0.5 text-primary-500"><Hash size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">Numer PESEL</p>
                      <p className="text-xs text-slate-500">{employee.pesel || 'brak'}</p>
                    </div>
                    {!employee.pesel && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">brak</span>}
                  </div>
                  <ExpiryRow icon={<HeartPulse size={16} />} label="Badania lekarskie" date={employee.medical_exam_expiry} />
                </div>
              </div>
              {!employee.archived && <ReadinessBlock employee={employee} />}
              <div className="mt-5">
                <p className={LABEL + ' mb-2 flex items-center gap-1.5'}><CalendarDays size={14} className="text-primary-500" /> Grafik pracy</p>
                <HrSchedule employeeId={employee.id} />
              </div>
              {employee.notes && <div className="mt-3"><p className={LABEL}>Notatki</p><p className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-100">{employee.notes}</p></div>}
              <div className="mt-5">
                <p className={LABEL + ' mb-2 flex items-center gap-1.5'}><FolderOpen size={14} className="text-primary-500" /> Dokumenty</p>
                <HrEmployeeDocs employeeId={employee.id} />
              </div>
            </>
          )}
        </div>

        <div className="space-y-2 border-t border-slate-100 p-4">
          {editing ? (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} disabled={saving} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Anuluj</button>
              <button onClick={save} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Zapisz</button><Hint text="Zapisuje zmienione pola kartoteki. Koordynator może edytować tylko swoich pracowników; przeniesienia między kontraktami robi się przez pole Kontrakt (wyższe role)." className="self-center" />
            </div>
          ) : (
            <>
              <span className="flex w-full items-center gap-1.5"><button onClick={startEdit} className="w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">Edytuj dane</button><Hint text="Otwiera edycję wszystkich pól kartoteki (imiona, dokumenty, legalizacja, przydziały). Zmiany zapisują się dopiero po kliknięciu Zapisz i są logowane w Rejestrze zdarzeń." /></span>
              {mode !== 'archived' && !employee.candidate && (
                <span className="flex w-full items-center gap-1.5">
                  <button onClick={createAccount} disabled={accountBusy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary-200 bg-primary-50 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50">
                    {accountBusy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} {accountInfo ? 'Resetuj hasło konta' : 'Utwórz konto (portal pracownika)'}
                  </button>
                  <Hint text="Tworzy konto systemowe pracownika (rola pracownik tymczasowy) — po zalogowaniu widzi swoje dane, dokumenty, rozliczenia, grafik i tłumacza, może włączyć automatyczną kartę pracy z lokalizacji. System pokaże login i hasło startowe do przekazania pracownikowi; ponowne kliknięcie resetuje hasło." />
                </span>
              )}
              {accountInfo && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  <p className="font-semibold text-emerald-800">{accountInfo.reset ? 'Hasło zresetowane' : 'Konto utworzone'} — przekaż pracownikowi:</p>
                  <p className="mt-1 font-mono text-xs text-slate-700">login: {accountInfo.login}<br />hasło: {accountInfo.password}</p>
                  <p className="mt-1 text-[11px] text-emerald-700">Zapisz teraz — hasło nie będzie więcej pokazane.</p>
                </div>
              )}
              {mode === 'archived' ? (
                <>
                  <button onClick={restore} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"><ArchiveRestore size={14} /> Przywróć z archiwum</button><Hint text="Przywraca osobę z Archiwum — wróci do dawnego kontraktu, jeśli nadal istnieje. U oflagowanych zdejmuje flagę czarnej listy (z potwierdzeniem)." className="self-center" />
                  <button onClick={removeForever} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 size={14} /> Usuń trwale (z dokumentami)</button><Hint text="NIEODWRACALNE: kasuje kartę pracownika razem ze wszystkimi dokumentami ze storage. Dostępne tylko z Archiwum i tylko dla admin/dyrektor." className="self-center" />
                </>
              ) : (
                <span className="flex w-full items-center gap-1.5">
                  <button onClick={() => { setArchiveModal(true); setBlFlag(false); setBlReason(''); setArchReason(''); setArchiveError(null); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"><Archive size={14} /> Usuń z kontraktu (do Archiwum)</button>
                  <Hint text="Bezpieczne usunięcie: pracownik trafia do Archiwum z całą historią (dokumenty, rozliczenia, grafik). W oknie możesz też oflagować go na czarnej liście. Można przywrócić w każdej chwili." />
                </span>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Modal archiwizacji — z opcją oflagowania na czarną listę (powód wymagany) */}
      {archiveModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setArchiveModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-1 font-sans font-bold text-slate-900">Usuń z kontraktu — {displayName(employee)}</h3>
            <p className="mb-3 text-sm text-slate-500">Pracownik trafi do Archiwum — dane, dokumenty, rozliczenia i grafik zostają. Można go przywrócić w każdej chwili.</p>

            <div className="mb-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Przyczyna zwolnienia / przeniesienia *<Hint text="Wymagane: napisz co się stało (np. koniec kontraktu, rezygnacja, porzucenie pracy). Przyczyna zapisuje się przy pracowniku w Archiwum i w Rejestrze zdarzeń." /></p>
              <textarea value={archReason} onChange={e => setArchReason(e.target.value)} rows={2} placeholder="np. koniec kontraktu SHEIN / rezygnacja z pracy 6.07.2026" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" autoFocus />
            </div>
            <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition ${blFlag ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="checkbox" checked={blFlag} onChange={e => setBlFlag(e.target.checked)} className="mt-0.5 accent-red-600" />
              <span>
                <span className={`block text-sm font-bold ${blFlag ? 'text-red-700' : 'text-slate-700'}`}>⛔ Oflaguj na CZARNEJ LIŚCIE</span>
                <span className="block text-xs text-slate-500">Osoba czymś podpadła (kradzież, porzucenie pracy, zła praca…). Zostanie w Archiwum w sektorze „Czarna lista" — przy próbie ponownego zgłoszenia system zablokuje i pokaże powód.</span>
              </span>
            </label>
            {blFlag && (
              <div className="mt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">Powód oflagowania *</p>
                <textarea value={blReason} onChange={e => setBlReason(e.target.value)} rows={2} placeholder="np. kradzież narzędzi na obiekcie SHEIN, 15.06.2026"
                  className="mt-1 w-full rounded-lg border border-red-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" autoFocus />
              </div>
            )}
            {archiveError && <p className="mt-2 text-xs font-semibold text-red-600">{archiveError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setArchiveModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Anuluj</button>
              <button onClick={doArchive} disabled={archiving}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${blFlag ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                {archiving ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />}
                {blFlag ? 'Do Archiwum + czarna lista' : 'Przenieś do Archiwum'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
