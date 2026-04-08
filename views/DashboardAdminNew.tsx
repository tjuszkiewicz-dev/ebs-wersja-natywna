import React, { useState, useEffect } from 'react';
import { AdminPulpit } from '../components/adminNew/AdminPulpit';
import { AdminBazaKlientow } from '../components/adminNew/AdminBazaKlientow';
import { AdminPlatnosci } from '../components/adminNew/AdminPlatnosci';
import { AdminArchiwum } from '../components/adminNew/AdminArchiwum';
import { AdminVouchery } from '../components/adminNew/AdminVouchery';
import { LayoutDashboard, Users, CreditCard, ShieldCheck, Archive, Ticket } from 'lucide-react';

type AdminTab = 'pulpit' | 'klienci' | 'platnosci' | 'archiwum' | 'vouchery';

const VIEW_TO_TAB: Record<string, AdminTab> = {
  'admin-pulpit':    'pulpit',
  'admin-klienci':   'klienci',
  'admin-platnosci': 'platnosci',
  'admin-archiwum':  'archiwum',
  'admin-vouchery':  'vouchery',
};

const TAB_TO_VIEW: Record<AdminTab, string> = {
  pulpit:    'admin-pulpit',
  klienci:   'admin-klienci',
  platnosci: 'admin-platnosci',
  archiwum:  'admin-archiwum',
  vouchery:  'admin-vouchery',
};

interface Props {
  currentView: string;
  onViewChange?: (view: string) => void;
}

export const DashboardAdminNew: React.FC<Props> = ({ currentView, onViewChange }) => {
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
  ];

  return (
    <div
      className="-m-4 md:-m-8 min-h-screen"
      style={{ backgroundColor: '#f3f4f6', fontFamily: '"Segoe UI", system-ui, sans-serif' }}
    >
      {/* ── TOP BAR (identyczny styl jak HR) ─────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 flex items-center justify-between" style={{ height: 48 }}>
        <div className="flex items-center gap-3">
          <ShieldCheck size={16} className="text-blue-600" />
          <span className="font-semibold text-gray-800 text-sm">Panel Administracyjny</span>
          <span className="text-gray-300">|</span>
          <span className="text-xs text-gray-500">Platforma Centralna</span>
        </div>
      </div>

      {/* ── TAB BAR (identyczny styl jak HR) ─────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6">
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
      </div>
    </div>
  );
};
