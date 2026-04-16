import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Voucher, VoucherStatus, BuybackAgreement, ServiceItem,
  Transaction, UserFinance, ServiceType
} from '../types';
import { ServiceCatalog } from '../components/employee/dashboard/ServiceCatalog';
import { EmployeeTransactionHistory } from '../components/employee/dashboard/EmployeeTransactionHistory';
import { EmployeeBuybackList } from '../components/employee/dashboard/EmployeeBuybackList';
import { RedemptionModal } from '../components/employee/RedemptionModal';
import { WalletCard } from '../components/employee/mobile/WalletCard';
import StarBorder from '../components/bits/StarBorder/StarBorder';
import { SupportTicketSystem } from '../components/support/SupportTicketSystem';
import { EmployeeGuide } from '../components/employee/dashboard/EmployeeGuide';
import { MentalHealthDashboard } from '../components/employee/dashboard/MentalHealthDashboard';
import dynamic from 'next/dynamic';
const LegalAssistantDashboard = dynamic(
  () => import('../components/employee/dashboard/LegalAssistantDashboard').then(m => m.LegalAssistantDashboard),
  { ssr: false }
);
import { SecureMessengerWidget } from '../components/employee/dashboard/secure-messenger/SecureMessengerWidget';
import { SecureDigitalVaultWidget } from '../components/employee/dashboard/digital-vault/SecureDigitalVaultWidget';
import { DigitalVaultApp } from '../components/employee/dashboard/digital-vault/DigitalVaultApp';
import { VoucherExpiryBanner } from '../components/employee/dashboard/VoucherExpiryBanner';
import { LuxMedSection } from '../components/employee/dashboard/partners/LuxMedSection';
import { SignalIdunaSection } from '../components/employee/dashboard/partners/SignalIdunaSection';
import { OrangePartnerSection } from '../components/employee/dashboard/partners/OrangePartnerSection';
import { PZUPartnerSection } from '../components/employee/dashboard/partners/PZUPartnerSection';
import { InsurancePartnersGrid } from '../components/employee/dashboard/partners/InsurancePartnersGrid';
import {
  Wallet, History, Grid, Lock, Brain,
  Scale, ShieldCheck, X, Zap, Building2, HeartPulse, MessageSquare, Shield, Users, Moon, Heart, Smartphone
, Plane, Compass, Utensils, Baby, Landmark, UserCheck, TrendingUp, ShoppingCart } from 'lucide-react';
import { useStrattonSystem } from '../context/StrattonContext';
import { Button } from '../components/ui/Button';
import { usePersistedState } from '../hooks/usePersistedState';
import { SectionDivider, AppIconCard, FloatingTabBar } from '../components/employee/dashboard/EmployeeWidgets';
import { ServiceCarousel } from '../components/ui/ServiceCarousel';

/* Types */
interface Props {
  currentView: string;
  user: User;
  vouchers: Voucher[];
  buybacks: BuybackAgreement[];
  services: ServiceItem[];
  transactions: Transaction[];
  onViewChange?: (view: string) => void;
  onPurchaseService: (service: ServiceItem) => void;
  onViewAgreement: (agreement: BuybackAgreement) => void;
}

type Tab = 'WALLET' | 'ACTIVE_SERVICES' | 'CATALOG' | 'HISTORY' | 'SUPPORT'
         | 'WELLBEING' | 'LEGAL' | 'SECURE_MESSENGER' | 'DIGITAL_VAULT';

const TABS = [
  { id: 'WALLET', icon: Wallet, label: 'Pulpit' },
  { id: 'CATALOG', icon: Grid, label: 'Katalog' },
  { id: 'ACTIVE_SERVICES', icon: Zap, label: 'Moje' },
  { id: 'HISTORY', icon: History, label: 'Historia' },
  { id: 'SUPPORT', icon: MessageSquare, label: 'Pomoc' },
] as const;

const quickActions = [
  { id: 'health', label: 'Opieka medyczna', icon: HeartPulse, color: '#16a34a', bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)' },
  { id: 'insurance', label: 'Ubezpieczenia', icon: ShieldCheck, color: '#2563EB', bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)' },
  { id: 'telecom', label: 'Telekomunikacja', icon: Building2, color: '#ea580c', bg: 'linear-gradient(135deg,#fff7ed,#fed7aa)' },
  { id: 'wellbeing', label: 'Wellbeing', icon: Brain, color: '#7C3AED', bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)' },
];

/* MAIN COMPONENT */
export const DashboardEmployee: React.FC<Props> = ({
  currentView, user, vouchers, buybacks, services,
  transactions, onViewChange, onPurchaseService, onViewAgreement
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('WALLET');
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [showGuide, setShowGuide] = usePersistedState<boolean>('ebs_guide_employee_v1', true);
  const isScrollingRef = useRef(false);

  const { state, actions } = useStrattonSystem();
  const { tickets } = state;

  useEffect(() => {
    const sc = document.getElementById('main-scroll-container') || window;
    if (currentView === 'emp-history') { setActiveTab('HISTORY'); sc.scrollTo({ top: 0 }); }
    else if (currentView === 'emp-active-services') { setActiveTab('ACTIVE_SERVICES'); sc.scrollTo({ top: 0 }); }
    else if (currentView === 'emp-support') { setActiveTab('SUPPORT'); sc.scrollTo({ top: 0 }); }
    else if (currentView.startsWith('emp-')) {
      if (activeTab !== 'CATALOG') setActiveTab('CATALOG');
      if (!isScrollingRef.current) {
        setTimeout(() => {
          const elName = currentView.replace('emp-', 'sec-emp-');
          const el = document.getElementById(elName);
          if (el) { const r = el.getBoundingClientRect(); if (Math.abs(r.top) > 100) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        }, 100);
      }
    }
  }, [currentView]);

  useEffect(() => {
    const handle = () => {
      if (['HISTORY', 'SUPPORT', 'WELLBEING', 'LEGAL', 'ACTIVE_SERVICES'].includes(activeTab)) return;
      isScrollingRef.current = true;
      if ((window as any)._scrollT) clearTimeout((window as any)._scrollT);
      (window as any)._scrollT = setTimeout(() => { isScrollingRef.current = false; }, 150);

      const sections = ['sec-emp-ebooki', 'sec-emp-poradniki', 'sec-emp-wellbeing', 'sec-emp-goldman', 'sec-emp-multipolisa', 'sec-emp-profitowi', 'sec-emp-twoje-aplikacje'];
      if (!onViewChange) return;

      for (const s of sections) {
        const el = document.getElementById(s);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight * 0.4) {
            const newView = s.replace('sec-emp-', 'emp-');
            if (currentView !== newView) onViewChange(newView);
            return;
          }
        }
      }
    };
    const sc = document.getElementById('main-scroll-container') || window;
    sc.addEventListener('scroll', handle, { passive: true });
    return () => {
      sc.removeEventListener('scroll', handle);
      if ((window as any)._scrollT) clearTimeout((window as any)._scrollT);
    };
  }, [activeTab, currentView]);

  const hasMentalHealthAccess = useMemo(() => transactions.some(t => t.serviceId === 'SRV-MENTAL-01'), [transactions]);
  const hasLegalAccess = useMemo(() => transactions.some(t => t.serviceId === 'SRV-LEGAL-01'), [transactions]);
  const hasSecureMessengerAccess = useMemo(() => transactions.some(t => t.serviceId === 'SRV-SECURE-01'), [transactions]);
  const hasVaultAccess = useMemo(() => transactions.some(t => t.serviceId === 'SRV-VAULT-01'), [transactions]);

  const displayServices = useMemo(() => services.filter(s => {
    if (s.id === 'SRV-MENTAL-01' && hasMentalHealthAccess) return false;
    if (s.id === 'SRV-LEGAL-01' && hasLegalAccess) return false;
    if (s.id === 'SRV-SECURE-01' && hasSecureMessengerAccess) return false;
    if (s.id === 'SRV-VAULT-01' && hasVaultAccess) return false;
    if (s.id.startsWith('SRV-ORANGE')) return false;
    return true;
  }), [services, hasMentalHealthAccess, hasLegalAccess, hasSecureMessengerAccess, hasVaultAccess]);

  const wellbeingService = useMemo(() => services.find(s => s.id === 'SRV-MENTAL-01'), [services]);
  const legalService = useMemo(() => services.find(s => s.id === 'SRV-LEGAL-01'), [services]);
  const secureMessengerService = useMemo(() => services.find(s => s.id === 'SRV-SECURE-01') ?? { id: 'SRV-SECURE-01', name: 'Secure Messenger', description: 'Szyfrowana komunikacja end-to-end.', price: 200, type: ServiceType.SUBSCRIPTION, icon: 'Shield', isActive: true } as ServiceItem, [services]);
  const vaultService = useMemo(() => services.find(s => s.id === 'SRV-VAULT-01') ?? { id: 'SRV-VAULT-01', name: 'Secure Digital Vault', description: 'Prywatny sejf cyfrowy 10GB. AES-256.', price: 50, type: ServiceType.SUBSCRIPTION, icon: 'HardDrive', isActive: true } as ServiceItem, [services]);

  const handleManualSpend = async (amount: number, description: string) => {
    const s: ServiceItem = { id: `INTERNAL-${Date.now()}`, name: description, description: 'Internal', price: amount, type: ServiceType.ONE_TIME, icon: 'Zap', isActive: true };
    onPurchaseService(s);
  };

  const handlePartnerRequest = (partnerName: string, productName: string) => {
    const s: ServiceItem = {
      id: `PARTNER-${Date.now()}`,
      name: `${partnerName}: ${productName}`,
      description: `Specjalna oferta partnerska od ${partnerName} dla pracowników EBS. Kliknij "Zatwierdź", aby zamówić kontakt z konsultantem.`,
      price: 0,
      type: ServiceType.ONE_TIME,
      icon: 'Shield',
      isActive: true,
    };
    setSelectedService(s);
  };

  /* Full-screen overlays */
  if (activeTab === 'WELLBEING' && hasMentalHealthAccess) {
    return <MentalHealthDashboard currentUser={user} balance={user.voucherBalance} onSpend={handleManualSpend} onExit={() => setActiveTab('WALLET')} />;
  }
  if (activeTab === 'LEGAL' && hasLegalAccess) {
    return <LegalAssistantDashboard currentUser={user} balance={user.voucherBalance} onSpend={handleManualSpend} onExit={() => setActiveTab('WALLET')} />;
  }
  if (activeTab === 'SECURE_MESSENGER' && hasSecureMessengerAccess) {
    return (
      <div className="fixed inset-0 bg-slate-50 z-[100] overflow-hidden flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 text-white p-1.5 rounded-lg"><Lock size={18} /></div>
            <span className="font-bold text-slate-900">STRATTON <span className="text-emerald-600">SECURE</span></span>
          </div>
          <button onClick={() => setActiveTab('WALLET')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto bg-[#f8fafc]">
          <div className="max-w-7xl mx-auto px-4 py-8 h-full">
            <SecureMessengerWidget hasAccess={true} />
          </div>
        </div>
      </div>
    );
  }
  if (activeTab === 'DIGITAL_VAULT' && hasVaultAccess) {
    return (
      <div className="fixed inset-0 bg-slate-50 z-[100] overflow-hidden flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg"><ShieldCheck size={18} /></div>
            <span className="font-bold text-slate-900">DIGITAL <span className="text-indigo-600">VAULT</span></span>
          </div>
          <button onClick={() => setActiveTab('WALLET')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-hidden bg-[#f8fafc]">
          <DigitalVaultApp onClose={() => setActiveTab('WALLET')} />
        </div>
      </div>
    );
  }

  const renderWallet = () => (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-10"
    >
      {/* Voucher expiry banner */}
      {user.companyId && (
        <VoucherExpiryBanner companyId={user.companyId} balance={user.voucherBalance ?? 0} vouchers={vouchers} />
      )}

      {/* Hero Card - mobile */}
      <div className="md:hidden">
        <WalletCard user={user} />
      </div>

      {/* Hero - desktop */}
      <div className="hidden md:grid gap-6 items-start" style={{ gridTemplateColumns: '2fr 3fr' }}>
        <div>
          <WalletCard user={user} />
        </div>
        <div className="grid grid-cols-2 gap-4 h-full">
          {[
            { label: 'Aktywne uslugi', value: [hasMentalHealthAccess, hasLegalAccess, hasSecureMessengerAccess, hasVaultAccess].filter(Boolean).length, unit: 'szt.', color: '#7C3AED' },
            { label: 'Transakcje', value: transactions.length, unit: 'lacznie', color: '#2563EB' },
            { label: 'Vouchery', value: vouchers.filter(v => v.status === VoucherStatus.DISTRIBUTED).length, unit: 'aktywnych', color: '#16a34a' },
            { label: 'Partnerzy', value: 14, unit: 'dostepnych', color: '#ea580c' },
          ].map(({ label, value, unit, color }) => (
            <div key={label} className="rounded-2xl p-5 border border-white/10 shadow-sm flex flex-col justify-center backdrop-blur-md" style={{ background: 'rgba(5, 8, 15, 0.72)' }}>
              <p className="text-2xl font-black" style={{ color }}>{value}</p>
              <p className="text-xs font-bold text-white/50 uppercase tracking-wider">{unit}</p>
              <p className="text-sm font-semibold text-white/70 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <SectionDivider title="Szybki dostep" accent="#2563EB" />
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1 snap-x snap-mandatory">
          {quickActions.map(({ id, label, icon: Icon }) => (
            <StarBorder
              key={id}
              color="#10b981"
              speed="6s"
              thickness={2}
              className="flex-shrink-0 snap-start"
              onClick={() => {
                if (id === 'health') document.getElementById('section-luxmed')?.scrollIntoView({ behavior: 'smooth' });
                if (id === 'insurance') document.getElementById('section-insurance')?.scrollIntoView({ behavior: 'smooth' });
                if (id === 'telecom') document.getElementById('section-orange')?.scrollIntoView({ behavior: 'smooth' });
                if (id === 'wellbeing') wellbeingService && setSelectedService(wellbeingService);
              }}
            >
              <Icon size={17} />
              {label}
            </StarBorder>
          ))}
        </div>

        <div id="catalog-anchor" className="flex items-center gap-4 py-4 w-full select-none mt-4">
          <div className="h-px flex-1 bg-white/20" />
          <span className="text-sm font-bold text-white/50 uppercase tracking-widest">Katalog Usług</span>
          <div className="h-px flex-1 bg-white/20" />
        </div>
      </div>

      {/* Twoje Aplikacje */}
        <div id="sec-emp-twoje-aplikacje" className="!mt-4">
        <SectionDivider title="Twoje Aplikacje" subtitle="Zarządzane przez Eliton" accent="#7C3AED" />
        <ServiceCarousel>
          <AppIconCard
            icon={<Brain size={24} style={{ color: '#7C3AED' }} />}
            image="/coach.png"
            name="Wellbeing"
            desc="AI Coach, medytacje i sesje deep work."
            gradient="linear-gradient(135deg,#f5f3ff,#ede9fe)"
            hasAccess={hasMentalHealthAccess}
            price={100}
            onClick={() => hasMentalHealthAccess ? setActiveTab('WELLBEING') : wellbeingService && setSelectedService(wellbeingService)}
          />
          <AppIconCard
            icon={<Scale size={24} style={{ color: '#b45309' }} />}
            image="/prawnik.png"
            name="AI Prawnik"
            desc="Analiza umów i porady prawne 24/7."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={hasLegalAccess}
            price={150}
            onClick={() => hasLegalAccess ? setActiveTab('LEGAL') : legalService && setSelectedService(legalService)}
          />
          <AppIconCard
            icon={<Lock size={24} style={{ color: '#16a34a' }} />}
            image="/klodka.png"
            name="Secure Messenger"
            desc="Szyfrowana komunikacja end-to-end."
            gradient="linear-gradient(135deg,#f0fdf4,#dcfce7)"
            hasAccess={hasSecureMessengerAccess}
            price={200}
            onClick={() => hasSecureMessengerAccess ? setActiveTab('SECURE_MESSENGER') : setSelectedService(secureMessengerService)}
          />
          <AppIconCard
            icon={<ShieldCheck size={24} style={{ color: '#2563EB' }} />}
            image="/sejf.png"
            name="Digital Vault"
            desc="Prywatny sejf cyfrowy 10 GB. AES-256."
            gradient="linear-gradient(135deg,#eff6ff,#dbeafe)"
            hasAccess={hasVaultAccess}
            price={50}
            onClick={() => hasVaultAccess ? setActiveTab('DIGITAL_VAULT') : setSelectedService(vaultService)}
          />
        </ServiceCarousel>
      </div>

      {/* Profitowi – Ubezpieczenia i Zdrowie */}
      <div id="sec-emp-profitowi">
        <SectionDivider title="Profitowi" subtitle="Ubezpieczenia i Zdrowie" accent="#10B981" />
        <ServiceCarousel>
          <AppIconCard
            icon={<ShieldCheck size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&q=80&w=800"
            name="Luxmed"
            desc="Pakiet Optyka i Rehabilitacja. Szybki dostęp do specjalistów."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Luxmed (Profitowi)', 'Pakiet Optyka i Rehabilitacja')}
          />
          <AppIconCard
            icon={<ShieldCheck size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&q=80&w=800"
            name="PZU"
            desc="Ubezpieczenie NNW Pracownicze. Ochrona całą dobę."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('PZU (Profitowi)', 'Ubezpieczenie NNW Pracownicze')}
          />
          <AppIconCard
            icon={<ShieldCheck size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?auto=format&fit=crop&q=80&w=800"
            name="Uniga"
            desc="Szerokie ubezpieczenie na życie dla rodziny."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Uniga (Profitowi)', 'Ubezpieczenie na Życie')}
          />
          <AppIconCard
            icon={<ShieldCheck size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1522204538344-922f76ecc041?auto=format&fit=crop&q=80&w=800"
            name="Loyds"
            desc="Ubezpieczenie od utraty dochodu dla menedżerów."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Loyds (Profitowi)', 'Ubezpieczenie od Utraty Dochodu')}
          />
        </ServiceCarousel>
      </div>

      {/* Multipolisa.pl – Ubezpieczenia i zdrowie */}
      <div id="sec-emp-multipolisa">
        <SectionDivider title="Multipolisa.pl" subtitle="Ubezpieczenia i zdrowie" accent="#F59E0B" />
        <ServiceCarousel>
          <AppIconCard
            icon={<Shield size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800"
            name="Ergo Hestia"
            desc="Pakiet Bezpieczny Dom od wszelkich zdarzeń."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Ergo Hestia (Multipolisa)', 'Pakiet Bezpieczny Dom')}
          />
          <AppIconCard
            icon={<Shield size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800"
            name="Warta"
            desc="Ubezpieczenie turystyczne na delegacje i wakacje."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Warta (Multipolisa)', 'Ubezpieczenie Turystyczne')}
          />
          <AppIconCard
            icon={<Shield size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=800"
            name="TU Zdrowie"
            desc="Pakiet podstawowych badań i przeglądowy dla aktywnych."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('TU Zdrowie (Multipolisa)', 'Pakiet Badań Profilaktycznych')}
          />
          <AppIconCard
            icon={<Shield size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1542382121-e9de4599fb4b?auto=format&fit=crop&q=80&w=800"
            name="Leadenhall"
            desc="OC w życiu prywatnym, chroni przed pomyłkami na codzień."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Leadenhall (Multipolisa)', 'Ubezpieczenie OC w Życiu Prywatnym')}
          />
        </ServiceCarousel>
      </div>

      {/* Goldman Sachs */}
      <div id="sec-emp-goldman">
        <SectionDivider title="Goldman Sachs" subtitle="Fundusze inwestycyjne" accent="#3B82F6" />
        <ServiceCarousel>
          <AppIconCard
            icon={<span className="font-serif font-bold text-[#1e3a8a] text-[10px] whitespace-nowrap leading-none text-center">Goldman<br/>Sachs</span>}
            image="https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&q=80&w=800"
            name="IKE"
            desc="Indywidualne Konto Emerytalne z korzyściami podatkowymi."
            gradient="linear-gradient(135deg,#eff6ff,#dbeafe)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Goldman Sachs', 'IKE')}
          />
          <AppIconCard
            icon={<span className="font-serif font-bold text-[#1e3a8a] text-[10px] whitespace-nowrap leading-none text-center">Goldman<br/>Sachs</span>}
            image="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=800"
            name="IKZE"
            desc="Indywidualne Konto Zabezpieczenia Emerytalnego."
            gradient="linear-gradient(135deg,#eff6ff,#dbeafe)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Goldman Sachs', 'IKZE')}
          />
          <AppIconCard
            icon={<span className="font-serif font-bold text-[#1e3a8a] text-[10px] whitespace-nowrap leading-none text-center">Goldman<br/>Sachs</span>}
            image=""
            name="Wolne miejsce"
            desc="Wkrótce nowy produkt inwestycyjny."
            gradient="linear-gradient(135deg,#eff6ff,#dbeafe)"
            hasAccess={false}
            price={0}
            onClick={() => {}}
          />
          <AppIconCard
            icon={<span className="font-serif font-bold text-[#1e3a8a] text-[10px] whitespace-nowrap leading-none text-center">Goldman<br/>Sachs</span>}
            image=""
            name="Wolne miejsce"
            desc="Wkrótce nowy produkt inwestycyjny."
            gradient="linear-gradient(135deg,#eff6ff,#dbeafe)"
            hasAccess={false}
            price={0}
            onClick={() => {}}
          />
        </ServiceCarousel>
      </div>

      {/* Wellbeing */}
      <div id="sec-emp-wellbeing">
        <SectionDivider title="Wellbeing" subtitle="Jednorazowe produkty" accent="#10B981" />
        <ServiceCarousel>
          <AppIconCard
            icon={<Smartphone size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?auto=format&fit=crop&q=80&w=800"
            name="Cyfrowy detoks w 15 minut"
            desc="ONE-TIME • Jak odzyskać spokój bez wyrzucania telefonu."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={9}
            onClick={() => handlePartnerRequest('Wellbeing', 'Cyfrowy detoks w 15 minut')}
          />
          <AppIconCard
            icon={<Heart size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1522204538344-922f76ecc041?auto=format&fit=crop&q=80&w=800"
            name="Trening odporności (Resilience)"
            desc="ONE-TIME • Techniki jednostek specjalnych dla korporacji."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={33}
            onClick={() => handlePartnerRequest('Wellbeing', 'Trening odporności na stres')}
          />
          <AppIconCard
            icon={<MessageSquare size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1573497620053-ea5300f94f21?auto=format&fit=crop&q=80&w=800"
            name="Sztuka asertywności na Teamsach"
            desc="ONE-TIME • Jak mówić nie, bez wyrzutów sumienia."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={21}
            onClick={() => handlePartnerRequest('Wellbeing', 'Sztuka asertywności na Teamsach')}
          />
          <AppIconCard
            icon={<Moon size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1511296933631-18b46797e652?auto=format&fit=crop&q=80&w=800"
            name="Sen jako Twój najlepszy projekt"
            desc="ONE-TIME • Biohacking nocnej regeneracji."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={44}
            onClick={() => handlePartnerRequest('Wellbeing', 'Sen jako Twój najlepszy projekt')}
          />
          <AppIconCard
            icon={<Users size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1593642532973-d31b6557fa68?auto=format&fit=crop&q=80&w=800"
            name="Praca z domu i samotność"
            desc="ONE-TIME • Jak budować relacje w trybie remote."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={15}
            onClick={() => handlePartnerRequest('Wellbeing', 'Praca z domu i samotność')}
          />
          <AppIconCard
            icon={<Shield size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=800"
            name="Inwestowanie dla ostrożnych"
            desc="ONE-TIME • Podstawy budowania poduszki."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={28}
            onClick={() => handlePartnerRequest('Wellbeing', 'Inwestowanie dla ostrożnych')}
          />
        </ServiceCarousel>
      </div>


      {/* Poradniki */}
      <div id="sec-emp-poradniki">
        <SectionDivider title="Poradniki" subtitle="Dowiedz się więcej" accent="#F59E0B" />
        <ServiceCarousel>
          <AppIconCard
            icon={<ShoppingCart size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?auto=format&fit=crop&q=80&w=800"
            name="Psychologia zakupów online"
            desc="ONE-TIME • Jak nie dać się zmanipulować algorytmom."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={7}
            onClick={() => handlePartnerRequest('Poradniki', 'Psychologia zakupów online')}
          />
          <AppIconCard
            icon={<TrendingUp size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=800"
            name="Negocjacje podwyżki w 2026"
            desc="ONE-TIME • Nowoczesne argumenty oparte na danych."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={42}
            onClick={() => handlePartnerRequest('Poradniki', 'Negocjacje podwyżki w 2026')}
          />
          <AppIconCard
            icon={<UserCheck size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&q=80&w=800"
            name="Personal Branding wewnątrz firmy"
            desc="ONE-TIME • Jak być widocznym, nie będąc nachalnym."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={19}
            onClick={() => handlePartnerRequest('Poradniki', 'Personal Branding wewnątrz firmy')}
          />
          <AppIconCard
            icon={<Landmark size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1565514020176-6c2235b8b3a9?auto=format&fit=crop&q=80&w=800"
            name="Emerytura 2.0"
            desc="ONE-TIME • Zrozumieć PPK, IKE i IKZE bez bólu głowy."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={36}
            onClick={() => handlePartnerRequest('Poradniki', 'Emerytura 2.0')}
          />
        </ServiceCarousel>
      </div>

      {/* E-booki */}
      <div id="sec-emp-ebooki">
        <SectionDivider title="E-booki" subtitle="Poczytaj sobie" accent="#EC4899" />
        <ServiceCarousel>
          <AppIconCard
            icon={<Baby size={24} style={{ color: '#EC4899' }} />}
            image="https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&q=80&w=800"
            name="Bajka na dobranoc: Robot, który chciał mieć sny"
            desc="ONE-TIME • Audio dla dzieci pracowników."
            gradient="linear-gradient(135deg,#fdf2f8,#fce7f3)"
            hasAccess={false}
            price={11}
            onClick={() => handlePartnerRequest('E-booki', 'Bajka na dobranoc')}
          />
          <AppIconCard
            icon={<Utensils size={24} style={{ color: '#EC4899' }} />}
            image="https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&q=80&w=800"
            name="Kuchnia w 15 minut"
            desc="ONE-TIME • Meal-prep dla zapracowanych."
            gradient="linear-gradient(135deg,#fdf2f8,#fce7f3)"
            hasAccess={false}
            price={24}
            onClick={() => handlePartnerRequest('E-booki', 'Kuchnia w 15 minut')}
          />
          <AppIconCard
            icon={<Compass size={24} style={{ color: '#EC4899' }} />}
            image="https://images.unsplash.com/photo-1455355675860-e883e35ab3a7?auto=format&fit=crop&q=80&w=800"
            name="Hobby zamiast scrollowania"
            desc="ONE-TIME • Jak znaleĹşć pasję, która nie wymaga ekranu."
            gradient="linear-gradient(135deg,#fdf2f8,#fce7f3)"
            hasAccess={false}
            price={17}
            onClick={() => handlePartnerRequest('E-booki', 'Hobby zamiast scrollowania')}
          />
          <AppIconCard
            icon={<Plane size={24} style={{ color: '#EC4899' }} />}
            image="https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=800"
            name="Podróże z nielimitowanym urlopem"
            desc="ONE-TIME • Jak planować workation."
            gradient="linear-gradient(135deg,#fdf2f8,#fce7f3)"
            hasAccess={false}
            price={48}
            onClick={() => handlePartnerRequest('E-booki', 'Podróże z nielimitowanym urlopem')}
          />
          <AppIconCard
            icon={<Users size={24} style={{ color: '#EC4899' }} />}
            image="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=800"
            name="Komunikacja między pokoleniami"
            desc="ONE-TIME • Jak dogadać się z Gen Z i Boomerami."
            gradient="linear-gradient(135deg,#fdf2f8,#fce7f3)"
            hasAccess={false}
            price={39}
            onClick={() => handlePartnerRequest('E-booki', 'Komunikacja między pokoleniami')}
          />
        </ServiceCarousel>
      </div>

      {/* Mobile: recent transactions */}
      <div className="md:hidden">
        <SectionDivider title="Ostatnie Transakcje" accent="#2563EB" />
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-sm overflow-hidden divide-y divide-white/10">
          {transactions.length === 0 ? (
            <p className="text-center text-sm text-white/40 py-8">Brak transakcji</p>
          ) : (
            transactions.slice(0, 5).map(t => (
              <div key={t.id} className="flex justify-between items-center px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${t.type === 'CREDIT' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/60'}`}>
                    {t.type === 'CREDIT' ? '+' : '-'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white/90 leading-tight">{t.serviceName || 'Doladowanie'}</p>
                    <p className="text-[10px] text-white/50">{new Date(t.date).toLocaleDateString('pl-PL')}</p>
                  </div>
                </div>
                <span className={`text-sm font-black ${t.type === 'CREDIT' ? 'text-green-400' : 'text-white/90'}`}>
                  {t.type === 'CREDIT' ? '+' : '-'}{t.amount} vou
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="h-8" />
    </motion.div>
  );

  const renderActiveServices = () => {
    const count = [hasMentalHealthAccess, hasLegalAccess, hasSecureMessengerAccess, hasVaultAccess].filter(Boolean).length;
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-8">
        <div className="rounded-3xl p-8 md:p-12 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)' }}>
          <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div className="relative z-10">
            <h2 className="text-3xl font-black text-white mb-2">Aktywne uslugi</h2>
            <p className="text-white/70">{count > 0 ? `Korzystasz z ${count} usďż˝ug EBS.` : 'Nie aktywowaďż˝eďż˝ jeszcze ďż˝adnych usďż˝ug.'}</p>
          </div>
        </div>
        {count === 0 ? (
          <div className="text-center py-20 bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20">
            <p className="text-white/50 text-sm mb-6">Przejdz do katalogu, aby aktywowac uslugi.</p>
            <Button variant="primary" onClick={() => setActiveTab('CATALOG')}>Przegladaj Katalog</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {hasMentalHealthAccess && <AppIconCard icon={<Brain size={24} style={{ color: '#7C3AED' }} />} name="Wellbeing" desc="AI Coach, medytacje." gradient="linear-gradient(135deg,#f5f3ff,#ede9fe)" hasAccess={true} onClick={() => setActiveTab('WELLBEING')} />}
            {hasLegalAccess && <AppIconCard icon={<Scale size={24} style={{ color: '#b45309' }} />} name="AI Prawnik" desc="Analiza umow 24/7." gradient="linear-gradient(135deg,#fffbeb,#fef3c7)" hasAccess={true} onClick={() => setActiveTab('LEGAL')} />}
            {hasSecureMessengerAccess && <AppIconCard icon={<Lock size={24} style={{ color: '#16a34a' }} />} name="Secure Messenger" desc="Szyfrowana komunikacja." gradient="linear-gradient(135deg,#f0fdf4,#dcfce7)" hasAccess={true} onClick={() => setActiveTab('SECURE_MESSENGER')} />}
            {hasVaultAccess && <AppIconCard icon={<ShieldCheck size={24} style={{ color: '#2563EB' }} />} name="Digital Vault" desc="Sejf cyfrowy 10 GB." gradient="linear-gradient(135deg,#eff6ff,#dbeafe)" hasAccess={true} onClick={() => setActiveTab('DIGITAL_VAULT')} />}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="min-h-full pb-28 md:pb-6">
      {/* 3-column layout: left banner | content | right banner */}
      <div className="hidden xl:grid xl:grid-cols-[240px_1fr_240px] xl:gap-4 xl:items-end" style={{ minHeight: '100vh' }}>
        {/* LEFT BANNER SLOT */}
        <div className="sticky bottom-4 flex flex-col gap-3 pb-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-center text-white/20 text-xs font-medium" style={{ height: 400 }}>
            Baner reklamowy
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden flex items-center justify-center" style={{ height: 200 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/orange.png" alt="Orange" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* CENTER CONTENT */}
        <div>
      <AnimatePresence mode="wait">
        {(activeTab === 'WALLET' || activeTab === 'CATALOG') && (
          <div key="wallet-catalog" className="space-y-12">
            <div id="section-wallet">{renderWallet()}</div>
          </div>
        )}
        {activeTab === 'HISTORY' && (
          <motion.div key="history" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EmployeeTransactionHistory transactions={transactions} />
              <EmployeeBuybackList buybacks={buybacks} onViewAgreement={onViewAgreement} />
            </div>
          </motion.div>
        )}
        {activeTab === 'ACTIVE_SERVICES' && renderActiveServices()}
        {activeTab === 'SUPPORT' && (
          <motion.div key="support" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
            <EmployeeGuide onClose={() => setShowGuide(false)} forceVisible={true} />
            <SupportTicketSystem
              currentUser={user}
              tickets={tickets}
              onCreateTicket={actions.handleCreateTicket}
              onReply={actions.handleReplyTicket}
              onUpdateStatus={actions.handleUpdateTicketStatus}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {selectedService && (
        <RedemptionModal
          isOpen={!!selectedService}
          onClose={() => setSelectedService(null)}
          service={selectedService}
          onConfirm={() => {
            onPurchaseService(selectedService);
            if (selectedService.id === 'SRV-MENTAL-01') setTimeout(() => setActiveTab('WELLBEING'), 1000);
            else if (selectedService.id === 'SRV-LEGAL-01') setTimeout(() => setActiveTab('LEGAL'), 1000);
          }}
        />
      )}

      <FloatingTabBar
        tabs={TABS}
        activeTab={activeTab as string}
        onSelect={(id) => {
          const t = id as Tab;
          setActiveTab(t);
          if (onViewChange) {
            if (t === 'WALLET') onViewChange('emp-dashboard');
            else if (t === 'CATALOG') onViewChange('emp-catalog');
            else if (t === 'HISTORY') onViewChange('emp-history');
            else if (t === 'SUPPORT') onViewChange('emp-support');
          }
          const sc = document.getElementById('main-scroll-container') || window;
          sc.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
        </div>{/* end center content */}

        {/* RIGHT BANNER SLOT */}
        <div className="sticky bottom-4 flex flex-col gap-3 pb-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-center text-white/20 text-xs font-medium" style={{ height: 400 }}>
            Baner reklamowy
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden flex items-center justify-center" style={{ height: 200 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/PZU.png" alt="PZU" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>{/* end xl:grid */}

      {/* MOBILE / tablet fallback (no banners) */}
      <div className="xl:hidden">
        <AnimatePresence mode="wait">
          {(activeTab === 'WALLET' || activeTab === 'CATALOG') && (
            <div key="wallet-catalog-m" className="space-y-12">
              <div id="section-wallet-m">{renderWallet()}</div>
            </div>
          )}
          {activeTab === 'HISTORY' && (
            <motion.div key="history-m" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <EmployeeTransactionHistory transactions={transactions} />
                <EmployeeBuybackList buybacks={buybacks} onViewAgreement={onViewAgreement} />
              </div>
            </motion.div>
          )}
          {activeTab === 'ACTIVE_SERVICES' && renderActiveServices()}
          {activeTab === 'SUPPORT' && (
            <motion.div key="support-m" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
              <EmployeeGuide onClose={() => setShowGuide(false)} forceVisible={true} />
              <SupportTicketSystem
                currentUser={user}
                tickets={tickets}
                onCreateTicket={actions.handleCreateTicket}
                onReply={actions.handleReplyTicket}
                onUpdateStatus={actions.handleUpdateTicketStatus}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {selectedService && (
          <RedemptionModal
            isOpen={!!selectedService}
            onClose={() => setSelectedService(null)}
            service={selectedService}
            onConfirm={() => {
              onPurchaseService(selectedService);
              if (selectedService.id === 'SRV-MENTAL-01') setTimeout(() => setActiveTab('WELLBEING'), 1000);
              else if (selectedService.id === 'SRV-LEGAL-01') setTimeout(() => setActiveTab('LEGAL'), 1000);
            }}
          />
        )}
        <FloatingTabBar
          tabs={TABS}
          activeTab={activeTab as string}
          onSelect={(id) => {
            const t = id as Tab;
            setActiveTab(t);
            if (onViewChange) {
              if (t === 'WALLET') onViewChange('emp-dashboard');
              else if (t === 'CATALOG') onViewChange('emp-catalog');
              else if (t === 'HISTORY') onViewChange('emp-history');
              else if (t === 'SUPPORT') onViewChange('emp-support');
            }
            const sc = document.getElementById('main-scroll-container') || window;
            sc.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </div>
    </div>
  );
};

