'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BedDouble, Plus, Pencil, Trash2, Save, Loader2, MapPin, Copy, Check, ExternalLink, Users, Phone, CalendarClock, AlertTriangle, Search, Route, Building2, X, Camera, Upload, ImageOff, ChevronDown, ChevronUp, ArrowRightLeft } from 'lucide-react';
import { expiryStatus, fmtDate } from './expiry';
import { Hint } from '@/components/ui/Hint';
import { WORK_STATUSES, type WorkStatusId } from '@/lib/hr/workStatus';
import { displayName } from '@/lib/hr/docPlaceholders';

interface Contact { name: string; phone: string; role: string }
interface Tenant {
  id: string; first_name?: string | null; second_name?: string | null;
  last_name?: string | null; second_last_name?: string | null; accommodation_id?: string | null;
}
interface Accommodation {
  id: string; name: string; type?: string | null; address?: string | null; capacity?: number | null;
  street?: string | null; house_no?: string | null; apartment_no?: string | null; postal_code?: string | null; city?: string | null;
  voivodeship?: string | null; county?: string | null; commune?: string | null; post_office?: string | null;
  description?: string | null; phone?: string | null; contact_person?: string | null; notes?: string | null;
  available_from?: string | null; lease_end_date?: string | null; monthly_rent?: number | null; deposit?: number | null; deposit_returned?: boolean;
  rented_spots?: number | null; price_per_person?: number | null; vat_rate?: number | null; media_included?: boolean;
  contacts?: Contact[] | null; contract_id?: string | null; contract?: { id: string; name: string; address?: string | null } | null;
  distance_km?: number | null; drive_min?: number | null;
  assigned_count: number;
  status_counts?: Partial<Record<WorkStatusId, number>>;
}

// Plakietki z licznikami statusów pracy na karcie lokalu — pomija statusy z zerem, degraduje się cicho przy braku danych
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
const emptyContact: Contact = { name: '', phone: '', role: '' };
const empty = {
  name: '', type: 'pensjonat', address: '', street: '', house_no: '', apartment_no: '', postal_code: '', city: '',
  voivodeship: '', county: '', commune: '', post_office: '', capacity: '', rented_spots: '', description: '', notes: '',
  available_from: '', lease_end_date: '', deposit: '', deposit_returned: false,
  price_per_person: '', vat_rate: '23', media_included: false, monthly_rent: '',
  contract_id: '', contacts: [{ ...emptyContact }] as Contact[],
};
const zl = (n?: number | null) => (n == null ? null : Number(n).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł');

// Jedno podsumowanie czynszu — TEN SAM tekst i wyróżniony styl w formularzu i na
// każdej karcie lokalu (istniejące i nowe). Rozbicie: kwota · miejsca×cena · VAT · media.
function RentSummary({ net, pricePerPerson, rentedSpots, vatRate, mediaIncluded }: {
  net: number; pricePerPerson?: number | string | null; rentedSpots?: number | string | null; vatRate: number; mediaIncluded?: boolean | null;
}) {
  if (!(net > 0)) return null;
  const gross = Math.round(net * (1 + vatRate / 100) * 100) / 100;
  const perPerson = pricePerPerson != null && pricePerPerson !== '' && Number(pricePerPerson) > 0;
  return (
    <p className="rounded-xl bg-primary-50 px-3 py-2 text-sm text-primary-800">
      Czynsz: <b>{zl(net)}{vatRate === 0 ? '' : ' netto'}</b>
      {perPerson ? <> ({rentedSpots} miejsc × {zl(Number(pricePerPerson))})</> : ' (ręcznie)'}
      {' · '}{vatRate === 0 ? 'bez VAT — kwatera prywatna (rachunek)' : `${zl(gross)} brutto (VAT ${vatRate}%)`}
      {' · media '}{mediaIncluded ? 'w cenie' : 'PŁATNE OSOBNO'}
    </p>
  );
}

// Ton plakietki końca najmu (alarm przy ≤3 dniach)
const leaseTone = (days: number) => days <= 3 ? 'bg-red-100 text-red-700' : days <= 14 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700';

// Lista zakwaterowanych w danym lokalu + przenoszenie do innego lokalu (PATCH accommodation_id).
// Degraduje się cicho: bez zakwaterowanych → komunikat; bez innych lokali → select wyłączony.
function TenantsList({ tenants, accommodations, currentId, onMoved }: {
  tenants: Tenant[]; accommodations: { id: string; name: string }[]; currentId: string; onMoved: () => void;
}) {
  const [target, setTarget] = useState<Record<string, string>>({});
  const [moving, setMoving] = useState<string | null>(null);
  const others = accommodations.filter(a => a.id !== currentId);

  const move = async (t: Tenant) => {
    const accommodation_id = target[t.id];
    if (!accommodation_id) return;
    setMoving(t.id);
    try {
      const r = await fetch(`/api/hr/employees/${t.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ accommodation_id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { alert(d.error || 'Błąd przenoszenia'); return; }
      onMoved();
    } finally { setMoving(null); }
  };

  if (!tenants.length) return <p className="px-1 py-2 text-xs italic text-slate-300">Brak zakwaterowanych w tym lokalu</p>;

  return (
    <div className="space-y-1.5">
      {tenants.map(t => (
        <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm ring-1 ring-slate-100">
          <span className="min-w-0 flex-1 truncate text-slate-700">{displayName(t)}</span>
          <select
            value={target[t.id] ?? ''}
            onChange={e => setTarget(m => ({ ...m, [t.id]: e.target.value }))}
            disabled={!others.length}
            title={others.length ? 'Przenieś do innego lokalu' : 'Brak innych lokali do wyboru'}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-50"
          >
            <option value="">— przenieś do —</option>
            {others.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button
            onClick={() => move(t)}
            disabled={!target[t.id] || moving === t.id}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-50"
          >
            {moving === t.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />} Przenieś
          </button>
        </div>
      ))}
    </div>
  );
}

const TYPES: [string, string][] = [
  ['pensjonat', 'Pensjonat'], ['hotel', 'Hotel'], ['dom', 'Dom'], ['mieszkanie', 'Mieszkanie'], ['hostel', 'Hostel'], ['inne', 'Inne'],
];
const typeLabel = (t?: string | null) => TYPES.find(([v]) => v === t)?.[1] ?? (t || 'Inne');
const mapsUrl = (addr?: string | null) => addr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}` : '';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><p className={LABEL + ' flex items-center gap-1'}>{label}{hint && <Hint text={hint} />}</p><div className="mt-1">{children}</div></div>;
}

// miejsca: nasze wolne = wynajęte − zajęte; potencjalne = całkowite − wynajęte
const spotMath = (a: Accommodation) => {
  const total = a.capacity ?? null;
  const rented = a.rented_spots ?? null;
  const used = a.assigned_count;
  const ourFree = rented != null ? Math.max(0, rented - used) : (total != null ? Math.max(0, total - used) : null);
  const potential = total != null && rented != null ? Math.max(0, total - rented) : null;
  const over = rented != null ? used > rented : (total != null && used > total);
  return { total, rented, used, ourFree, potential, over };
};

interface AccPhoto { id: string; url: string | null; filename?: string | null; caption?: string | null; created_at: string; mine?: boolean }

// Galeria zdjęć stanu lokalu — dokumentacja przed najmem / po szkodzie.
// Komponent na poziomie modułu (nie w renderze) — inaczej input traci focus przy każdym znaku.
function AccPhotosModal({ acc, onClose }: { acc: Accommodation; onClose: () => void }) {
  const [photos, setPhotos] = useState<AccPhoto[]>([]);
  const [canDeleteAll, setCanDeleteAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/hr/accommodations/${acc.id}/photos`, { credentials: 'same-origin' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Błąd');
      setPhotos(j.photos || []);
      setCanDeleteAll(!!j.can_delete_all);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Błąd'); } finally { setLoading(false); }
  }, [acc.id]);
  useEffect(() => { load(); }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true); setErr(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        if (caption.trim()) fd.append('caption', caption.trim());
        const r = await fetch(`/api/hr/accommodations/${acc.id}/photos`, { method: 'POST', body: fd, credentials: 'same-origin' });
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `Błąd wgrywania ${file.name}`); }
      }
      setCaption('');
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Błąd wgrywania'); } finally { setUploading(false); }
  };

  const removePhoto = async (p: AccPhoto) => {
    if (!confirm(`Usunąć zdjęcie${p.caption ? ` „${p.caption}"` : ''}? Tego nie da się cofnąć.`)) return;
    const r = await fetch(`/api/hr/accommodations/${acc.id}/photos?photo_id=${p.id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.error || 'Nie udało się usunąć'); return; }
    setPhotos(ph => ph.filter(x => x.id !== p.id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <Camera size={18} className="text-primary-600" />
          <div className="min-w-0 flex-1">
            <p className="font-sans font-bold text-slate-900">Zdjęcia stanu lokalu — {acc.name}</p>
            <p className="text-xs text-slate-500">Dokumentacja stanu przed najmem i ewentualnych szkód — z datą dodania</p>
          </div>
          <Hint text="Wgraj zdjęcia lokalu z datą — np. stan przed wprowadzeniem pracowników albo szkoda do rozliczenia z kaucji. Opis wpisany niżej zostanie przypisany do wszystkich wgrywanych naraz zdjęć." />
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Opis zdjęć, np. stan przed najmem — kuchnia" className={INPUT + ' max-w-xs flex-1'} />
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
              <p className="text-sm italic">Brak zdjęć — dodaj dokumentację stanu lokalu</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map(p => (
                <div key={p.id} className="group relative overflow-hidden rounded-xl border border-slate-200">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" title="Otwórz w pełnym rozmiarze">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.caption || p.filename || 'zdjęcie lokalu'} className="h-36 w-full object-cover transition group-hover:scale-105" />
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

export function HrBazaNoclegowa() {
  const [list, setList] = useState<Accommodation[]>([]);
  const [contracts, setContracts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [photosAcc, setPhotosAcc] = useState<Accommodation | null>(null);
  const [employees, setEmployees] = useState<Tenant[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ra, rc, re] = await Promise.all([
        fetch('/api/hr/accommodations', { credentials: 'same-origin' }),
        fetch('/api/hr/contracts?names=1', { credentials: 'same-origin' }),
        fetch('/api/hr/employees', { credentials: 'same-origin' }),
      ]);
      const da = ra.ok ? await ra.json() : { accommodations: [] };
      const dc = rc.ok ? await rc.json() : { contracts: [] };
      const de = re.ok ? await re.json() : { employees: [] };
      setList(da.accommodations || []);
      setContracts(dc.contracts || []);
      setEmployees(de.employees || []);
    } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setAdding(true); setEditId(null); setForm({ ...empty, contacts: [{ ...emptyContact }] }); setError(null); };
  const openEdit = (a: Accommodation) => {
    setEditId(a.id); setAdding(false);
    setForm({
      ...empty, ...a,
      street: a.street ?? '', house_no: a.house_no ?? '', apartment_no: a.apartment_no ?? '', postal_code: a.postal_code ?? '', city: a.city ?? '',
      voivodeship: a.voivodeship ?? '', county: a.county ?? '', commune: a.commune ?? '', post_office: a.post_office ?? '',
      capacity: a.capacity ?? '', rented_spots: a.rented_spots ?? '', monthly_rent: a.monthly_rent ?? '', deposit: a.deposit ?? '',
      price_per_person: a.price_per_person ?? '', vat_rate: String(a.vat_rate ?? 23), media_included: !!a.media_included,
      deposit_returned: !!a.deposit_returned, contract_id: a.contract_id ?? '',
      contacts: (a.contacts && a.contacts.length ? a.contacts : [{ name: a.contact_person || '', phone: a.phone || '', role: '' }]).map(c => ({ ...c })),
    });
    setError(null);
  };
  const close = () => { setAdding(false); setEditId(null); setForm(empty); setError(null); };

  const save = async () => {
    if (!form.name.trim()) { setError('Nazwa jest wymagana'); return; }
    setSaving(true); setError(null);
    try {
      const url = editId ? `/api/hr/accommodations/${editId}` : '/api/hr/accommodations';
      // UWAGA: 0 = „bez VAT (kwatera prywatna, rachunek)" — nie wolno użyć `|| 23`, bo zjadłoby zero
      const r = await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ ...form, vat_rate: Number.isFinite(Number(form.vat_rate)) && form.vat_rate !== '' ? Number(form.vat_rate) : 23 }) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Błąd'); }
      close(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setSaving(false); }
  };

  const remove = async (a: Accommodation) => {
    if (!confirm(`Usunąć „${a.name}"? Przypisani pracownicy zostaną odpięci.`)) return;
    await fetch(`/api/hr/accommodations/${a.id}`, { method: 'DELETE', credentials: 'same-origin' });
    await load();
  };

  const copyPin = async (a: Accommodation) => {
    const url = mapsUrl(a.address);
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(a.id); setTimeout(() => setCopied(c => c === a.id ? null : c), 1800); } catch { /* */ }
  };

  const setContact = (i: number, patch: Partial<Contact>) => setForm((f: any) => ({ ...f, contacts: f.contacts.map((c: Contact, j: number) => j === i ? { ...c, ...patch } : c) }));

  // podgląd czynszu w formularzu (netto z rozbicia + brutto); 0 = bez VAT (kwatera prywatna)
  const previewNet = (Number(form.price_per_person) || 0) * (Number(form.rented_spots) || 0);
  const previewVat = Number.isFinite(Number(form.vat_rate)) && form.vat_rate !== '' ? Number(form.vat_rate) : 23;
  const previewGross = previewNet * (1 + previewVat / 100);

  // wyszukiwarka wolnych miejsc: filtr po nazwie/adresie/projekcie
  const filtered = list.filter(a => {
    if (projectFilter && a.contract_id !== projectFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [a.name, a.address, a.contract?.name, a.description].some(v => (v || '').toLowerCase().includes(q));
  });
  // całkowita liczba miejsc = miejsca całkowite w lokalach (fallback wynajęte) po wszystkich obiektach
  const sums = filtered.reduce((s, a) => { const m = spotMath(a); return { our: s.our + (m.ourFree ?? 0), pot: s.pot + (m.potential ?? 0), all: s.all + ((Number(a.capacity) || Number(a.rented_spots)) || 0) }; }, { our: 0, pot: 0, all: 0 });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-lg font-bold text-slate-900">Baza noclegowa</h2>
          <p className="text-sm text-slate-500">Lokale per projekt — miejsca (całkowite / wynajęte / zajęte), czynsz z rozbicia ceny za osobę, kontakty, dojazd do magazynu</p>
        </div>
        <span className="flex items-center gap-1.5"><button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"><Plus size={16} /> Dodaj nocleg</button><Hint text="Otwiera formularz nowego lokalu: adres, miejsca, czynsz z rozbicia, kontakty i projekt. Po zapisie lokal pojawia się na liście i można przypisywać do niego pracowników." /></span>
      </div>

      {(() => {
        const alerts = list.map(a => ({ a, st: expiryStatus(a.lease_end_date) })).filter(x => x.st && x.st.days <= 3).sort((x, y) => (x.st!.days - y.st!.days));
        if (!alerts.length) return null;
        return (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="mb-1 flex items-center gap-2 text-red-700">
              <AlertTriangle size={18} />
              <p className="font-semibold">Kończący się najem ({alerts.length})</p>
            </div>
            <p className="mb-2 text-sm text-red-700">Znajdź nową bazę noclegową lub przenieś pracowników do innego obiektu.</p>
            <div className="space-y-1.5">
              {alerts.map(({ a, st }) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-3 py-1.5 text-sm">
                  <span className="font-medium text-slate-700">{a.name}</span>
                  <span className="text-slate-400">· najem do {fmtDate(a.lease_end_date)} · {a.assigned_count} prac.</span>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${leaseTone(st!.days)}`}>{st!.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Wyszukiwarka wolnych miejsc — nasze vs potencjalne w danej lokalizacji */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj wolnych miejsc — lokal, adres, projekt…" title="Filtruje listę lokali po nazwie, adresie, projekcie lub opisie — chipy obok pokażą sumę wolnych miejsc w wynikach" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">Wszystkie projekty</option>
          {contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200" title="Wszystkie miejsca noclegowe jakie mamy (miejsca całkowite we wszystkich obiektach)">Całkowita liczba miejsc: {sums.all}</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">Wolne nasze: {sums.our}</span>
        <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200" title="Miejsca w lokalach, których jeszcze nie wynajmujemy (całkowite − wynajęte)">Potencjalne: {sums.pot}</span>
      </div>

      {(adding || editId) && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 font-semibold text-slate-800">{editId ? 'Edycja noclegu' : 'Nowy nocleg'}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nazwa *" hint="Nazwa lokalu widoczna na liście, w kartach pracowników i w alertach najmu. Pole wymagane."><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={INPUT} placeholder="np. Pensjonat Pod Lipami" /></Field>
            <Field label="Typ" hint="Rodzaj obiektu (pensjonat, mieszkanie itd.) — tylko informacyjnie, do szybkiego rozpoznania lokalu.">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={INPUT}>
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Projekt / magazyn (liczy dojazd)" hint="Przypięcie lokalu do kontraktu/projektu (np. Magazyn SHEIN). Z adresu magazynu liczona jest odległość i czas dojazdu na karcie lokalu.">
              <select value={form.contract_id} onChange={e => setForm({ ...form, contract_id: e.target.value })} className={INPUT}>
                <option value="">— bez projektu —</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4 lg:col-span-3 lg:grid-cols-8">
              <div className="col-span-2 sm:col-span-2 lg:col-span-3"><Field label="Ulica" hint="Nazwa ulicy bez numeru (np. ul. Przykładowa). We wsiach bez ulic — nazwa miejscowości. Z pól adresu składa się pełny adres: pinezka Google Maps, dojazd do magazynu i adres zamieszkania w dokumentach."><input value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} className={INPUT} placeholder="ul. Przykładowa" /></Field></div>
              <div><Field label="Nr domu" hint="Numer budynku (np. 12 albo 15A)."><input value={form.house_no} onChange={e => setForm({ ...form, house_no: e.target.value })} className={INPUT} placeholder="12" /></Field></div>
              <div><Field label="Nr lokalu" hint="Numer mieszkania/lokalu — puste, gdy cały budynek. W adresie pojawi się po ukośniku (12/3)."><input value={form.apartment_no} onChange={e => setForm({ ...form, apartment_no: e.target.value })} className={INPUT} placeholder="—" /></Field></div>
              <div><Field label="Kod pocztowy" hint="Format 00-000. Trafia do pola kodu pocztowego w kwestionariuszach pracowników."><input value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} className={INPUT} placeholder="55-080" /></Field></div>
              <div className="col-span-2 lg:col-span-2"><Field label="Miejscowość" hint="Miasto lub wieś. Trafia do pola miejscowości w kwestionariuszach pracowników."><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className={INPUT} placeholder="Kąty Wrocławskie" /></Field></div>
              <div className="col-span-2"><Field label="Województwo" hint="Województwo lokalu — wypełnia pole Województwo w kwestionariuszu osobowym pracownika."><input value={form.voivodeship} onChange={e => setForm({ ...form, voivodeship: e.target.value })} className={INPUT} placeholder="dolnośląskie" /></Field></div>
              <div className="col-span-2"><Field label="Powiat" hint="Powiat lokalu — wypełnia pole Powiat w kwestionariuszu osobowym pracownika."><input value={form.county} onChange={e => setForm({ ...form, county: e.target.value })} className={INPUT} placeholder="wrocławski" /></Field></div>
              <div className="col-span-2"><Field label="Gmina" hint="Gmina lokalu — wypełnia pole Gmina w kwestionariuszu osobowym pracownika."><input value={form.commune} onChange={e => setForm({ ...form, commune: e.target.value })} className={INPUT} placeholder="Kąty Wrocławskie" /></Field></div>
              <div className="col-span-2"><Field label="Poczta" hint="Urząd pocztowy właściwy dla adresu (miejscowość poczty) — wypełnia pole Poczta w kwestionariuszu."><input value={form.post_office} onChange={e => setForm({ ...form, post_office: e.target.value })} className={INPUT} placeholder="55-080 Kąty Wrocławskie" /></Field></div>
            </div>
            {(form.street || form.house_no || form.postal_code || form.city) && (
              <div className="sm:col-span-2 lg:col-span-3 -mt-1 text-xs text-slate-500">
                Pełny adres: <span className="font-medium text-slate-700">{[[form.street, form.house_no ? String(form.house_no) + (form.apartment_no ? `/${form.apartment_no}` : '') : ''].filter(Boolean).join(' '), [form.postal_code, form.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
              </div>
            )}

            <Field label="Miejsca całkowite (w lokalu)" hint="Ile łóżek/miejsc fizycznie ma cały lokal. Różnica między całkowitymi a wynajętymi = miejsca POTENCJALNE do dowynajęcia."><input type="number" min="0" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className={INPUT} /></Field>
            <Field label="Miejsca wynajęte przez nas" hint="Ile miejsc my wynajmujemy od właściciela. Wynajęte minus zajęte = nasze WOLNE miejsca. Z tej liczby liczy się też czynsz (cena za osobę × miejsca)."><input type="number" min="0" value={form.rented_spots} onChange={e => setForm({ ...form, rented_spots: e.target.value })} className={INPUT} /></Field>
            <Field label="Lokal dostępny od" hint="Początek najmu — od tego miesiąca Księgowość dolicza czynsz jako auto-koszt. Puste = od daty dodania lokalu do systemu."><input type="date" value={form.available_from ?? ''} onChange={e => setForm({ ...form, available_from: e.target.value })} className={INPUT} /></Field>
            <Field label="Koniec najmu (data)" hint="Data końca umowy najmu. Przy 3 dniach do końca odpala się czerwony alarm na głównym widoku i w Bazie Noclegowej."><input type="date" value={form.lease_end_date ?? ''} onChange={e => setForm({ ...form, lease_end_date: e.target.value })} className={INPUT} /></Field>

            {/* Czynsz z rozbicia — cena/os., VAT, media → netto/brutto */}
            <Field label="Cena za osobę (zł/mies., netto)" hint="Stawka netto za jedno miejsce miesięcznie. Czynsz wyliczy się sam: cena × miejsca wynajęte. Kwota netto trafia do bilansu Księgowości."><input type="number" min="0" step="0.01" value={form.price_per_person} onChange={e => setForm({ ...form, price_per_person: e.target.value })} className={INPUT} placeholder="np. 700" /></Field>
            <Field label="Stawka VAT" hint="8% lub 23% — do wyliczenia kwoty brutto czynszu. Bez VAT = kwatera prywatna rozliczana rachunkiem (najem od osoby prywatnej bez faktury VAT) — czynsz liczy się bez doliczania podatku.">
              <select value={form.vat_rate} onChange={e => setForm({ ...form, vat_rate: e.target.value })} className={INPUT}>
                <option value="0">bez VAT — kwatera prywatna (rachunek)</option>
                <option value="8">8%</option>
                <option value="23">23%</option>
              </select>
            </Field>
            <Field label="Media" hint="Zaznacz, jeśli cena za osobę zawiera media (prąd, woda, internet). Widoczne przy rozbiciu czynszu, żeby kwoty były porównywalne.">
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={!!form.media_included} onChange={e => setForm({ ...form, media_included: e.target.checked })} /> cena zawiera media
              </label>
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              {previewNet > 0 ? (
                <RentSummary net={previewNet} pricePerPerson={form.price_per_person} rentedSpots={form.rented_spots} vatRate={previewVat} mediaIncluded={form.media_included} />
              ) : (
                <Field label="Czynsz ręcznie (zł/mies. netto — gdy brak ceny za osobę)" hint="Używaj tylko, gdy nie znasz ceny za osobę. Gdy podasz cenę za osobę i liczbę miejsc, czynsz nadpisze się automatycznie."><input type="number" min="0" step="0.01" value={form.monthly_rent} onChange={e => setForm({ ...form, monthly_rent: e.target.value })} className={INPUT} placeholder="np. 3500" /></Field>
              )}
            </div>

            <Field label="Kaucja (zł)" hint="Kaucja wpłacona właścicielowi. W Księgowości liczona osobno jako zamrożone środki (nie koszt). Po odzyskaniu zaznacz zwrócona.">
              <div className="flex items-center gap-3">
                <input type="number" min="0" step="0.01" value={form.deposit} onChange={e => setForm({ ...form, deposit: e.target.value })} className={INPUT} placeholder="np. 3000" />
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={!!form.deposit_returned} onChange={e => setForm({ ...form, deposit_returned: e.target.checked })} /> zwrócona</label>
              </div>
            </Field>
            <div className="sm:col-span-2"><Field label="Krótki opis" hint="Jedno zdanie o lokalu (np. 3 pokoje, kuchnia) — widoczne na karcie na liście."><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={INPUT} placeholder="np. 3 pokoje, kuchnia, 5 min od zakładu" /></Field></div>

            {/* Osoby kontaktowe — kilka pozycji (właściciel, koordynator budynku…) */}
            <div className="sm:col-span-2 lg:col-span-3">
              <p className={LABEL}>Osoby kontaktowe</p>
              <div className="mt-1 space-y-2">
                {form.contacts.map((c: Contact, i: number) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input value={c.name} onChange={e => setContact(i, { name: e.target.value })} placeholder="Imię i nazwisko" className={INPUT + ' min-w-[160px] flex-1'} />
                    <input value={c.phone} onChange={e => setContact(i, { phone: e.target.value })} placeholder="Telefon" className={INPUT + ' w-40'} />
                    <input value={c.role} onChange={e => setContact(i, { role: e.target.value })} placeholder="Rola (np. właściciel)" className={INPUT + ' w-48'} />
                    <button onClick={() => setForm((f: any) => ({ ...f, contacts: f.contacts.filter((_: any, j: number) => j !== i) }))} className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600" title="Usuń kontakt"><X size={15} /></button>
                  </div>
                ))}
                <span className="flex items-center gap-1.5"><button onClick={() => setForm((f: any) => ({ ...f, contacts: [...f.contacts, { ...emptyContact }] }))} className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:underline"><Plus size={13} /> Dodaj osobę kontaktową</button><Hint text="Dodaje kolejny wiersz kontaktu — np. właściciel i koordynator budynku osobno, każdy ze swoim telefonem i rolą." /></span>
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-3"><Field label="Notatki" hint="Wewnętrzne uwagi o lokalu — widoczne tylko w edycji."><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={INPUT + ' resize-y'} /></Field></div>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={close} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Anuluj</button>
            {/* wyraźny przycisk zapisu (wcześniej był niewidoczny) */}
            <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Zapisz
            </button>
            <Hint text="Zapisuje lokal: przelicza czynsz z ceny za osobę, geokoduje adres (dojazd do magazynu) i loguje zmianę w Rejestrze zdarzeń." className="self-center" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm italic text-slate-300">{list.length === 0 ? 'Brak noclegów — kliknij „Dodaj nocleg"' : 'Brak lokali pasujących do wyszukiwania'}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map(a => {
            const m = spotMath(a);
            const net = a.monthly_rent != null ? Number(a.monthly_rent) : null;
            return (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><BedDouble size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-sans font-bold text-slate-900">{a.name}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{typeLabel(a.type)}</span>
                      {a.contract && <span className="flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700"><Building2 size={11} /> {a.contract.name}</span>}
                    </div>
                    {a.description && <p className="mt-0.5 text-sm text-slate-500">{a.description}</p>}
                  </div>
                  <button onClick={() => setPhotosAcc(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600" title="Zdjęcia stanu lokalu"><Camera size={15} /></button>
                  <button onClick={() => openEdit(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600" title="Edytuj"><Pencil size={15} /></button>
                  <button onClick={() => remove(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Usuń"><Trash2 size={15} /></button>
                </div>

                {/* Adres + pinezka + dojazd do magazynu */}
                {a.address && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-primary-500" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm text-slate-700">{a.address}</p>
                      {a.distance_km != null && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Route size={12} /> do magazynu ~{a.distance_km} km · ~{a.drive_min} min autem <span className="text-slate-300">(szacunkowo)</span></p>
                      )}
                    </div>
                    <button onClick={() => copyPin(a)} title="Kopiuj pinezkę (link Google Maps)" className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition ${copied === a.id ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-white'}`}>
                      {copied === a.id ? <><Check size={13} /> Skopiowano</> : <><Copy size={13} /> Pinezka</>}
                    </button>
                    <a href={mapsUrl(a.address)} target="_blank" rel="noopener noreferrer" title="Otwórz w Mapach" className="flex shrink-0 items-center rounded-lg border border-slate-200 px-2 py-1 text-slate-500 hover:bg-white"><ExternalLink size={13} /></a>
                  </div>
                )}

                {/* Miejsca: zajęte / wynajęte / całkowite + wolne nasze i potencjalne */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className={`flex items-center gap-1.5 font-medium ${m.over ? 'text-red-600' : 'text-slate-700'}`}>
                    <Users size={15} /> zajęte {m.used}{m.rented != null ? ` / wynajęte ${m.rented}` : ''}{m.total != null ? ` / całkowite ${m.total}` : ''}
                  </span>
                  {m.ourFree != null && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.over ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{m.over ? `przekroczono o ${m.used - (m.rented ?? m.total ?? 0)}` : `wolne nasze: ${m.ourFree}`}</span>}
                  {m.potential != null && m.potential > 0 && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">potencjalne: {m.potential}</span>}
                </div>

                <div className="mt-2"><StatusCountBadges counts={a.status_counts} /></div>

                {/* Zakwaterowani w tym lokalu — rozwijalna lista z przenoszeniem do innego lokalu */}
                {a.assigned_count > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setExpandedId(id => (id === a.id ? null : a.id))}
                      className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
                    >
                      {expandedId === a.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Zakwaterowani ({a.assigned_count})
                    </button>
                    {expandedId === a.id && (
                      <div className="mt-2 border-t border-slate-100 pt-2">
                        <TenantsList
                          tenants={employees.filter(e => e.accommodation_id === a.id)}
                          accommodations={list.map(x => ({ id: x.id, name: x.name }))}
                          currentId={a.id}
                          onMoved={load}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Podsumowanie czynszu — TEN SAM widok co w formularzu edycji, dla każdego lokalu */}
                {net != null && net > 0 && (
                  <div className="mt-2">
                    <RentSummary net={net} pricePerPerson={a.price_per_person} rentedSpots={a.rented_spots} vatRate={a.vat_rate ?? 23} mediaIncluded={a.media_included} />
                  </div>
                )}

                {/* Kontakty + najem + kaucja */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                  {(a.contacts && a.contacts.length ? a.contacts : []).map((c, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-slate-500"><Phone size={13} /> {c.name}{c.role ? ` (${c.role})` : ''}{c.phone ? ` · ${c.phone}` : ''}</span>
                  ))}
                  {a.lease_end_date && (() => { const st = expiryStatus(a.lease_end_date); return (
                    <span className="flex items-center gap-1.5 text-slate-500"><CalendarClock size={14} /> Najem do {fmtDate(a.lease_end_date)}
                      {st && <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${leaseTone(st.days)}`}>{st.label}</span>}
                    </span>
                  ); })()}
                  {a.deposit != null && Number(a.deposit) > 0 && (
                    <span className="text-slate-500">Kaucja: <span className="font-medium text-slate-700">{zl(a.deposit)}</span>
                      <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.deposit_returned ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{a.deposit_returned ? 'zwrócona' : 'wpłacona'}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {photosAcc && <AccPhotosModal acc={photosAcc} onClose={() => setPhotosAcc(null)} />}
    </div>
  );
}
