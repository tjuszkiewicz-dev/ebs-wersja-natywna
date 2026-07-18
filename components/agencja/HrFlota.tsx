'use client';

// Flota Agencji Pracy (wzorce: LubeLogger, Fleetbase FleetOps) — pojazdy dowożące
// pracowników: rejestr, terminy OC/przeglądu z alertami, kierowca, przebieg,
// koszty (paliwo/serwis/ubezpieczenie) księgowane AUTOMATYCZNIE w bilansie Księgowości.
import React, { useState, useEffect, useCallback } from 'react';
import { Car, Plus, Pencil, Trash2, Save, Loader2, AlertTriangle, Wallet, Gauge, User, Building2, X, CalendarClock, ShieldCheck, Wrench, Camera, Upload, ImageOff, IdCard, Sparkles, ExternalLink } from 'lucide-react';
import { Hint } from '@/components/ui/Hint';
import { expiryStatus, fmtDate } from './expiry';

interface Vehicle {
  id: string; make: string; model?: string | null; registration?: string | null; vin?: string | null;
  year?: number | null; mileage?: number | null; status: string; driver_name?: string | null;
  contract_id?: string | null; contract?: { id: string; name: string } | null;
  insurance_until?: string | null; inspection_until?: string | null; seats?: number | null; notes?: string | null;
  main_user_kind?: string | null; main_user_id?: string | null; main_user_name?: string | null;
  license_name?: string | null; license_number?: string | null; license_categories?: string | null;
  license_expiry?: string | null; license_photo_path?: string | null;
  costs_total?: number;
}
interface VehicleCost { id: string; cost_date: string; kind: string; amount: number; mileage?: number | null; note?: string | null }
interface VehiclePhoto { id: string; url: string | null; filename?: string | null; caption?: string | null; created_at: string; mine?: boolean }
interface Person { id: string; name: string; role?: string }

const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400';
const STATUSES: [string, string][] = [['aktywny', 'Aktywny'], ['serwis', 'W serwisie'], ['wycofany', 'Wycofany']];
const COST_KINDS: [string, string][] = [['paliwo', 'Paliwo'], ['serwis', 'Serwis/naprawa'], ['ubezpieczenie', 'Ubezpieczenie'], ['oplaty', 'Opłaty'], ['inne', 'Inne']];
const kindLabel = (k: string) => COST_KINDS.find(([v]) => v === k)?.[1] ?? k;
const zl = (n?: number | null) => (n == null ? '—' : Number(n).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł');
const tone = (days: number) => days <= 3 ? 'bg-red-100 text-red-700' : days <= 30 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700';
const statusTone: Record<string, string> = { aktywny: 'bg-emerald-50 text-emerald-700', serwis: 'bg-amber-50 text-amber-700', wycofany: 'bg-slate-100 text-slate-500' };

const empty = { make: '', model: '', registration: '', vin: '', year: '', mileage: '', status: 'aktywny', driver_name: '', contract_id: '', insurance_until: '', inspection_until: '', seats: '', notes: '', main_user_kind: '', main_user_id: '', main_user_name: '', license_name: '', license_number: '', license_categories: '', license_expiry: '' };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><p className={LABEL + ' flex items-center gap-1'}>{label}{hint && <Hint text={hint} />}</p><div className="mt-1">{children}</div></div>;
}

// ── modal kosztów pojazdu (poziom modułu — focus inputów) ──
function VehicleCostsModal({ vehicle, onClose, onChanged }: { vehicle: Vehicle; onClose: () => void; onChanged: () => void }) {
  const [costs, setCosts] = useState<VehicleCost[]>([]);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ kind: 'paliwo', amount: '', cost_date: new Date().toISOString().slice(0, 10), mileage: '', note: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/hr/vehicles/${vehicle.id}/costs`, { credentials: 'same-origin' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Błąd');
      setCosts(j.costs || []);
      setCanDelete(!!j.can_delete);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Błąd'); } finally { setLoading(false); }
  }, [vehicle.id]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.amount || saving) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/hr/vehicles/${vehicle.id}/costs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(form),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Błąd zapisu');
      setForm(f => ({ ...f, amount: '', note: '' }));
      await load(); onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Błąd'); } finally { setSaving(false); }
  };

  const remove = async (c: VehicleCost) => {
    if (!confirm(`Usunąć koszt ${zl(c.amount)} (${kindLabel(c.kind)})? Zniknie też wpis w bilansie Księgowości.`)) return;
    const r = await fetch(`/api/hr/vehicles/${vehicle.id}/costs?cost_id=${c.id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.error || 'Nie udało się usunąć'); return; }
    setCosts(cs => cs.filter(x => x.id !== c.id)); onChanged();
  };

  const total = costs.reduce((a, c) => a + Number(c.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <Wallet size={18} className="text-primary-600" />
          <div className="min-w-0 flex-1">
            <p className="font-sans font-bold text-slate-900">Koszty — {vehicle.make} {vehicle.model} {vehicle.registration && `(${vehicle.registration})`}</p>
            <p className="text-xs text-slate-500">Razem: {zl(total)} · każdy koszt trafia automatycznie do bilansu Księgowości</p>
          </div>
          <Hint text="Paliwo, serwis, ubezpieczenie, opłaty — wpis tworzy się jednocześnie tutaj i w bilansie Księgowości (kategorie flota_*). Podany przebieg aktualizuje licznik pojazdu, jeśli jest wyższy od obecnego." />
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-slate-100 px-5 py-3 sm:grid-cols-5">
          <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))} className={INPUT}>
            {COST_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="number" min="0" step="0.01" placeholder="Kwota zł" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={INPUT} />
          <input type="date" value={form.cost_date} onChange={e => setForm(f => ({ ...f, cost_date: e.target.value }))} className={INPUT} />
          <input type="number" min="0" placeholder="Przebieg km" value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))} className={INPUT} />
          <button onClick={add} disabled={saving || !form.amount} className="flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Dodaj
          </button>
          <input placeholder="Notatka (np. Orlen trasa Kielce, wymiana opon)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className={INPUT + ' col-span-2 sm:col-span-5'} />
        </div>
        {err && <p className="px-5 pt-2 text-sm text-red-600">{err}</p>}

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-8 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>
          ) : costs.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-slate-300">Brak kosztów — dodaj pierwsze tankowanie albo serwis</p>
          ) : (
            <div className="space-y-1.5">
              {costs.map(c => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{kindLabel(c.kind)}</span>
                  <span className="font-medium text-slate-800">{zl(c.amount)}</span>
                  <span className="text-slate-400">{fmtDate(c.cost_date)}</span>
                  {c.mileage != null && <span className="flex items-center gap-1 text-xs text-slate-400"><Gauge size={12} /> {Number(c.mileage).toLocaleString('pl-PL')} km</span>}
                  {c.note && <span className="min-w-0 flex-1 truncate text-slate-500" title={c.note}>{c.note}</span>}
                  {canDelete && <button onClick={() => remove(c)} className="ml-auto rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-600" title="Usuń (razem z wpisem w bilansie)"><Trash2 size={13} /></button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── galeria zdjęć stanu pojazdu (dokumentacja przed wydaniem) — poziom modułu (focus!) ──
function VehiclePhotosModal({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const [photos, setPhotos] = useState<VehiclePhoto[]>([]);
  const [canDeleteAll, setCanDeleteAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/hr/vehicles/${vehicle.id}/photos`, { credentials: 'same-origin' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Błąd');
      setPhotos(j.photos || []);
      setCanDeleteAll(!!j.can_delete_all);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Błąd'); } finally { setLoading(false); }
  }, [vehicle.id]);
  useEffect(() => { load(); }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true); setErr(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        if (caption.trim()) fd.append('caption', caption.trim());
        const r = await fetch(`/api/hr/vehicles/${vehicle.id}/photos`, { method: 'POST', body: fd, credentials: 'same-origin' });
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `Błąd wgrywania ${file.name}`); }
      }
      setCaption('');
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Błąd wgrywania'); } finally { setUploading(false); }
  };

  const removePhoto = async (p: VehiclePhoto) => {
    if (!confirm(`Usunąć zdjęcie${p.caption ? ` „${p.caption}"` : ''}? Tego nie da się cofnąć.`)) return;
    const r = await fetch(`/api/hr/vehicles/${vehicle.id}/photos?photo_id=${p.id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.error || 'Nie udało się usunąć'); return; }
    setPhotos(ph => ph.filter(x => x.id !== p.id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <Camera size={18} className="text-primary-600" />
          <div className="min-w-0 flex-1">
            <p className="font-sans font-bold text-slate-900">Zdjęcia stanu — {vehicle.make} {vehicle.model} {vehicle.registration && `(${vehicle.registration})`}</p>
            <p className="text-xs text-slate-500">Dokumentuj stan pojazdu przy każdym wydaniu do dyspozycji — zdjęcia mają datę dodania</p>
          </div>
          <Hint text="Przed wydaniem auta obfotografuj karoserię, wnętrze i licznik, wgraj z opisem np. wydanie 07.2026 — Jan Adamski. Przy zwrocie zrób kolejną serię — przy szkodzie masz porównanie z datami." />
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Opis serii, np. wydanie 07.2026 — Jan Adamski" className={INPUT + ' max-w-xs flex-1'} />
          <label className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white ${uploading ? 'bg-slate-300' : 'bg-primary-600 hover:bg-primary-700'}`}>
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {uploading ? 'Wgrywanie…' : 'Dodaj zdjęcia'}
            <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={e => { upload(e.target.files); e.target.value = ''; }} />
          </label>
        </div>
        {err && <p className="px-5 pt-2 text-sm text-red-600">{err}</p>}

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-10 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-300">
              <ImageOff size={28} />
              <p className="text-sm italic">Brak zdjęć — dodaj dokumentację stanu pojazdu</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map(p => (
                <div key={p.id} className="group relative overflow-hidden rounded-xl border border-slate-200">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" title="Otwórz w pełnym rozmiarze">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.caption || p.filename || 'zdjęcie pojazdu'} className="h-36 w-full object-cover transition group-hover:scale-105" />
                    </a>
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-slate-50 text-slate-300"><ImageOff size={22} /></div>
                  )}
                  {(p.mine || canDeleteAll) && (
                    <button onClick={() => removePhoto(p)} title="Usuń zdjęcie" className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1.5 text-slate-500 opacity-0 shadow transition hover:text-red-600 group-hover:opacity-100"><Trash2 size={13} /></button>
                  )}
                  <div className="px-2 py-1.5">
                    {p.caption && <p className="truncate text-xs font-medium text-slate-700" title={p.caption}>{p.caption}</p>}
                    <p className="text-[11px] text-slate-400">{fmtDate(p.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function HrFlota() {
  const [list, setList] = useState<Vehicle[]>([]);
  const [contracts, setContracts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costsFor, setCostsFor] = useState<Vehicle | null>(null);
  const [photosFor, setPhotosFor] = useState<Vehicle | null>(null);
  const [people, setPeople] = useState<{ users: Person[]; employees: Person[] }>({ users: [], employees: [] });
  const [licBusy, setLicBusy] = useState(false);
  const [licUrl, setLicUrl] = useState<string | null>(null);
  const [licOcrPending, setLicOcrPending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rv, rc, rp] = await Promise.all([
        fetch('/api/hr/vehicles', { credentials: 'same-origin' }),
        fetch('/api/hr/contracts?names=1', { credentials: 'same-origin' }),
        fetch('/api/hr/vehicles/people', { credentials: 'same-origin' }),
      ]);
      if (rv.ok) setList(await rv.json());
      if (rc.ok) { const c = await rc.json(); setContracts((c.contracts || []).map((x: any) => ({ id: x.id, name: x.name }))); }
      if (rp.ok) { const p = await rp.json(); setPeople({ users: p.users || [], employees: p.employees || [] }); }
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setAdding(true); setEditId(null); setForm(empty); setError(null); };
  const openEdit = (v: Vehicle) => {
    setEditId(v.id); setAdding(false);
    setForm({
      ...empty, ...v, year: v.year ?? '', mileage: v.mileage ?? '', seats: v.seats ?? '', contract_id: v.contract_id ?? '',
      insurance_until: v.insurance_until ?? '', inspection_until: v.inspection_until ?? '',
      main_user_kind: v.main_user_kind ?? '', main_user_id: v.main_user_id ?? '', main_user_name: v.main_user_name ?? '',
      license_name: v.license_name ?? '', license_number: v.license_number ?? '', license_categories: v.license_categories ?? '', license_expiry: v.license_expiry ?? '',
    });
    setError(null);
    setLicUrl(null);
    setLicOcrPending(false);
    if (v.license_photo_path) {
      fetch(`/api/hr/vehicles/${v.id}/license`, { credentials: 'same-origin' })
        .then(r => (r.ok ? r.json() : null)).then(d => { if (d?.url) setLicUrl(d.url); }).catch(() => {});
    }
  };
  const close = () => { setAdding(false); setEditId(null); setForm(empty); setError(null); setLicOcrPending(false); };

  const save = async () => {
    if (!form.make.trim()) { setError('Marka jest wymagana'); return; }
    setSaving(true); setError(null);
    try {
      const url = editId ? `/api/hr/vehicles/${editId}` : '/api/hr/vehicles';
      const r = await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(form) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Błąd'); }
      close(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setSaving(false); }
  };

  const remove = async (v: Vehicle) => {
    if (!confirm(`Usunąć pojazd ${v.make} ${v.registration ?? ''}? Historia kosztów zniknie z Floty (wpisy w bilansie zostają).`)) return;
    const r = await fetch(`/api/hr/vehicles/${v.id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!r.ok) { const j = await r.json().catch(() => ({})); alert(j.error || 'Nie udało się usunąć'); return; }
    await load();
  };

  // zdjęcie prawa jazdy → upload zawsze działa; odczyt AI odłożony do E2d
  // (POST /api/hr/vehicles/[id]/license zwraca teraz { ok: true, ocr: null } —
  // gdy w przyszłości (E2d) zwróci wypełniony obiekt ocr, pola formularza uzupełnią się automatycznie;
  // do tego czasu pokazujemy informację zamiast cichego "nic się nie stało").
  const uploadLicense = async (file: File | null) => {
    if (!file || !editId || licBusy) return;
    setLicBusy(true); setError(null); setLicOcrPending(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/api/hr/vehicles/${editId}/license`, { method: 'POST', body: fd, credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Błąd odczytu prawa jazdy');
      if (j.ocr) {
        setForm((f: any) => ({
          ...f,
          license_name: j.ocr.license_name ?? f.license_name,
          license_number: j.ocr.license_number ?? f.license_number,
          license_categories: j.ocr.license_categories ?? f.license_categories,
          license_expiry: j.ocr.license_expiry ?? f.license_expiry,
        }));
      } else {
        setLicOcrPending(true); // zdjęcie zapisane, odczyt AI wkrótce (E2d)
      }
      // API nie zwraca już `url` w odpowiedzi POST — pobierz aktualny podpisany link osobno
      const rl = await fetch(`/api/hr/vehicles/${editId}/license`, { credentials: 'same-origin' });
      if (rl.ok) { const dl = await rl.json().catch(() => null); setLicUrl(dl?.url ?? null); }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setLicBusy(false); }
  };

  // wybór głównego użytkownika: user:{id} / employee:{id} / ''
  const setMainUser = (val: string) => {
    if (!val) { setForm({ ...form, main_user_kind: '', main_user_id: '', main_user_name: '', driver_name: '' }); return; }
    const [kind, pid] = val.split(':');
    const person = (kind === 'user' ? people.users : people.employees).find(p => p.id === pid);
    setForm({ ...form, main_user_kind: kind, main_user_id: pid, main_user_name: person?.name ?? '', driver_name: person?.name ?? '' });
  };

  // alerty terminów: OC lub przegląd kończy się w ≤30 dni (albo już po terminie)
  const alerts = list.flatMap(v => ([
    { v, what: 'ubezpieczenie OC', st: expiryStatus(v.insurance_until) },
    { v, what: 'przegląd techniczny', st: expiryStatus(v.inspection_until) },
  ])).filter(x => x.st && x.st.days <= 30).sort((a, b) => a.st!.days - b.st!.days);

  const fleetTotal = list.reduce((a, v) => a + (v.costs_total || 0), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-slate-900"><Car size={20} className="text-primary-600" /> Flota</h2>
          <p className="text-sm text-slate-500">Pojazdy agencji — terminy OC i przeglądów, kierowcy, przebiegi, koszty spięte z Księgowością{fleetTotal > 0 ? ` · koszty razem: ${zl(fleetTotal)}` : ''}</p>
        </div>
        <span className="flex items-center gap-1.5">
          <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"><Plus size={16} /> Dodaj pojazd</button>
          <Hint text="Rejestr pojazdów dowożących pracowników: przy 30 dniach do końca OC lub przeglądu pojawia się alert. Koszty pojazdu (paliwo, serwis) księgują się automatycznie w bilansie Księgowości — kategorie flota_*." />
        </span>
      </div>

      {alerts.length > 0 && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="mb-1 flex items-center gap-2 text-red-700">
            <AlertTriangle size={18} />
            <p className="font-semibold">Kończące się terminy ({alerts.length})</p>
          </div>
          <div className="space-y-1.5">
            {alerts.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-3 py-1.5 text-sm">
                <span className="font-medium text-slate-700">{a.v.make} {a.v.model} {a.v.registration && `(${a.v.registration})`}</span>
                <span className="text-slate-400">· {a.what} do {fmtDate(a.what === 'ubezpieczenie OC' ? a.v.insurance_until : a.v.inspection_until)}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(a.st!.days)}`}>{a.st!.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(adding || editId) && (
        <div className="mb-5 rounded-2xl border border-primary-100 bg-primary-50/40 p-4">
          <p className="mb-3 font-sans text-sm font-bold text-slate-900">{editId ? 'Edytuj pojazd' : 'Nowy pojazd'}</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Marka *"><input value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} className={INPUT} placeholder="np. Ford" /></Field>
            <Field label="Model"><input value={form.model ?? ''} onChange={e => setForm({ ...form, model: e.target.value })} className={INPUT} placeholder="np. Transit" /></Field>
            <Field label="Nr rejestracyjny"><input value={form.registration ?? ''} onChange={e => setForm({ ...form, registration: e.target.value })} className={INPUT} placeholder="np. TK 12345" /></Field>
            <Field label="VIN"><input value={form.vin ?? ''} onChange={e => setForm({ ...form, vin: e.target.value })} className={INPUT} /></Field>
            <Field label="Rok"><input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} className={INPUT} /></Field>
            <Field label="Przebieg (km)"><input type="number" value={form.mileage} onChange={e => setForm({ ...form, mileage: e.target.value })} className={INPUT} /></Field>
            <Field label="Liczba miejsc" hint="Ile osób wozi — przydatne przy planowaniu dowozu pracowników na projekt."><input type="number" value={form.seats} onChange={e => setForm({ ...form, seats: e.target.value })} className={INPUT} /></Field>
            <Field label="Status">
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={INPUT}>
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Główny użytkownik" hint="Osoba odpowiedzialna za pojazd — dowolna rola: koordynator, szef koordynatorów, dyrektor, admin albo pracownik z kartoteki agencji.">
              <select value={form.main_user_kind && form.main_user_id ? `${form.main_user_kind}:${form.main_user_id}` : ''} onChange={e => setMainUser(e.target.value)} className={INPUT}>
                <option value="">— brak —</option>
                <optgroup label="Użytkownicy systemu (role)">
                  {people.users.map(u => <option key={u.id} value={`user:${u.id}`}>{u.name} — {u.role}</option>)}
                </optgroup>
                <optgroup label="Pracownicy (kartoteka)">
                  {people.employees.map(e2 => <option key={e2.id} value={`employee:${e2.id}`}>{e2.name}</option>)}
                </optgroup>
              </select>
            </Field>
            <Field label="Projekt (dowóz)">
              <select value={form.contract_id} onChange={e => setForm({ ...form, contract_id: e.target.value })} className={INPUT}>
                <option value="">— brak —</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Ubezpieczenie OC do" hint="Przy 30 dniach do końca pojawia się alert na górze Floty."><input type="date" value={form.insurance_until ?? ''} onChange={e => setForm({ ...form, insurance_until: e.target.value })} className={INPUT} /></Field>
            <Field label="Przegląd techniczny do" hint="Przy 30 dniach do końca pojawia się alert na górze Floty."><input type="date" value={form.inspection_until ?? ''} onChange={e => setForm({ ...form, inspection_until: e.target.value })} className={INPUT} /></Field>
            <div className="col-span-2 md:col-span-4"><Field label="Notatki"><input value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} className={INPUT} placeholder="np. opony zimowe w bagażniku, hak" /></Field></div>

            {/* prawo jazdy głównego użytkownika — zdjęcie + odczyt AI */}
            <div className="col-span-2 md:col-span-4 rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><IdCard size={14} /> Prawo jazdy głównego użytkownika</p>
                <Hint text="Wgraj zdjęcie prawa jazdy — AI odczyta imię i nazwisko, numer, kategorie i datę ważności i uzupełni pola poniżej (możesz je poprawić ręcznie przed zapisem). Zdjęcie trzymane jest w prywatnym magazynie." />
                {editId ? (
                  <label className={`ml-auto flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${licBusy ? 'bg-slate-300' : 'bg-primary-600 hover:bg-primary-700'}`}>
                    {licBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {licBusy ? 'Odczytuję…' : 'Zdjęcie + odczyt AI'}
                    <input type="file" accept="image/*" className="hidden" disabled={licBusy} onChange={e => { uploadLicense(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                  </label>
                ) : (
                  <span className="ml-auto text-xs italic text-slate-400">najpierw zapisz pojazd, potem wgraj prawo jazdy</span>
                )}
                {licUrl && <a href={licUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50"><ExternalLink size={12} /> Zobacz zdjęcie</a>}
              </div>
              {licOcrPending && (
                <p className="mb-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                  Zdjęcie zapisane — odczyt AI wkrótce (E2d). Uzupełnij dane poniżej ręcznie.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Field label="Imię i nazwisko (z dokumentu)"><input value={form.license_name ?? ''} onChange={e => setForm({ ...form, license_name: e.target.value })} className={INPUT} /></Field>
                <Field label="Numer prawa jazdy"><input value={form.license_number ?? ''} onChange={e => setForm({ ...form, license_number: e.target.value })} className={INPUT} /></Field>
                <Field label="Kategorie"><input value={form.license_categories ?? ''} onChange={e => setForm({ ...form, license_categories: e.target.value })} className={INPUT} placeholder="np. B, B+E" /></Field>
                <Field label="Ważne do"><input type="date" value={form.license_expiry ?? ''} onChange={e => setForm({ ...form, license_expiry: e.target.value })} className={INPUT} /></Field>
              </div>
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-slate-200">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Zapisz
            </button>
            <button onClick={close} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Anuluj</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm italic text-slate-300">Brak pojazdów — kliknij „Dodaj pojazd"</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {list.map(v => {
            const ins = expiryStatus(v.insurance_until);
            const insp = expiryStatus(v.inspection_until);
            return (
              <div key={v.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Car size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-sans font-bold text-slate-900">{v.make} {v.model}{v.year ? ` (${v.year})` : ''}</p>
                      {v.registration && <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-xs font-bold tracking-wide text-slate-700">{v.registration}</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone[v.status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUSES.find(([s]) => s === v.status)?.[1] ?? v.status}</span>
                      {v.contract && <span className="flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700"><Building2 size={11} /> {v.contract.name}</span>}
                    </div>
                    {v.notes && <p className="mt-0.5 text-sm text-slate-500">{v.notes}</p>}
                  </div>
                  <button onClick={() => setPhotosFor(v)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600" title="Zdjęcia stanu pojazdu"><Camera size={15} /></button>
                  <button onClick={() => setCostsFor(v)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600" title="Koszty pojazdu"><Wallet size={15} /></button>
                  <button onClick={() => openEdit(v)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600" title="Edytuj"><Pencil size={15} /></button>
                  <button onClick={() => remove(v)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Usuń"><Trash2 size={15} /></button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
                  {(v.main_user_name || v.driver_name) && (
                    <span className="flex items-center gap-1.5" title="Główny użytkownik">
                      <User size={14} className="text-slate-400" /> {v.main_user_name || v.driver_name}
                      {v.main_user_kind && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{v.main_user_kind === 'employee' ? 'pracownik' : 'użytkownik'}</span>}
                    </span>
                  )}
                  {v.mileage != null && <span className="flex items-center gap-1.5"><Gauge size={14} className="text-slate-400" /> {Number(v.mileage).toLocaleString('pl-PL')} km</span>}
                  {v.seats != null && <span className="text-slate-500">{v.seats} miejsc</span>}
                  {(v.costs_total || 0) > 0 && <span className="flex items-center gap-1.5"><Wallet size={14} className="text-slate-400" /> koszty: <span className="font-medium text-slate-800">{zl(v.costs_total)}</span></span>}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="flex items-center gap-1.5 text-slate-500"><ShieldCheck size={14} /> OC do {fmtDate(v.insurance_until) || '—'}
                    {ins && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(ins.days)}`}>{ins.label}</span>}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-500"><Wrench size={14} /> przegląd do {fmtDate(v.inspection_until) || '—'}
                    {insp && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(insp.days)}`}>{insp.label}</span>}
                  </span>
                  {(v.license_number || v.license_categories) && (() => { const le = expiryStatus(v.license_expiry); return (
                    <span className="flex items-center gap-1.5 text-slate-500" title={`Prawo jazdy${v.license_name ? ` — ${v.license_name}` : ''}`}>
                      <IdCard size={14} /> {v.license_categories || 'prawo jazdy'}{v.license_expiry ? ` do ${fmtDate(v.license_expiry)}` : ''}
                      {le && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(le.days)}`}>{le.label}</span>}
                    </span>
                  ); })()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {costsFor && <VehicleCostsModal vehicle={costsFor} onClose={() => setCostsFor(null)} onChanged={load} />}
      {photosFor && <VehiclePhotosModal vehicle={photosFor} onClose={() => setPhotosFor(null)} />}
    </div>
  );
}
