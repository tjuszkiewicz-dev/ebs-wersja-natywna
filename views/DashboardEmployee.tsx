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
import { SupportTicketSystem } from '../components/support/SupportTicketSystem';
import { EmployeeGuide } from '../components/employee/dashboard/EmployeeGuide';
import { MentalHealthDashboard } from '../components/employee/dashboard/MentalHealthDashboard';
import { LegalAssistantDashboard } from '../components/employee/dashboard/LegalAssistantDashboard';
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
  Scale, ShieldCheck, X, Zap, Building2, HeartPulse, MessageSquare
} from 'lucide-react';
import { useStrattonSystem } from '../context/StrattonContext';
import { Button } from '../components/ui/Button';
import { usePersistedState } from '../hooks/usePersistedState';
import { SectionDivider, AppIconCard, FloatingTabBar } from '../components/employee/dashboard/EmployeeWidgets';

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
    else if (currentView === 'emp-catalog') {
      if (activeTab !== 'CATALOG') setActiveTab('CATALOG');
      if (!isScrollingRef.current) {
        setTimeout(() => {
          const el = document.getElementById('catalog-anchor');
          if (el) { const r = el.getBoundingClientRect(); if (Math.abs(r.top) > 100) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        }, 100);
      }
    } else if (currentView === 'emp-dashboard') {
      if (activeTab !== 'WALLET') setActiveTab('WALLET');
      if (!isScrollingRef.current) sc.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentView]);

  useEffect(() => {
    const handle = () => {
      if (['HISTORY', 'SUPPORT', 'WELLBEING', 'LEGAL', 'ACTIVE_SERVICES'].includes(activeTab)) return;
      isScrollingRef.current = true;
      if ((window as any)._scrollT) clearTimeout((window as any)._scrollT);
      (window as any)._scrollT = setTimeout(() => { isScrollingRef.current = false; }, 150);
      const anchor = document.getElementById('catalog-anchor');
      if (!anchor || !onViewChange) return;
      const isCat = anchor.getBoundingClientRect().top < window.innerHeight * 0.8;
      if (isCat && currentView !== 'emp-catalog') onViewChange('emp-catalog');
      else if (!isCat && currentView !== 'emp-dashboard') onViewChange('emp-dashboard');
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
            <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20 shadow-sm flex flex-col justify-center">
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
          {quickActions.map(({ id, label, icon: Icon, color, bg }) => (
            <motion.button
              key={id}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl font-bold text-sm flex-shrink-0 snap-start border border-white shadow-sm"
              style={{ background: bg, color }}
              onClick={() => {
                if (id === 'health') document.getElementById('section-luxmed')?.scrollIntoView({ behavior: 'smooth' });
                if (id === 'insurance') document.getElementById('section-insurance')?.scrollIntoView({ behavior: 'smooth' });
                if (id === 'telecom') document.getElementById('section-orange')?.scrollIntoView({ behavior: 'smooth' });
                if (id === 'wellbeing') wellbeingService && setSelectedService(wellbeingService);
              }}
            >
              <Icon size={17} />
              {label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Twoje Aplikacje */}
      <div>
        <SectionDivider title="Twoje Aplikacje" subtitle="Zarzadzane przez Eliton" accent="#7C3AED" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AppIconCard
            icon={<Brain size={24} style={{ color: '#7C3AED' }} />}
            name="Wellbeing"
            desc="AI Coach, medytacje i sesje deep work."
            gradient="linear-gradient(135deg,#f5f3ff,#ede9fe)"
            image="https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=600"
            hasAccess={hasMentalHealthAccess}
            price={100}
            onClick={() => hasMentalHealthAccess ? setActiveTab('WELLBEING') : wellbeingService && setSelectedService(wellbeingService)}
          />
          <AppIconCard
            icon={<Scale size={24} style={{ color: '#b45309' }} />}
            name="AI Prawnik"
            desc="Analiza umow i porady prawne 24/7."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            image="https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=600"
            hasAccess={hasLegalAccess}
            price={150}
            onClick={() => hasLegalAccess ? setActiveTab('LEGAL') : legalService && setSelectedService(legalService)}
          />
          <AppIconCard
            icon={<Lock size={24} style={{ color: '#16a34a' }} />}
            name="Secure Messenger"
            desc="Szyfrowana komunikacja end-to-end."
            gradient="linear-gradient(135deg,#f0fdf4,#dcfce7)"
            image="https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&q=80&w=600"
            hasAccess={hasSecureMessengerAccess}
            price={200}
            onClick={() => hasSecureMessengerAccess ? setActiveTab('SECURE_MESSENGER') : setSelectedService(secureMessengerService)}
          />
          <AppIconCard
            icon={<ShieldCheck size={24} style={{ color: '#2563EB' }} />}
            name="Digital Vault"
            desc="Prywatny sejf cyfrowy 10 GB. AES-256."
            gradient="linear-gradient(135deg,#eff6ff,#dbeafe)"
            image="https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=600"
            hasAccess={hasVaultAccess}
            price={50}
            onClick={() => hasVaultAccess ? setActiveTab('DIGITAL_VAULT') : setSelectedService(vaultService)}
          />
        </div>
      </div>

      {/* Strefa Partnerow */}
      <div>
        <SectionDivider title="Strefa Partnerow" subtitle="Ekskluzywne oferty dla pracownikow EBS" accent="#22C55E" />
        <div className="rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-sm overflow-hidden divide-y divide-white/10">
          <div id="section-luxmed" className="px-6 md:px-8">
            <LuxMedSection onSelect={(pkg) => handlePartnerRequest('LuxMed', pkg)} />
          </div>
          <div className="px-6 md:px-8">
            <SignalIdunaSection onSelect={(plan) => handlePartnerRequest('Signal Iduna', plan)} />
          </div>
          <div id="section-orange" className="px-6 md:px-8">
            <OrangePartnerSection onSelect={(offer) => handlePartnerRequest('Orange', offer)} />
          </div>
          <div className="px-6 md:px-8">
            <PZUPartnerSection onSelect={(product) => handlePartnerRequest('PZU', product)} />
          </div>
          <div id="section-insurance" className="px-6 md:px-8">
            <InsurancePartnersGrid onSelect={(partner, product) => handlePartnerRequest(partner, product)} />
          </div>
        </div>
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
                  {t.type === 'CREDIT' ? '+' : '-'}{t.amount} pkt
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
            <p className="text-white/70">{count > 0 ? `Korzystasz z ${count} usług EBS.` : 'Nie aktywowałeś jeszcze żadnych usług.'}</p>
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
      <AnimatePresence mode="wait">
        {(activeTab === 'WALLET' || activeTab === 'CATALOG') && (
          <div key="wallet-catalog" className="space-y-12">
            <div id="section-wallet">{renderWallet()}</div>
            <div id="catalog-anchor" className="flex items-center gap-4 py-4">
              <div className="h-px flex-1 bg-white/20" />
              <span className="text-sm font-bold text-white/40 uppercase tracking-widest">Katalog Uslug</span>
              <div className="h-px flex-1 bg-white/20" />
            </div>
            <div className="min-h-[600px]">
              <ServiceCatalog
                services={displayServices}
                userBalance={user.voucherBalance}
                onPurchase={setSelectedService}
              />
            </div>
            <div className="text-center py-8">
              <div className="w-2 h-2 rounded-full mx-auto bg-gray-300" />
            </div>
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
    </div>
  );
};
