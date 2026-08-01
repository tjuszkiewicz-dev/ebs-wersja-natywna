'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, ChevronRight, ChevronDown, Users, Pencil, Trash2, Save, Loader2, X, User, UserPlus, Search, UserMinus , FileText, IdCard, Plane, Landmark, Fingerprint } from 'lucide-react';
import { HrEmployeePanel, type Employee, type ContractLite } from './HrEmployeePanel';
import { HrPermitAlerts } from './HrPermitAlerts';
import { displayName } from '@/lib/hr/docPlaceholders';
import { computeReadiness } from '@/lib/hr/readiness';
import { Hint } from '@/components/ui/Hint';
import { WORK_STATUSES, workStatusDef, type WorkStatusId } from '@/lib/hr/workStatus';

interface Contract {
  id: string; name: string; employer?: string | null; address?: string | null;
  contact_person?: string | null; phone?: string | null; status: string; notes?: string | null; employee_count: number;
  status_counts?: Partial<Record<WorkStatusId, number>>;
}

// Plakietki z licznikami statusów pracy — pomija statusy z zerem, degraduje się cicho przy braku danych
function StatusCountBadges({ counts }: { counts?: Partial<Record<WorkStatusId, number>> }) {
  if (!counts) return null;
  const entries = WORK_STATUSES.map(s => ({ s, n: counts[s.id] ?? 0 })).filter(x => x.n > 0);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {entries.map(({ s, n }) => (
        <span key={s.id} title={s.label} className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${s.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label} {n}
        </span>
      ))}
    </div>
  );
}

const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400';
const emptyC = { name: '', employer: '', address: '', contact_person: '', phone: '', notes: '', status: 'active' };
const emptyEmp = { first_name: '', last_name: '', contract_id: '', team: '', country_of_origin: '', phone: '', email: '', bank_account: '', status: 'active' };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><p className={LABEL + ' flex items-center gap-1'}>{label}{hint && <Hint text={hint} />}</p><div className="mt-1">{children}</div></div>;
}

// ── Statusy pracownika widoczne na liście (bez wchodzenia w szczegóły) ──
const fmtDate = (d?: string | null): string => {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' });
};
const daysLeft = (d?: string | null): number | null => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return Math.ceil((dt.getTime() - Date.now()) / 86400000);
};
// kolor pigułki wg terminu ważności dokumentu
const expiryTone = (d?: string | null): 'ok' | 'warn' | 'expired' | 'none' => {
  const dl = daysLeft(d);
  if (dl === null) return 'none';
  if (dl < 0) return 'expired';
  if (dl <= 30) return 'warn';
  return 'ok';
};
const TONE: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
  none: 'bg-slate-100 text-slate-400 border-slate-200',
};
function Pill({ tone, icon, children, title }: { tone: 'ok' | 'warn' | 'expired' | 'none'; icon: React.ReactNode; children: React.ReactNode; title: string }) {
  return (
    <span title={title} className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${TONE[tone]}`}>
      {icon}{children}
    </span>
  );
}

// PESEL · Wiza · Karta pobytu / Pozwolenie · ZUS — na jeden rzut oka
function EmpStatusBadges({ e }: { e: Employee }) {
  const hasPesel = !!(e.pesel && String(e.pesel).trim());
  const hasZus = !!e.zus_registration_date;
  const hasCard = !!(e.residence_card_number || e.residence_card_expiry);
  const hasPermit = !!(e.work_permit_number || e.work_permit_expiry);
  const cardTone = hasCard ? expiryTone(e.residence_card_expiry) : 'none';
  const permitTone = hasPermit ? expiryTone(e.work_permit_expiry) : 'none';
  const visaTone = e.visa_expiry ? expiryTone(e.visa_expiry) : 'none';
  // Schengen: termin na kartę pobytu = wjazd + 90 dni (pigułka tylko gdy podano datę wjazdu)
  const schDeadline = (e as any).schengen_entry_date ? new Date(new Date((e as any).schengen_entry_date).getTime() + 90 * 86400000).toISOString().slice(0, 10) : null;
  const ready = computeReadiness(e);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Pill tone={ready.ready ? 'ok' : 'warn'} icon={ready.ready ? <Fingerprint size={9} /> : <Fingerprint size={9} />} title={ready.ready ? 'Gotowy do pracy — komplet dokumentów' : `Niekompletny — ${ready.done}/${ready.total} pozycji (${ready.checks.filter(c => c.status !== 'ok').map(c => c.label).join(', ')})`}>
        {ready.ready ? '✓ gotowy' : `${ready.done}/${ready.total}`}
      </Pill>
      <Pill tone={hasPesel ? 'ok' : 'warn'} icon={<Fingerprint size={9} />} title={hasPesel ? `PESEL: ${e.pesel}` : 'Brak numeru PESEL'}>
        PESEL {hasPesel ? '✓' : '—'}
      </Pill>
      {e.visa_expiry
        ? <Pill tone={visaTone} icon={<Plane size={9} />} title={`Wiza ważna do ${fmtDate(e.visa_expiry)}${daysLeft(e.visa_expiry)! < 0 ? ' (wygasła)' : ''}`}>Wiza {fmtDate(e.visa_expiry)}</Pill>
        : <Pill tone="none" icon={<Plane size={9} />} title="Brak daty ważności wizy">Wiza —</Pill>}
      {hasCard
        ? <Pill tone={cardTone} icon={<IdCard size={9} />} title={`Karta pobytu${e.residence_card_expiry ? ` do ${fmtDate(e.residence_card_expiry)}` : ' (bez daty)'}`}>Karta {e.residence_card_expiry ? fmtDate(e.residence_card_expiry) : '✓'}</Pill>
        : hasPermit
          ? <Pill tone={permitTone} icon={<IdCard size={9} />} title={`Pozwolenie na pracę${e.work_permit_expiry ? ` do ${fmtDate(e.work_permit_expiry)}` : ''}`}>Pozw. {e.work_permit_expiry ? fmtDate(e.work_permit_expiry) : '✓'}</Pill>
          : <Pill tone="none" icon={<IdCard size={9} />} title="Brak karty pobytu / pozwolenia na pracę">Karta —</Pill>}
      <Pill tone={hasZus ? 'ok' : 'warn'} icon={<Landmark size={9} />} title={hasZus ? `Zgłoszony do ZUS ${fmtDate(e.zus_registration_date)}` : 'Brak zgłoszenia do ZUS'}>
        ZUS {hasZus ? '✓' : '—'}
      </Pill>
      {schDeadline && (
        <Pill tone={expiryTone(schDeadline)} icon={<Plane size={9} />} title={`Karta pobytu — 90 dni od wjazdu do Schengen (termin: ${fmtDate(schDeadline)}${daysLeft(schDeadline)! < 0 ? ', po terminie' : ''})`}>
          Schengen {fmtDate(schDeadline)}
        </Pill>
      )}
    </div>
  );
}

export function HrKontrakty({ onGoToNoclegi }: { onGoToNoclegi?: () => void }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [empByContract, setEmpByContract] = useState<Record<string, Employee[]>>({});
  const [loadingEmp, setLoadingEmp] = useState<string | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);

  const [adding, setAdding] = useState(false);
  const [editC, setEditC] = useState<Contract | null>(null);
  const [form, setForm] = useState<any>(emptyC);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addingEmp, setAddingEmp] = useState(false);
  const [empForm, setEmpForm] = useState<any>(emptyEmp);
  const [savingEmp, setSavingEmp] = useState(false);
  const [empError, setEmpError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [alertsKey, setAlertsKey] = useState(0);
  // Zwolnienie pracownika: modal z WYMAGANĄ przyczyną → Archiwum
  const [releaseFor, setReleaseFor] = useState<Employee | null>(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  const doRelease = async () => {
    if (!releaseFor) return;
    if (!releaseReason.trim()) { setReleaseError('Podaj przyczynę zwolnienia — co się stało (wymagane)'); return; }
    setReleasing(true); setReleaseError(null);
    try {
      const r = await fetch(`/api/hr/employees/${releaseFor.id}/archive`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ action: 'archive', reason: releaseReason }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Błąd zwolnienia'); }
      const cid = releaseFor.contract_id;
      setReleaseFor(null); setReleaseReason('');
      if (cid) await loadEmployees(cid);
      await load();
      setAlertsKey(k => k + 1);
    } catch (e) { setReleaseError(e instanceof Error ? e.message : 'Błąd'); } finally { setReleasing(false); }
  };
  const [canManage, setCanManage] = useState(true); // koordynator: tylko przegląd kontraktów

  const contractsLite: ContractLite[] = contracts.map(c => ({ id: c.id, name: c.name }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/hr/contracts', { credentials: 'same-origin' });
      const d = await r.json();
      setContracts(d.contracts || []);
      if (d.can_manage !== undefined) setCanManage(!!d.can_manage);
    } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadEmployees = async (contractId: string) => {
    setLoadingEmp(contractId);
    try {
      const r = await fetch(`/api/hr/employees?contractId=${contractId}`, { credentials: 'same-origin' });
      const d = await r.json();
      setEmpByContract(prev => ({ ...prev, [contractId]: d.employees || [] }));
    } catch { /* */ } finally { setLoadingEmp(null); }
  };

  const toggle = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else { n.add(id); if (!empByContract[id]) loadEmployees(id); }
      return n;
    });
  };

  const saveContract = async () => {
    if (!form.name.trim()) { setError('Nazwa kontraktu jest wymagana'); return; }
    setSaving(true); setError(null);
    try {
      const url = editC ? `/api/hr/contracts/${editC.id}` : '/api/hr/contracts';
      const r = await fetch(url, { method: editC ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(form) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Błąd'); }
      setAdding(false); setEditC(null); setForm(emptyC); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setSaving(false); }
  };

  const removeContract = async (c: Contract) => {
    if (!confirm(`Usunąć kontrakt „${c.name}"? Pracownicy zostaną (bez kontraktu).`)) return;
    await fetch(`/api/hr/contracts/${c.id}`, { method: 'DELETE', credentials: 'same-origin' });
    await load();
  };

  const saveEmployee = async () => {
    if (!empForm.first_name.trim() || !empForm.last_name.trim()) { setEmpError('Imię i nazwisko są wymagane'); return; }
    setSavingEmp(true); setEmpError(null);
    try {
      const r = await fetch('/api/hr/employees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ ...empForm, contract_id: empForm.contract_id || null }),
      });
      const d = await r.json().catch(() => ({}));
      // DUPLIKAT po paszporcie → otwórz kartotekę istniejącego pracownika i rozwiń jego kontrakt
      if (r.status === 409 && d.duplicate && d.existing) {
        setAddingEmp(false);
        window.alert(d.error || 'Taki pracownik już istnieje.');
        const ex = d.existing;
        if (ex.contract_id) { setExpanded(prev => new Set(prev).add(ex.contract_id)); loadEmployees(ex.contract_id); }
        setSelected(ex);
        return;
      }
      if (!r.ok) throw new Error(d.error || 'Błąd');
      const cid = empForm.contract_id;
      setAddingEmp(false); setEmpForm(emptyEmp);
      await load();
      if (cid && expanded.has(cid)) loadEmployees(cid);
    } catch (e) { setEmpError(e instanceof Error ? e.message : 'Błąd'); } finally { setSavingEmp(false); }
  };

  const onEmpChanged = (e: Employee) => {
    setSelected(e);
    if (e.contract_id) loadEmployees(e.contract_id);
    load(); setAlertsKey(k => k + 1);
  };
  const onEmpDeleted = (id: string) => {
    setSelected(null);
    setEmpByContract(prev => {
      const n: Record<string, Employee[]> = {};
      for (const k of Object.keys(prev)) n[k] = prev[k].filter(x => x.id !== id);
      return n;
    });
    load(); setAlertsKey(k => k + 1);
  };

  const matchEmp = (e: Employee) => {
    if (statusFilter === 'active' && e.status !== 'active') return false;
    if (statusFilter === 'inactive' && e.status === 'active') return false;
    if (search.trim() && !displayName(e).toLowerCase().includes(search.toLowerCase().trim())) return false;
    return true;
  };
  const onSearch = (v: string) => {
    setSearch(v);
    if (v.trim()) { setExpanded(new Set(contracts.map(c => c.id))); contracts.forEach(c => { if (!empByContract[c.id]) loadEmployees(c.id); }); }
  };

  const groupByTeam = (emps: Employee[]) => {
    const m = new Map<string, Employee[]>();
    for (const e of emps) { const t = e.team || 'Bez grupy'; if (!m.has(t)) m.set(t, []); m.get(t)!.push(e); }
    return [...m.entries()].sort((a, z) => a[0].localeCompare(z[0], 'pl'));
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-lg font-bold text-slate-900">Kontrakty / obiekty</h2>
          <p className="text-sm text-slate-500">Pracodawcy, u których pracują nasi pracownicy — rozwiń, aby zobaczyć grupy i ludzi</p>
        </div>
        <div className="flex gap-2">
          {canManage && <button onClick={() => { setAddingEmp(a => !a); setEmpForm(emptyEmp); setEmpError(null); }} className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100"><UserPlus size={16} /> Dodaj pracownika</button>}
          {canManage && <Hint text="Dodaje pracownika BEZPOŚREDNIO na kontrakt (z pominięciem Poczekalni) — dla admina/szefa. Koordynatorzy zgłaszają kandydatów w Poczekalni." className="self-center" />}
          {canManage && <button onClick={() => { setAdding(a => !a); setEditC(null); setForm(emptyC); setError(null); }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"><Plus size={16} /> Dodaj kontrakt</button>}
          {canManage && <Hint text="Tworzy nowy kontrakt/projekt (obiekt klienta). Do kontraktu przypina się pracowników, noclegi i dokumenty." className="self-center" />}
        </div>
      </div>

      <HrPermitAlerts onOpen={setSelected} onOpenAccommodation={onGoToNoclegi} refreshKey={alertsKey} />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Szukaj pracownika…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="all">Wszyscy</option>
          <option value="active">Aktywni</option>
          <option value="inactive">Nieaktywni</option>
        </select>
      </div>

      {(adding || editC) && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 font-semibold text-slate-800">{editC ? 'Edycja kontraktu' : 'Nowy kontrakt'}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nazwa obiektu *" hint="Nazwa kontraktu/projektu (np. Magazyn SHEIN) — grupuje pracowników w drzewie i noclegi w bazie. Wymagane."><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={INPUT} placeholder="np. Magazyn SHEIN" /></Field>
            <Field label="Pracodawca / klient" hint="Firma-klient, u której pracują nasi ludzie na tym obiekcie."><input value={form.employer} onChange={e => setForm({ ...form, employer: e.target.value })} className={INPUT} /></Field>
            <Field label="Adres" hint="Adres magazynu/obiektu — z niego liczona jest odległość i czas dojazdu z noclegów."><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={INPUT} /></Field>
            <Field label="Osoba kontaktowa" hint="Osoba do kontaktu po stronie klienta na tym obiekcie."><input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} className={INPUT} /></Field>
            <Field label="Telefon" hint="Telefon kontaktowy (kontrakt: do klienta; pracownik: numer osobisty)."><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={INPUT} /></Field>
            <Field label="Status" hint="Aktywny/nieaktywny — nieaktywne kontrakty zostają na liście, ale oznaczone."><input value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={INPUT} /></Field>
            <div className="sm:col-span-2"><Field label="Notatki" hint="Wewnętrzne uwagi — niewidoczne poza tym panelem."><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={INPUT + ' resize-y'} /></Field></div>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setAdding(false); setEditC(null); setForm(emptyC); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Anuluj</button>
            <button onClick={saveContract} disabled={saving} className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Zapisz</button>
          </div>
        </div>
      )}

      {addingEmp && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 font-semibold text-slate-800">Nowy pracownik</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Imię *" hint="Pierwsze imię nowego pracownika. Wymagane."><input value={empForm.first_name} onChange={e => setEmpForm({ ...empForm, first_name: e.target.value })} className={INPUT} /></Field>
            <Field label="Nazwisko *" hint="Pierwsze nazwisko nowego pracownika. Wymagane. Resztę danych uzupełnisz w karcie lub przez OCR."><input value={empForm.last_name} onChange={e => setEmpForm({ ...empForm, last_name: e.target.value })} className={INPUT} /></Field>
            <Field label="Kontrakt / obiekt" hint="Od razu przypisuje pracownika do kontraktu; bez wyboru trafi do nieprzypisanych.">
              <select value={empForm.contract_id} onChange={e => setEmpForm({ ...empForm, contract_id: e.target.value })} className={INPUT}>
                <option value="">— bez kontraktu —</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Grupa" hint="Zespół w ramach kontraktu (np. Grupa A)."><input value={empForm.team} onChange={e => setEmpForm({ ...empForm, team: e.target.value })} className={INPUT} placeholder="np. Grupa A" /></Field>
            <Field label="Kraj pochodzenia" hint="Kraj pracownika (np. Kolumbia) — ustawia też domyślny język dokumentów."><input value={empForm.country_of_origin} onChange={e => setEmpForm({ ...empForm, country_of_origin: e.target.value })} className={INPUT} /></Field>
            <Field label="Status" hint="Aktywny/nieaktywny — nieaktywne kontrakty zostają na liście, ale oznaczone.">
              <select value={empForm.status} onChange={e => setEmpForm({ ...empForm, status: e.target.value })} className={INPUT}>
                <option value="active">Aktywny</option>
                <option value="inactive">Nieaktywny</option>
              </select>
            </Field>
            <Field label="Telefon" hint="Telefon kontaktowy (kontrakt: do klienta; pracownik: numer osobisty)."><input value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} className={INPUT} /></Field>
            <Field label="E-mail" hint="Adres e-mail (opcjonalny)."><input value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} className={INPUT} /></Field>
            <div className="sm:col-span-2"><Field label="Nr konta bankowego" hint="IBAN do wypłat — wstawia się automatycznie do oświadczenia wykonawcy."><input value={empForm.bank_account} onChange={e => setEmpForm({ ...empForm, bank_account: e.target.value })} className={INPUT} /></Field></div>
          </div>
          {empError && <p className="mt-1 text-xs text-red-600">{empError}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setAddingEmp(false); setEmpForm(emptyEmp); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Anuluj</button>
            <button onClick={saveEmployee} disabled={savingEmp} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{savingEmp ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Zapisz</button>
          </div>
        </div>
      )}

      {/* Drzewo */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-10 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>
        ) : contracts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm italic text-slate-300">Brak kontraktów — kliknij „Dodaj kontrakt"</p>
        ) : contracts.map(c => {
          const open = expanded.has(c.id);
          const emps = empByContract[c.id] || [];
          return (
            <div key={c.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => toggle(c.id)} className="flex flex-1 items-center gap-3 text-left">
                  {open ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Building2 size={18} /></div>
                  <div className="min-w-0">
                    <p className="font-sans font-bold text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.employer || '—'}</p>
                    <div className="mt-1"><StatusCountBadges counts={c.status_counts} /></div>
                  </div>
                </button>
                <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"><Users size={13} /> {c.employee_count}</span>
                {canManage && <button onClick={() => { setEditC(c); setAdding(false); setForm({ ...emptyC, ...c }); setError(null); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600" title="Edytuj"><Pencil size={15} /></button>}
                {canManage && <button onClick={() => removeContract(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Usuń"><Trash2 size={15} /></button>}
              </div>

              {open && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                  {loadingEmp === c.id && !emps.length ? (
                    <div className="flex items-center gap-2 py-3 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> Ładowanie…</div>
                  ) : emps.length === 0 ? (
                    <p className="py-3 text-sm italic text-slate-300">Brak pracowników w tym kontrakcie</p>
                  ) : emps.filter(matchEmp).length === 0 ? (
                    <p className="py-3 text-sm italic text-slate-300">Brak pasujących pracowników</p>
                  ) : groupByTeam(emps.filter(matchEmp)).map(([team, members]) => (
                    <div key={team} className="mb-2 last:mb-0">
                      <p className="mb-1 pl-7 text-[11px] font-bold uppercase tracking-wide text-primary-500">{team} <span className="text-slate-300">({members.length})</span></p>
                      <div className="space-y-1">
                        {members.map(e => (
                          <div key={e.id} className="group flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg py-1.5 pl-10 pr-3 text-sm hover:bg-white">
                            <button onClick={() => setSelected(e)} className="flex min-w-0 items-center gap-2 text-left">
                              <User size={14} className="shrink-0 text-slate-400" />
                              <span title={workStatusDef(e.work_status).label} className={`h-2 w-2 shrink-0 rounded-full ${workStatusDef(e.work_status).dot}`} />
                              <span className="truncate font-medium text-slate-700">{displayName(e)}</span>
                              {((e as any).hr_documents?.[0]?.count ?? 0) > 0 && (
                                <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500" title={`Dokumenty w teczce: ${(e as any).hr_documents[0].count}`}>
                                  <FileText size={9} /> {(e as any).hr_documents[0].count}
                                </span>
                              )}
                            </button>
                            {/* Statusy dokumentów — widoczne od razu na liście */}
                            <EmpStatusBadges e={e} />
                            <div className="ml-auto flex shrink-0 items-center gap-1.5">
                              {e.country_of_origin && <span className="text-xs text-slate-400">{e.country_of_origin}</span>}
                              <button onClick={() => { setReleaseFor(e); setReleaseReason(''); setReleaseError(null); }} className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"><UserMinus size={11} /> Zwolnij</button>
                              <Hint text="Zwalnia pracownika z kontraktu — trafia do Archiwum z całą historią. WYMAGANE podanie przyczyny (co się stało); zapisuje się w Archiwum i Rejestrze zdarzeń." />
                              <button onClick={() => setSelected(e)} title="Szczegóły pracownika"><ChevronRight size={14} className="text-slate-300" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal zwolnienia — przyczyna wymagana */}
      {releaseFor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setReleaseFor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-1 font-sans font-bold text-slate-900">Zwolnij pracownika — {displayName(releaseFor)}</h3>
            <p className="mb-3 text-sm text-slate-500">Pracownik trafi do Archiwum z całą historią (dokumenty, rozliczenia, grafik). Można go później przywrócić.</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Przyczyna zwolnienia *</p>
            <textarea value={releaseReason} onChange={e => setReleaseReason(e.target.value)} rows={3} autoFocus
              placeholder="np. koniec kontraktu / rezygnacja / porzucenie pracy — opisz co się stało"
              className="mt-1 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
            {releaseError && <p className="mt-2 text-xs font-semibold text-red-600">{releaseError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setReleaseFor(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Anuluj</button>
              <button onClick={doRelease} disabled={releasing} className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                {releasing ? <Loader2 size={15} className="animate-spin" /> : <UserMinus size={15} />} Zwolnij (do Archiwum)
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <HrEmployeePanel employee={selected} contracts={contractsLite} onClose={() => setSelected(null)} onChanged={onEmpChanged} onDeleted={onEmpDeleted} />
      )}
    </div>
  );
}
