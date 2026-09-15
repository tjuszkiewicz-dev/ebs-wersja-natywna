import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AdminPulpit } from '../components/adminNew/AdminPulpit';
import { AdminBazaKlientow } from '../components/adminNew/AdminBazaKlientow';
import { AdminPlatnosci } from '../components/adminNew/AdminPlatnosci';
import { AdminArchiwum } from '../components/adminNew/AdminArchiwum';
import { AdminVouchery } from '../components/adminNew/AdminVouchery';
import { AdminBuyback } from '../components/adminNew/AdminBuyback';
import { AdminUsers } from '../components/adminNew/AdminUsers';
import AdminSzablony from '../components/adminNew/AdminSzablony';
import AdminLogi from '../components/adminNew/AdminLogi';
import { HrDashboard } from '../components/agencja/HrDashboard';
import { HrFlota } from '../components/agencja/HrFlota';
import { HrGeneratorDokumentow } from '../components/agencja/HrGeneratorDokumentow';
import { HrTlumacz } from '../components/agencja/HrTlumacz';
import { AdminKsiegowosc } from '../components/adminNew/AdminKsiegowosc';
import { LayoutDashboard, Users, CreditCard, ShieldCheck, Archive, Ticket, RefreshCw, Lock, FileText, ScrollText } from 'lucide-react';

// Leaflet (HrMapa) jest browser-only — dynamic import ssr:false, żeby nie wysadzić `next build`.
const HrMapa = dynamic(() => import('../components/agencja/HrMapa').then(m => m.HrMapa), { ssr: false });
// Ekrany wyłączne dla ownera — lazy, żeby nie ładować ich zwykłym adminom.
const OwnerPanel = dynamic(() => import('../components/adminNew/OwnerPanel').then(m => m.OwnerPanel), { ssr: false });
const AdminUstawienia = dynamic(() => import('../components/adminNew/AdminUstawienia').then(m => m.AdminUstawienia), { ssr: false });
// CRM (E7a) — lazy, żeby pipeline nie ładował się rolom, które go nie mają.
const PipelineKanban = dynamic(() => import('../components/crm/pipeline/PipelineKanban'), { ssr: false });
// CRM (E7b)
const CrmKontakty = dynamic(() => import('../components/adminNew/crm/CrmKontakty').then(m => ({ default: m.CrmKontakty })), { ssr: false });
const CrmKalendarz = dynamic(() => import('../components/adminNew/crm/CrmKalendarz').then(m => ({ default: m.CrmKalendarz })), { ssr: false });
// E7c: kalkulator żyje w components/crm/calculator (jak w BBS) — bez zbędnej przejściówki w adminNew.
const CalculatorWizard = dynamic(() => import('../components/crm/calculator/CalculatorWizard'), { ssr: false });
// CRM (E7d) — org-chart rysuje d3 na DOM-ie, więc bezwzględnie ssr:false.
const CrmLeaderboard = dynamic(() => import('../components/adminNew/crm/CrmLeaderboard').then(m => ({ default: m.CrmLeaderboard })), { ssr: false });
const OrgChartView = dynamic(() => import('../components/adminNew/org/OrgChartView').then(m => ({ default: m.OrgChartView })), { ssr: false });
// CRM (E7e) — nagrywanie idzie przez MediaRecorder, więc tylko po stronie przeglądarki.
const CrmNotatki = dynamic(() => import('../components/adminNew/crm/CrmNotatki').then(m => ({ default: m.CrmNotatki })), { ssr: false });

type AdminTab = 'pulpit' | 'klienci' | 'platnosci' | 'archiwum' | 'vouchery' | 'buyback' | 'uzytkowniczy' | 'szablony' | 'logi' | 'hr-pracownicy' | 'hr-flota' | 'hr-generator' | 'hr-tlumacz' | 'hr-mapa' | 'admin-ksiegowosc' | 'crm-pipeline' | 'crm-kontakty' | 'crm-kalendarz' | 'crm-kalkulator' | 'crm-leaderboard' | 'crm-org-chart' | 'crm-notatki' | 'owner-panel' | 'ustawienia';

export const VIEW_TO_TAB: Record<string, AdminTab> = {
  'admin-pulpit':    'pulpit',
  'admin-klienci':   'klienci',
  'admin-platnosci': 'platnosci',
  'admin-archiwum':  'archiwum',
  'admin-vouchery':  'vouchery',
  'admin-buyback':   'buyback',
  'admin-uzytkowniczy': 'uzytkowniczy',
  'admin-szablony':  'szablony',
  'admin-logi':      'logi',
  'hr-pracownicy':   'hr-pracownicy',
  'hr-flota':        'hr-flota',
  'hr-generator':    'hr-generator',
  'hr-tlumacz':      'hr-tlumacz',
  'hr-mapa':         'hr-mapa',
  'admin-ksiegowosc': 'admin-ksiegowosc',
  'crm-pipeline':     'crm-pipeline',
  'crm-kontakty':     'crm-kontakty',
  'crm-kalendarz':    'crm-kalendarz',
  'crm-kalkulator':   'crm-kalkulator',
  'crm-leaderboard':  'crm-leaderboard',
  'crm-org-chart':    'crm-org-chart',
  'crm-notatki':      'crm-notatki',
  'owner-panel':      'owner-panel',
  'admin-ustawienia': 'ustawienia',
};

const TAB_TO_VIEW: Record<AdminTab, string> = {
  pulpit:    'admin-pulpit',
  klienci:   'admin-klienci',
  platnosci: 'admin-platnosci',
  archiwum:  'admin-archiwum',
  vouchery:  'admin-vouchery',
  buyback:   'admin-buyback',
  uzytkowniczy: 'admin-uzytkowniczy',
  szablony:  'admin-szablony',
  logi:      'admin-logi',
  'hr-pracownicy': 'hr-pracownicy',
  'hr-flota':      'hr-flota',
  'hr-generator':  'hr-generator',
  'hr-tlumacz':    'hr-tlumacz',
  'hr-mapa':       'hr-mapa',
  'admin-ksiegowosc': 'admin-ksiegowosc',
  'crm-pipeline':     'crm-pipeline',
  'crm-kontakty':     'crm-kontakty',
  'crm-kalendarz':    'crm-kalendarz',
  'crm-kalkulator':   'crm-kalkulator',
  'crm-leaderboard':  'crm-leaderboard',
  'crm-org-chart':    'crm-org-chart',
  'crm-notatki':      'crm-notatki',
  'owner-panel':      'owner-panel',
  ustawienia:         'admin-ustawienia',
};

interface Props {
  currentView: string;
  onViewChange?: (view: string) => void;
  isOwner?: boolean;
}

export const DashboardAdminNew: React.FC<Props> = ({ currentView, onViewChange, isOwner = false }) => {
  const [tab, setTab] = useState<AdminTab>(() => VIEW_TO_TAB[currentView] ?? 'pulpit');

  useEffect(() => {
    const mapped = VIEW_TO_TAB[currentView];
    if (mapped) setTab(mapped);
  }, [currentView]);

  const handleTab = (t: AdminTab) => {
    setTab(t);
    onViewChange?.(TAB_TO_VIEW[t]);
  };

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'pulpit',    label: 'Pulpit',              icon: <LayoutDashboard size={16} /> },
    { id: 'klienci',   label: 'Baza klientów',       icon: <Users size={16} /> },
    { id: 'platnosci', label: 'Płatności i faktury', icon: <CreditCard size={16} /> },
    { id: 'archiwum',  label: 'Archiwum',            icon: <Archive size={16} /> },
    { id: 'vouchery',  label: 'Vouchery',            icon: <Ticket size={16} /> },
    { id: 'buyback',   label: 'Anulowanie subskrypcji', icon: <RefreshCw size={16} /> },
    { id: 'uzytkowniczy', label: 'Użytkownicy',      icon: <Lock size={16} /> },
    { id: 'szablony',  label: 'Szablony',            icon: <FileText size={16} /> },
    { id: 'logi',      label: 'Logi',                icon: <ScrollText size={16} /> },
  ];

  return (
    <div
      className="-m-4 md:-m-8 min-h-screen"
      style={{ backgroundColor: 'transparent', fontFamily: '"Segoe UI", system-ui, sans-serif' }}
    >
      {/* ── TOP BAR (identyczny styl jak HR) ─────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 flex items-center justify-between" style={{ height: 48 }}>
        <div className="flex items-center gap-3">
          <ShieldCheck size={16} className="text-blue-600" />
          <span className="font-semibold text-gray-800 text-sm">Panel Administracyjny</span>
          <span className="text-gray-300">|</span>
          <span className="text-xs text-gray-500">Platforma Centralna</span>
        </div>
      </div>

      {/* ── TAB BAR (identyczny styl jak HR) ─────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <div className="p-6">
        {tab === 'pulpit'    && <AdminPulpit />}
        {tab === 'klienci'   && <AdminBazaKlientow />}
        {tab === 'platnosci' && <AdminPlatnosci />}
        {tab === 'archiwum'  && <AdminArchiwum />}
        {tab === 'vouchery'  && <AdminVouchery />}
        {tab === 'buyback'   && <AdminBuyback />}
        {tab === 'uzytkowniczy' && <AdminUsers />}
        {tab === 'szablony' && <AdminSzablony />}
        {tab === 'logi' && <AdminLogi />}
        {tab === 'hr-pracownicy' && <HrDashboard />}
        {tab === 'hr-flota' && <HrFlota />}
        {tab === 'hr-generator' && <HrGeneratorDokumentow />}
        {tab === 'hr-tlumacz' && <HrTlumacz />}
        {tab === 'hr-mapa' && <HrMapa />}
        {tab === 'admin-ksiegowosc' && <AdminKsiegowosc />}
        {tab === 'crm-pipeline' && <PipelineKanban />}
        {tab === 'crm-kontakty' && <CrmKontakty />}
        {tab === 'crm-kalendarz' && <CrmKalendarz />}
        {tab === 'crm-kalkulator' && <CalculatorWizard />}
        {tab === 'crm-leaderboard' && <CrmLeaderboard />}
        {tab === 'crm-org-chart' && <OrgChartView />}
        {tab === 'crm-notatki' && <CrmNotatki />}
        {tab === 'owner-panel' && isOwner && <OwnerPanel onGoToPermissions={() => onViewChange?.('admin-ustawienia')} />}
        {tab === 'ustawienia' && isOwner && <AdminUstawienia />}
      </div>
    </div>
  );
};
