'use client';

// Mapa Pracowników — ostatnie pozycje telefonów (pingi co ~2 min z portalu pracownika),
// strefy zakładów (geofence kontraktów) i stan automatycznej karty pracy.
// Leaflet + OpenStreetMap + klastrowanie markerów (jak paczkomaty InPost):
// z daleka jedna duża kropka z liczbą pracowników, przy przybliżaniu rozpada się
// na mniejsze, a przy maksymalnym zoomie widać pojedyncze osoby. Odświeżanie co 60 s.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2, RefreshCw, Users } from 'lucide-react';
import { Hint } from '@/components/ui/Hint';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';

interface Worker {
  id: string; name: string; phone?: string | null; contract?: string | null;
  lat: number | null; lng: number | null; accuracy?: number | null;
  inside: boolean | null; last_seen: string | null;
  working_since: string | null; left_at: string | null;
}
interface Zone { id: string; name: string; address?: string | null; lat: number; lng: number; radius_m: number }

const STALE_MIN = 10; // ostatni ping starszy niż 10 min = "offline" (szary)

const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '—');
const agoMin = (iso?: string | null) => (iso ? Math.round((Date.now() - new Date(iso).getTime()) / 60000) : null);

function dot(color: string) {
  return `<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`;
}

export function HrMapa() {
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);      // strefy zakładów (bez klastrowania)
  const clusterRef = useRef<any>(null);    // pracownicy (klastrowani)
  const LRef = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/hr/map', { credentials: 'same-origin' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Błąd');
      setWorkers(j.workers || []);
      setZones(j.zones || []);
      setRefreshedAt(new Date().toLocaleTimeString('pl-PL'));
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // inicjalizacja mapy (Polska) — leaflet ładowany dynamicznie (SSR-safe)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      (window as any).L = L;                      // plugin klastrów dopina się do globalnego L
      await import('leaflet.markercluster');
      if (cancelled || !mapDivRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapDivRef.current).setView([52.1, 19.4], 6);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      // klaster: duża kropka z LICZBĄ pracowników; przy zbliżaniu rozpada się na mniejsze
      clusterRef.current = (L as any).markerClusterGroup({
        maxClusterRadius: 55,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,           // przy maks. zoomie nachodzące kropki rozsuwają się wachlarzem
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster: any) => {
          const n = cluster.getChildCount();
          const size = n >= 100 ? 52 : n >= 25 ? 44 : 36;
          // kolor wg zawartości: wszyscy w pracy = zielony, nikt = szary, mieszanka = granat
          const kids = cluster.getAllChildMarkers();
          const working = kids.filter((m: any) => m.options.working).length;
          const bg = working === kids.length ? '#10b981' : working === 0 ? '#64748b' : '#1e3a5f';
          return L.divIcon({
            html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${n >= 100 ? 15 : 14}px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)">${n}</div>`,
            className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
          });
        },
      }).addTo(map);
      mapRef.current = map;
    })();
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // rysowanie: strefy do zwykłej warstwy, pracownicy do klastra (kropki zbijają
  // się w jedną z liczbą w środku i rozdzielają przy przybliżaniu — jak paczkomaty)
  useEffect(() => {
    const L = LRef.current, layer = layerRef.current, cluster = clusterRef.current;
    if (!L || !layer || !cluster) return;
    layer.clearLayers();
    cluster.clearLayers();
    for (const z of zones) {
      L.circle([z.lat, z.lng], { radius: z.radius_m, color: '#0e7490', weight: 1.5, fillColor: '#06b6d4', fillOpacity: 0.08 })
        .bindPopup(`<b>${z.name}</b><br/>${z.address ?? ''}<br/>strefa ${z.radius_m} m`)
        .addTo(layer);
    }
    for (const w of workers) {
      if (w.lat == null || w.lng == null) continue;
      const mins = agoMin(w.last_seen) ?? 999;
      const working = !!w.working_since && mins <= STALE_MIN;
      const color = mins > STALE_MIN ? '#94a3b8' : w.inside ? '#10b981' : '#f59e0b';
      const icon = L.divIcon({ html: dot(color), className: '', iconSize: [18, 18], iconAnchor: [9, 9] });
      const status = w.working_since
        ? `🟢 w pracy od ${fmtTime(w.working_since)}`
        : w.left_at ? `🔴 wyszedł z zakładu o ${fmtTime(w.left_at)}` : 'poza zakładem';
      cluster.addLayer(
        L.marker([w.lat, w.lng], { icon, working } as any)
          .bindPopup(`<b>${w.name}</b>${w.contract ? `<br/>projekt: ${w.contract}` : ''}${w.phone ? `<br/>tel. ${w.phone}` : ''}<br/>${status}<br/><small>ostatni sygnał: ${fmtTime(w.last_seen)} (${mins} min temu)</small>`)
      );
    }
  }, [workers, zones]);

  const withPos = workers.filter(w => w.lat != null);
  const working = workers.filter(w => w.working_since).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-slate-900"><MapPin size={20} className="text-primary-600" /> Mapa Pracowników</h2>
          <p className="text-sm text-slate-500">
            Pozycje telefonów pracowników (ping co ~2 min z portalu) i strefy zakładów · <Users size={13} className="inline" /> {withPos.length}/{workers.length} z sygnałem · 🟢 w pracy: {working}
          </p>
        </div>
        <span className="flex items-center gap-2">
          {refreshedAt && <span className="text-xs text-slate-400">odświeżono {refreshedAt}</span>}
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><RefreshCw size={14} /> Odśwież</button>
          <Hint text="Zielony = w strefie zakładu (sesja pracy otwarta), pomarańczowy = poza strefą, szary = brak sygnału ponad 10 minut (apka zamknięta albo lokalizacja wyłączona). Kółka to strefy zakładów z kontraktów — wejście pracownika w strefę samo odbija kartę pracy. Warunek: pracownik ma konto, włączoną lokalizację w swojej apce i wyrażoną zgodę."/>
        </span>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {loading && <div className="flex justify-center py-10 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>}
      <div ref={mapDivRef} className="h-[70vh] w-full overflow-hidden rounded-2xl border border-slate-200" />

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-emerald-500 align-middle" /> w strefie zakładu (pracuje)</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-amber-500 align-middle" /> poza strefą</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-slate-400 align-middle" /> brak sygnału &gt;{STALE_MIN} min</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full border border-cyan-600 bg-cyan-100 align-middle" /> strefa zakładu (geofence)</span>
        <span><span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#1e3a5f] align-middle text-[9px] font-bold text-white">9</span> grupa pracowników — liczba w kropce, przybliż aby rozdzielić (cała zielona = wszyscy w pracy)</span>
      </div>
    </div>
  );
}
