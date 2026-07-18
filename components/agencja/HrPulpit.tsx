'use client';

import React, { useState, useEffect } from 'react';
import { Users, Hourglass, FileWarning, BedDouble, Car, Wallet, Loader2, AlertTriangle, Fingerprint, Landmark } from 'lucide-react';

interface PulpitData {
  pracownicy: { aktywni: number; kandydaci: number };
  dokumenty: { wygasle: number; wkrotce: number; bez_pesel: number; bez_zus: number; lista: { name: string; contract: string; what: string; date: string; expired: boolean }[] };
  najmy: { name: string; date: string; people: number }[];
  flota: { liczba: number; alerty: { vehicle: string; what: string; date: string; expired: boolean }[] };
  rozliczenia: { period: string; rozliczonych: number; brutto: number; zaliczki: number; wyplacono: number; pozostalo: number };
  scope: string;
}

const d = (s: string) => new Date(s).toLocaleDateString('pl-PL');
const zl = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';

function Kpi({ icon, label, value, tone = 'slate', sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: 'slate' | 'amber' | 'red' | 'emerald' | 'primary'; sub?: string }) {
  const tones: Record<string, string> = {
    slate: 'text-slate-600 bg-slate-100', amber: 'text-amber-700 bg-amber-100', red: 'text-red-700 bg-red-100',
    emerald: 'text-emerald-700 bg-emerald-100', primary: 'text-primary-600 bg-primary-50',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-slate-500">{label}</p>
          <p className="font-sans text-xl font-bold text-slate-900">{value}</p>
          {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export function HrPulpit() {
  const [data, setData] = useState<PulpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/hr/pulpit', { credentials: 'same-origin' })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Błąd'); return j; })
      .then(setData).catch(e => setError(e instanceof Error ? e.message : 'Błąd')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Ładowanie pulpitu…</div>;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!data) return null;

  const doc = data.dokumenty;
  return (
    <div className="space-y-5">
      {data.scope === 'koordynator' && (
        <p className="rounded-lg bg-primary-50 px-3 py-2 text-[12px] text-primary-700">Widok koordynatora — pokazujemy Twoich pracowników.</p>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={<Users size={19} />} tone="primary" label="Aktywni pracownicy" value={data.pracownicy.aktywni} />
        <Kpi icon={<Hourglass size={19} />} tone="slate" label="Kandydaci w Poczekalni" value={data.pracownicy.kandydaci} />
        <Kpi icon={<FileWarning size={19} />} tone={doc.wygasle ? 'red' : doc.wkrotce ? 'amber' : 'emerald'} label="Dokumenty do uwagi" value={doc.wygasle + doc.wkrotce} sub={`${doc.wygasle} wygasłe · ${doc.wkrotce} wkrótce`} />
        <Kpi icon={<Car size={19} />} tone={data.flota.liczba ? 'amber' : 'emerald'} label="Alerty floty" value={data.flota.liczba} sub="OC / przegląd / prawo jazdy" />
        <Kpi icon={<Fingerprint size={19} />} tone={doc.bez_pesel ? 'amber' : 'emerald'} label="Bez numeru PESEL" value={doc.bez_pesel} />
        <Kpi icon={<Landmark size={19} />} tone={doc.bez_zus ? 'amber' : 'emerald'} label="Bez zgłoszenia ZUS" value={doc.bez_zus} />
        <Kpi icon={<BedDouble size={19} />} tone={data.najmy.length ? 'amber' : 'emerald'} label="Kończące się najmy" value={data.najmy.length} sub="≤14 dni" />
        <Kpi icon={<Wallet size={19} />} tone="slate" label={`Do wypłaty (${data.rozliczenia.period})`} value={zl(data.rozliczenia.pozostalo)} sub={`${data.rozliczenia.rozliczonych} rozliczeń`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Dokumenty */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 font-sans font-bold text-slate-900"><FileWarning size={17} className="text-amber-500" /> Dokumenty — wygasłe lub ≤30 dni</h3>
          {doc.lista.length === 0 ? <p className="py-4 text-sm italic text-slate-400">Brak alertów dokumentów 🎉</p> : (
            <div className="space-y-1">
              {doc.lista.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <div className="min-w-0"><span className="font-medium text-slate-700">{a.name}</span> <span className="text-slate-400">· {a.contract}</span></div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[12px] text-slate-500">{a.what}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.expired ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{d(a.date)}{a.expired ? ' — wygasł' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Flota */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 font-sans font-bold text-slate-900"><Car size={17} className="text-primary-500" /> Flota — terminy</h3>
          {data.flota.alerty.length === 0 ? <p className="py-4 text-sm italic text-slate-400">Brak alertów floty 🎉</p> : (
            <div className="space-y-1">
              {data.flota.alerty.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <span className="min-w-0 truncate font-medium text-slate-700">{a.vehicle}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[12px] text-slate-500">{a.what}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.expired ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{d(a.date)}{a.expired ? ' — wygasł' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Najmy */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 font-sans font-bold text-slate-900"><BedDouble size={17} className="text-amber-500" /> Kończące się najmy (≤14 dni)</h3>
          {data.najmy.length === 0 ? <p className="py-4 text-sm italic text-slate-400">Brak kończących się najmów</p> : (
            <div className="space-y-1">
              {data.najmy.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <span className="min-w-0 truncate font-medium text-slate-700">{a.name} <span className="text-slate-400">· {a.people} os.</span></span>
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">koniec {d(a.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rozliczenia */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 font-sans font-bold text-slate-900"><Wallet size={17} className="text-emerald-500" /> Rozliczenia — {data.rozliczenia.period}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Rozliczonych pracowników</span><span className="font-semibold text-slate-800">{data.rozliczenia.rozliczonych}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Brutto (stawki + premie)</span><span className="font-semibold text-slate-800">{zl(data.rozliczenia.brutto)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Zaliczki wypłacone</span><span className="font-semibold text-slate-800">{zl(data.rozliczenia.zaliczki)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Wypłaty zrealizowane</span><span className="font-semibold text-slate-800">{zl(data.rozliczenia.wyplacono)}</span></div>
            <div className="mt-1 flex justify-between border-t border-slate-100 pt-2"><span className="font-medium text-slate-600">Pozostało do wypłaty (szac.)</span><span className="font-sans text-base font-bold text-primary-600">{zl(data.rozliczenia.pozostalo)}</span></div>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400"><AlertTriangle size={11} /> Kwota orientacyjna (bez potrąceń mieszkaniowych i indywidualnych — pełne saldo w zakładce Rozliczenia).</p>
        </div>
      </div>
    </div>
  );
}
