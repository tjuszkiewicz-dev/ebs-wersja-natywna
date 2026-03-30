
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { User, Voucher, VoucherStatus, BuybackAgreement, ServiceItem, Transaction, UserFinance, ServiceType } from '../types';
import { ServiceCatalog } from '../components/employee/dashboard/ServiceCatalog';
import { EmployeeTransactionHistory } from '../components/employee/dashboard/EmployeeTransactionHistory';
import { EmployeeBuybackList } from '../components/employee/dashboard/EmployeeBuybackList';
import { RedemptionModal } from '../components/employee/RedemptionModal';
import { MobileNav } from '../components/employee/mobile/MobileNav';
import { WalletCard } from '../components/employee/mobile/WalletCard';
import { SupportTicketSystem } from '../components/support/SupportTicketSystem'; 
import { EmployeeGuide } from '../components/employee/dashboard/EmployeeGuide'; 
import { MentalHealthDashboard } from '../components/employee/dashboard/MentalHealthDashboard';
import { LegalAssistantDashboard } from '../components/employee/dashboard/LegalAssistantDashboard';
import { SecureMessengerWidget } from '../components/employee/dashboard/secure-messenger/SecureMessengerWidget';
import { SecureDigitalVaultWidget } from '../components/employee/dashboard/digital-vault/SecureDigitalVaultWidget';
import { DigitalVaultApp } from '../components/employee/dashboard/digital-vault/DigitalVaultApp';
import { MarketplaceHero } from '../components/employee/dashboard/marketplace/MarketplaceHero';
import { ElitonBanner } from '../components/employee/dashboard/marketplace/ElitonBanner';
import { OrangeOfferSection } from '../components/employee/dashboard/OrangeOfferSection';
import { PZUServiceSection } from '../components/employee/dashboard/PZUServiceSection';
import { Wallet, History, Settings, HelpCircle, Grid, Heart, Lock, Brain, ArrowRight, Scale, ShieldCheck, X } from 'lucide-react';
import { useStrattonSystem } from '../context/StrattonContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { Button } from '../components/ui/Button';
import { usePersistedState } from '../hooks/usePersistedState';

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

type Tab = 'WALLET' | 'ACTIVE_SERVICES' | 'CATALOG' | 'HISTORY' | 'SUPPORT' | 'WELLBEING' | 'LEGAL' | 'SECURE_MESSENGER' | 'DIGITAL_VAULT';

export const DashboardEmployee: React.FC<Props> = ({ 
  currentView,
  user, 
  vouchers, 
  buybacks, 
  services,
  transactions,
  onViewChange,
  onPurchaseService, 
  onViewAgreement 
}) => {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<Tab>('WALLET');
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Guide State - Persisted
  const [showGuide, setShowGuide] = usePersistedState<boolean>('ebs_guide_employee_v1', true);
  
  // Flags for One Pager Navigation
  const isScrollingRef = useRef(false);

  // --- CONTEXT ---
  const { state, actions } = useStrattonSystem();
  const { tickets } = state;

  // --- SYNC WITH PARENT & SCROLL LOGIC ---
  useEffect(() => {
    // 1. Sync activeTab if changed externally via Sidebar/Props
    // Only process if we are not actively scrolling
    const scrollContainer = document.getElementById('main-scroll-container') || window;

    if (currentView === 'emp-history') {
        setActiveTab('HISTORY');
        scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
    }
    else if (currentView === 'emp-active-services') {
        setActiveTab('ACTIVE_SERVICES');
        scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
    }
    else if (currentView === 'emp-support') {
        setActiveTab('SUPPORT');
        scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
    }
    else if (currentView === 'emp-catalog') {
        // Just ensure we are in the "Long Page" mode.
        if (activeTab !== 'CATALOG') {
            setActiveTab('CATALOG');
        }

        // If NOT scrolling manually (i.e. clicked from sidebar), scroll to anchor.
        if (!isScrollingRef.current) {
             setTimeout(() => {
                 const element = document.getElementById('catalog-anchor');
                 if (element) {
                     const rect = element.getBoundingClientRect();
                     if (Math.abs(rect.top) > 100) {
                         element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                     }
                 }
             }, 100);
        }
    }
    else if (currentView === 'emp-dashboard') {
        if (activeTab !== 'WALLET') {
             setActiveTab('WALLET');
        }
        
        // Scroll to top if clicked explicitly (not via spy)
        if (!isScrollingRef.current) {
            scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
  }, [currentView]);

  // --- SCROLL SPY ---
  useEffect(() => {
    const handleScroll = () => {
        // Only trigger Spy logic if we are in the main "Long Page" mode (Wallet + Catalog)
        if (activeTab === 'HISTORY' || activeTab === 'SUPPORT' || activeTab === 'WELLBEING' || activeTab === 'LEGAL' || activeTab === 'ACTIVE_SERVICES') return;

        isScrollingRef.current = true;
        
        // Use timeout to reset scrolling flag
        if ((window as any).scrollTimeout) clearTimeout((window as any).scrollTimeout);
        (window as any).scrollTimeout = setTimeout(() => { isScrollingRef.current = false; }, 150);

        const catalogAnchor = document.getElementById('catalog-anchor');
        if (!catalogAnchor || !onViewChange) return;

        const rect = catalogAnchor.getBoundingClientRect();
        
        // LOGIC REFINEMENT:
        // We want the sidebar to switch to "Catalog" as soon as the Catalog section dominates the screen.
        // If the anchor (header) is above the bottom 1/3rd of screen, we are effectively "in" the catalog.
        // Using window.innerHeight * 0.8 is aggressive but ensures earlier switch.
        
        const threshold = window.innerHeight * 0.8; 
        const isCatalogActive = rect.top < threshold; 

        if (isCatalogActive && currentView !== 'emp-catalog') {
            onViewChange('emp-catalog');
        } 
        else if (!isCatalogActive && currentView !== 'emp-dashboard') {
             // If we scroll UP and the catalog header pushes near bottom or off screen, switch to dashboard
             onViewChange('emp-dashboard');
        }
    };

    // ATTACH TO MAIN SCROLL CONTAINER IF EXISTS, ELSE WINDOW
    const scrollContainer = document.getElementById('main-scroll-container') || window;
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
        if ((window as any).scrollTimeout) clearTimeout((window as any).scrollTimeout);
    };
  }, [activeTab, currentView]); // Needs currentView to prevent infinite loops

  // Rest of logic...
  const activeVouchers = useMemo(() => vouchers.filter(v => v.status === VoucherStatus.DISTRIBUTED || v.status === VoucherStatus.RESERVED), [vouchers]);
  
  
  const expiringSoon = activeVouchers.filter(v => {
    if(!v.expiryDate) return false;
    const daysLeft = (new Date(v.expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24);
    return daysLeft < 3 && daysLeft > 0;
  });

  // Check for Access
  const hasMentalHealthAccess = useMemo(() => {
      return transactions.some(t => t.serviceId === 'SRV-MENTAL-01');
  }, [transactions]);

  const hasLegalAccess = useMemo(() => {
      return transactions.some(t => t.serviceId === 'SRV-LEGAL-01');
  }, [transactions]);

  const hasSecureMessengerAccess = useMemo(() => {
      return transactions.some(t => t.serviceId === 'SRV-SECURE-01');
  }, [transactions]);

  const hasVaultAccess = useMemo(() => {
    return transactions.some(t => t.serviceId === 'SRV-VAULT-01');
  }, [transactions]);

  // Filter Catalog (Hide Purchased Subscriptions)
  const displayServices = useMemo(() => {
      return services.filter(s => {
          if (s.id === 'SRV-MENTAL-01' && hasMentalHealthAccess) return false;
          if (s.id === 'SRV-LEGAL-01' && hasLegalAccess) return false;
          if (s.id === 'SRV-SECURE-01' && hasSecureMessengerAccess) return false;
          if (s.id === 'SRV-VAULT-01' && hasVaultAccess) return false;
          if (s.id.startsWith('SRV-ORANGE')) return false; // Hide Orange services from generic catalog
          return true;
      });
  }, [services, hasMentalHealthAccess, hasLegalAccess, hasSecureMessengerAccess, hasVaultAccess]);

  // Identify Services for Quick Purchase
  const wellbeingService = useMemo(() => services.find(s => s.id === 'SRV-MENTAL-01'), [services]);
  const legalService = useMemo(() => services.find(s => s.id === 'SRV-LEGAL-01'), [services]);
  // Mock secure messenger service if not in DB yet
  const secureMessengerService = useMemo(() => {
      const existing = services.find(s => s.id === 'SRV-SECURE-01');
      if (existing) return existing;
      
      return {
          id: 'SRV-SECURE-01',
          name: 'Secure Messenger',
          description: 'Szyfrowana komunikacja end-to-end. Prywatne czaty i samoniszczące się notatki.',
          price: 200,
          type: ServiceType.SUBSCRIPTION,
          icon: 'Shield',
          isActive: true
      } as ServiceItem;
  }, [services]);

  const vaultService = useMemo(() => {
    const existing = services.find(s => s.id === 'SRV-VAULT-01');
    if (existing) return existing;
    
    return {
        id: 'SRV-VAULT-01',
        name: 'Secure Digital Vault',
        description: 'Prywatny sejf cyfrowy 10GB. Szyfrowanie AES-256.',
        price: 50,
        type: ServiceType.SUBSCRIPTION,
        icon: 'HardDrive',
        isActive: true
    } as ServiceItem;
  }, [services]);

  const handleUpdateFinance = (financeData: UserFinance) => {
      actions.handleUpdateUserFinance(user.id, financeData);
  };

  const handleManualSpend = async (amount: number, description: string) => {
      // Manual spend for internal app features (pay-per-use inside app)
      const tempService: ServiceItem = {
          id: `INTERNAL-${Date.now()}`,
          name: description,
          description: 'Internal App Usage',
          price: amount,
          type: ServiceType.ONE_TIME,
          icon: 'Zap',
          isActive: true
      };
      onPurchaseService(tempService);
  };

  // --- RENDERING SUB-VIEWS ---

  const renderWallet = () => (
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          
          {/* MOBILE: Wallet Card */}
          <div className="md:hidden">
              <WalletCard user={user} />
          </div>

          {/* MARKETPLACE GRID REMOVED PER USER REQUEST */}


          {/* APPS GRID */}
          <div className="pt-8 pb-12" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold tracking-tight ebs-grad-text">Twoje Narzędzia</h3>
                <span className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider hidden md:block" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                   Zarządzane przez Eliton
                </span>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              
              {/* WELLBEING APP */}
              {hasMentalHealthAccess ? (
                  <div 
                    onClick={() => setActiveTab('WELLBEING')}
                    className="group relative cursor-pointer hover:-translate-y-1.5 transition-all duration-300 z-0 h-full"
                  >
                      {/* Glow Underneath */}
                      <div className="absolute -bottom-6 left-4 right-4 h-6 bg-indigo-600 rounded-[100%] blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-300 -z-10"></div>

                      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg border border-indigo-700 h-full flex flex-col justify-between">
                          {/* Background Image & Overlay */}
                          <div className="absolute inset-0 bg-cover bg-center transform group-hover:scale-105 transition-transform duration-700" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=1000)' }}></div>
                          <div className="absolute inset-0 bg-indigo-900/80 backdrop-blur-[2px] group-hover:bg-indigo-900/70 transition-colors"></div>

                          <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform origin-bottom"></div>
                          <div className="relative z-10 flex justify-between items-center h-full">
                              <div>
                                  <div className="flex items-center gap-2 mb-2">
                                      <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wider">
                                          Dostęp Aktywny
                                      </span>
                                  </div>
                                  <h3 className="text-xl font-bold flex items-center gap-2">
                                      <Brain className="text-indigo-300" size={24}/> Wellbeing
                                  </h3>
                                  <p className="text-indigo-200 text-sm mt-1 max-w-sm">
                                      Twoje centrum zdrowia psychicznego. AI Coach, medytacje i sesje deep work.
                                  </p>
                              </div>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div 
                    onClick={() => wellbeingService && setSelectedService(wellbeingService)}
                    className="group relative cursor-pointer hover:-translate-y-1.5 transition-all duration-300 z-0 h-full"
                  >
                        {/* Glow Underneath */}
                      <div className="absolute -bottom-6 left-4 right-4 h-6 bg-indigo-400 rounded-[100%] blur-2xl opacity-0 group-hover:opacity-50 transition-opacity duration-300 -z-10"></div>

                     <div className="relative overflow-hidden rounded-2xl p-6 transition-all h-full flex flex-col justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(99,102,241,0.4)' }}>
                        <div className="flex justify-between items-center w-full">
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-xl group-hover:scale-110 transition-transform" style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
                                    <Heart size={24} className="fill-current"/>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'white' }}>
                                        Wellbeing
                                        <Lock size={14} style={{ color: 'rgba(255,255,255,0.4)' }}/>
                                    </h3>
                                    <p className="text-sm mt-1 max-w-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                        Zadbaj o swój spokój. AI Terapeuta i redukcja stresu.
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-xl font-bold" style={{ color: '#60a5fa' }}>100 pkt</span>
                                <span className="text-xs uppercase font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>Mies.</span>
                            </div>
                        </div>
                     </div>
                  </div>
              )}

              {/* LEGAL APP */}
              {hasLegalAccess ? (
                  <div 
                    onClick={() => setActiveTab('LEGAL')}
                    className="group relative cursor-pointer hover:-translate-y-1.5 transition-all duration-300 z-0 h-full"
                  >
                      {/* Glow Underneath */}
                      <div className="absolute -bottom-6 left-4 right-4 h-6 bg-slate-900 rounded-[100%] blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-300 -z-10"></div>

                      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg border border-slate-700 h-full flex flex-col justify-between">
                          {/* Background Image & Overlay */}
                          <div className="absolute inset-0 bg-cover bg-center transform group-hover:scale-105 transition-transform duration-700" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=1000)' }}></div>
                          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-[1px] group-hover:bg-slate-900/80 transition-colors"></div>

                          <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 -skew-x-12 transform origin-top"></div>
                          <div className="relative z-10 flex justify-between items-center h-full">
                              <div>
                                  <div className="flex items-center gap-2 mb-2">
                                      <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30 uppercase tracking-wider">
                                          Legalny Spokój
                                      </span>
                                  </div>
                                  <h3 className="text-xl font-bold flex items-center gap-2">
                                      <Scale className="text-amber-300" size={24}/> AI Prawnik
                                  </h3>
                                  <p className="text-slate-300 text-sm mt-1 max-w-sm">
                                      Analiza umów, generator pism i porady prawne 24/7.
                                  </p>
                              </div>
                              <div className="bg-white/10 p-3 rounded-full group-hover:bg-white/20 transition-colors">
                                  <ArrowRight size={24} className="text-white"/>
                              </div>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div 
                    onClick={() => legalService && setSelectedService(legalService)}
                    className="group relative cursor-pointer hover:-translate-y-1.5 transition-all duration-300 z-0 h-full"
                  >
                      {/* Glow Underneath */}
                      <div className="absolute -bottom-6 left-4 right-4 h-6 bg-slate-400 rounded-[100%] blur-2xl opacity-0 group-hover:opacity-50 transition-opacity duration-300 -z-10"></div>

                      <div className="relative overflow-hidden rounded-2xl p-6 transition-all h-full flex flex-col justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(99,102,241,0.4)' }}>
                          <div className="flex justify-between items-center w-full">
                              <div className="flex items-start gap-4">
                                  <div className="p-3 rounded-xl group-hover:scale-110 transition-transform" style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
                                      <ShieldCheck size={24} />
                                  </div>
                                  <div>
                                      <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'white' }}>
                                          AI Legal Assistant
                                          <Lock size={14} style={{ color: 'rgba(255,255,255,0.4)' }}/>
                                      </h3>
                                      <p className="text-sm mt-1 max-w-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                          Twój osobisty prawnik. Analiza umów i pism w 60 sekund.
                                      </p>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <span className="block text-xl font-bold" style={{ color: '#60a5fa' }}>150 pkt</span>
                                  <span className="text-xs uppercase font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>Mies.</span>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {/* SECURE MESSENGER APP */}
              <div className="h-full col-span-1 md:col-span-2 lg:col-span-1">
                <SecureMessengerWidget 
                    hasAccess={hasSecureMessengerAccess}
                    price={200}
                    onPurchase={() => setSelectedService(secureMessengerService)}
              />
              </div>

              {/* SECURE DIGITAL VAULT APP */}
              <div className="h-full col-span-1 md:col-span-2 lg:col-span-1">
              <SecureDigitalVaultWidget 
                hasAccess={hasVaultAccess}
                price={50}
                onPurchase={() => setSelectedService(vaultService)}
              />
              </div>

          </div>
          </div>

          {/* ORANGE OFFER SECTION */}
          <div className="pt-12 pb-12" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold tracking-tight ebs-grad-text">Strefa Partnerów</h3>
                 <span className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider" style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}>
                   Oferty Specjalne
                </span>
             </div>

             <div className="space-y-12">
                <OrangeOfferSection 
                    services={services}
                    onPurchase={setSelectedService}
                />

                <PZUServiceSection
                    onCheckOffer={(category) => {
                        const tempService: ServiceItem = {
                            id: `PZU-${category}`,
                            name: `Ubezpieczenie PZU: ${category}`,
                            description: 'Specjalna oferta dla pracowników. Kliknij "Zatwierdź", aby zamówić kontakt z agentem.',
                            price: 0,
                            type: ServiceType.ONE_TIME,
                            icon: 'Shield',
                            isActive: true
                        };
                        setSelectedService(tempService);
                    }}
                />
             </div>
          </div>

          <ElitonBanner />


          {/* Catalog Preview (Mobile Only - Full View is separate tab) */}
          <div className="md:hidden">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800">Polecane Usługi</h3>
                  <button onClick={() => setActiveTab('CATALOG')} className="text-xs text-emerald-600 font-bold">Zobacz wszystkie</button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                  {displayServices.slice(0, 4).map(s => (
                      <div key={s.id} onClick={() => setSelectedService(s)} className="min-w-[140px] bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center text-center active:scale-95 transition-transform">
                          <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-xl mb-2">🎁</div>
                          <p className="text-xs font-bold text-slate-700 leading-tight line-clamp-2 h-8">{s.name}</p>
                          <p className="text-emerald-600 font-bold text-sm mt-1">{s.price} pkt</p>
                      </div>
                  ))}
              </div>
          </div>

          {/* Recent History (Mobile Only) */}
          <div className="md:hidden">
              <h3 className="font-bold text-slate-800 mb-4">Ostatnie Transakcje</h3>
              <div className="space-y-3">
                  {transactions.slice(0, 3).map(t => (
                      <div key={t.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-50 shadow-sm">
                          <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                                  {t.type === 'CREDIT' ? '+' : '-'}
                              </div>
                              <div>
                                  <p className="text-xs font-bold text-slate-700">{t.serviceName || 'Doładowanie'}</p>
                                  <p className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString()}</p>
                              </div>
                          </div>
                          <span className={`text-sm font-bold ${t.type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-800'}`}>
                              {t.type === 'CREDIT' ? '+' : '-'}{t.amount}
                          </span>
                      </div>
                  ))}
              </div>
          </div>
      </div>
  );

  // If in Wellbeing Mode, render the full screen app
  if (activeTab === 'WELLBEING' && hasMentalHealthAccess) {
      return (
          <MentalHealthDashboard 
              currentUser={user}
              balance={user.voucherBalance}
              onSpend={handleManualSpend}
              onExit={() => setActiveTab('WALLET')}
          />
      );
  }

  // If in Legal Mode, render the full screen app
  if (activeTab === 'LEGAL' && hasLegalAccess) {
      return (
          <LegalAssistantDashboard 
              currentUser={user}
              balance={user.voucherBalance}
              onSpend={handleManualSpend}
              onExit={() => setActiveTab('WALLET')}
          />
      );
  }

  // If in Secure Messenger Mode, render the full screen app
  if (activeTab === 'SECURE_MESSENGER' && hasSecureMessengerAccess) {
      return (
          <div className="fixed inset-0 bg-slate-50 z-[100] overflow-hidden flex flex-col font-sans text-slate-900">
              {/* Minimal Top Bar */}
              <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shrink-0 z-50">
                  <div className="flex items-center gap-2">
                      <div className="bg-emerald-600 text-white p-1.5 rounded-lg">
                          <Lock size={18}/>
                      </div>
                      <span className="font-bold tracking-tight text-slate-900">STRATTON <span className="text-emerald-600">SECURE</span></span>
                  </div>
                  <button onClick={() => setActiveTab('WALLET')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition">
                      <X size={20}/>
                  </button>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto relative bg-[#f8fafc]">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full">
                      <SecureMessengerWidget
                          hasAccess={hasSecureMessengerAccess}
                      />
                  </div>
              </div>
          </div>
      );
  }

  // If in Secure Vault Mode, render the full screen app
  if (activeTab === 'DIGITAL_VAULT' && hasVaultAccess) {
      return (
          <div className="fixed inset-0 bg-slate-50 z-[100] overflow-hidden flex flex-col font-sans text-slate-900">
              {/* Minimal Top Bar */}
              <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shrink-0 z-50 shadow-sm relative">
                  <div className="flex items-center gap-2">
                      <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
                          <ShieldCheck size={18}/>
                      </div>
                      <span className="font-bold tracking-tight text-slate-900">DIGITAL <span className="text-indigo-600">VAULT</span></span>
                  </div>
                  <button onClick={() => setActiveTab('WALLET')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition">
                      <X size={20}/>
                  </button>
              </div>

              {/* Content Area - Full height minus header */}
              <div className="flex-1 overflow-hidden relative bg-[#f8fafc]">
                  <DigitalVaultApp 
                      onClose={() => setActiveTab('WALLET')}
                  />
              </div>
          </div>
      );
  }

  const renderActiveServices = () => {
      const activeCount = [hasMentalHealthAccess, hasLegalAccess, hasSecureMessengerAccess, hasVaultAccess].filter(Boolean).length;

      return (
          <div className="space-y-8 animate-in fade-in duration-500">
              {/* Header */}
              <div className="rounded-3xl p-8 md:p-12 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(22px)' }}>
                  <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-20 -mt-20 opacity-20" style={{ background: '#10b981' }}></div>
                  <div className="relative z-10 max-w-2xl">
                      <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight" style={{ color: 'white' }}>
                          Witaj w swoim katalogu <br/>
                          <span style={{ color: '#10b981' }}>aktywnych usług</span>
                      </h2>
                      <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                          Dziękujemy że skorzystałeś z naszych możliwości i życzymy miłego użytkowania.
                      </p>
                  </div>
              </div>

              {/* Grid */}
              {activeCount === 0 ? (
                  <div className="text-center py-20 rounded-3xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)' }}>
                      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                          <Grid size={32} />
                      </div>
                      <h3 className="text-lg font-bold mb-2" style={{ color: 'white' }}>Brak aktywnych usług</h3>
                      <p className="max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>
                          Nie aktywowałeś jeszcze żadnych usług. Przejdź do katalogu, aby wykorzystać swoje punkty.
                      </p>
                      <Button 
                          variant="primary" 
                          className="mt-6"
                          onClick={() => {
                              setActiveTab('CATALOG');
                              if (onViewChange) onViewChange('emp-catalog');
                          }}
                      >
                          Przeglądaj Katalog
                      </Button>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                      {hasMentalHealthAccess && (
                          <div 
                            onClick={() => setActiveTab('WELLBEING')}
                            className="group relative cursor-pointer hover:-translate-y-1.5 transition-all duration-300 z-0 h-full min-h-[240px]"
                          >
                              <div className="absolute -bottom-6 left-4 right-4 h-6 bg-indigo-600 rounded-[100%] blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-300 -z-10"></div>
                              <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg border border-indigo-700 h-full flex flex-col justify-between">
                                  <div className="absolute inset-0 bg-cover bg-center transform group-hover:scale-105 transition-transform duration-700" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=1000)' }}></div>
                                  <div className="absolute inset-0 bg-indigo-900/80 backdrop-blur-[2px] group-hover:bg-indigo-900/70 transition-colors"></div>
                                  <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform origin-bottom"></div>
                                  <div className="relative z-10 flex justify-between items-center h-full">
                                      <div>
                                          <div className="flex items-center gap-2 mb-2">
                                              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wider">
                                                  Dostęp Aktywny
                                              </span>
                                          </div>
                                          <h3 className="text-xl font-bold flex items-center gap-2">
                                              <Brain className="text-indigo-300" size={24}/> Wellbeing
                                          </h3>
                                          <p className="text-indigo-200 text-sm mt-1 max-w-sm">
                                              Twoje centrum zdrowia psychicznego. AI Coach, medytacje i sesje deep work.
                                          </p>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )}

                      {hasLegalAccess && (
                          <div 
                            onClick={() => setActiveTab('LEGAL')}
                            className="group relative cursor-pointer hover:-translate-y-1.5 transition-all duration-300 z-0 h-full min-h-[240px]"
                          >
                              <div className="absolute -bottom-6 left-4 right-4 h-6 bg-slate-900 rounded-[100%] blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-300 -z-10"></div>
                              <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg border border-slate-700 h-full flex flex-col justify-between">
                                  <div className="absolute inset-0 bg-cover bg-center transform group-hover:scale-105 transition-transform duration-700" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=1000)' }}></div>
                                  <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-[1px] group-hover:bg-slate-900/80 transition-colors"></div>
                                  <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 -skew-x-12 transform origin-top"></div>
                                  <div className="relative z-10 flex justify-between items-center h-full">
                                      <div>
                                          <div className="flex items-center gap-2 mb-2">
                                              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30 uppercase tracking-wider">
                                                  Legalny Spokój
                                              </span>
                                          </div>
                                          <h3 className="text-xl font-bold flex items-center gap-2">
                                              <Scale className="text-amber-300" size={24}/> AI Prawnik
                                          </h3>
                                          <p className="text-slate-300 text-sm mt-1 max-w-sm">
                                              Analiza umów, generator pism i porady prawne 24/7.
                                          </p>
                                      </div>
                                      <div className="bg-white/10 p-3 rounded-full group-hover:bg-white/20 transition-colors">
                                          <ArrowRight size={24} className="text-white"/>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )}

                      {hasSecureMessengerAccess && (
                          <div className="h-full min-h-[240px]">
                              <SecureMessengerWidget
                                  hasAccess={true}
                              />
                          </div>
                      )}

                      {hasVaultAccess && (
                          <div className="h-full min-h-[240px]">
                              <SecureDigitalVaultWidget 
                                  hasAccess={true}
                                  onOpen={() => setActiveTab('DIGITAL_VAULT')}
                              />
                          </div>
                      )}
                  </div>
              )}
          </div>
      );
  };

  return (
    <div style={{ background: '#030712', minHeight: '100%', position: 'relative' }} className="pb-24 md:pb-6">
      {/* CSS Keyframes */}
      <style>{`
        @keyframes ebs-orb {
          0%,100% { transform: translate(0,0) scale(1); opacity:.35; }
          25%     { transform: translate(40px,-30px) scale(1.12); opacity:.55; }
          50%     { transform: translate(-20px,50px) scale(.9); opacity:.25; }
          75%     { transform: translate(30px,20px) scale(1.06); opacity:.45; }
        }
        @keyframes ebs-grad {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .ebs-orb-d { animation: ebs-orb 13s ease-in-out infinite; }
        .ebs-orb-d2 { animation: ebs-orb 17s ease-in-out infinite reverse; }
        .ebs-orb-d3 { animation: ebs-orb 21s ease-in-out infinite 4s; }
        .ebs-grad-text {
          background: linear-gradient(135deg,#fff 0%,#bfdbfe 40%,#93c5fd 65%,#60a5fa 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: ebs-grad 3s ease infinite;
        }
      `}</style>

      {/* Animated Orbs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        {/* Blue orb - top left */}
        <div className="ebs-orb-d" style={{ position: 'absolute', top: '-10%', left: '-5%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)', filter: 'blur(80px)', opacity: 0.35 }} />
        {/* Green orb - bottom right */}
        <div className="ebs-orb-d2" style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, #10b981 0%, transparent 70%)', filter: 'blur(90px)', opacity: 0.3 }} />
        {/* Cyan orb - middle right */}
        <div className="ebs-orb-d3" style={{ position: 'absolute', top: '40%', right: '10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, #0891b2 0%, transparent 70%)', filter: 'blur(70px)', opacity: 0.3 }} />
      </div>

      {/* Grid overlay */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 1 }} />

      {/* Content wrapper above orbs */}
      <div style={{ position: 'relative', zIndex: 1 }}>

      {/* NEW HEADER (Replaces PageHeader) */}
      <div className="hidden md:flex justify-between items-end mb-12">
          <MarketplaceHero />

          {/* Balance Card */}
          <div className="flex flex-col items-end mb-8 animate-in slide-in-from-right duration-700">
             <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(22px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} className="p-6 rounded-3xl min-w-[240px] text-right transform hover:scale-105 transition-all duration-300">
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Dostępne środki</p>
                <div className="flex items-center justify-end gap-2 text-4xl font-black" style={{ color: 'white' }}>
                   <span className="ebs-grad-text">{user.voucherBalance}</span> <span className="text-lg font-bold self-start mt-2" style={{ color: '#10b981' }}>pkt</span>
                </div>
                {/* Visual Indicator */}
                <div className="w-full h-1.5 rounded-full mt-4 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                   <div className="h-full w-3/4 rounded-full" style={{ background: 'linear-gradient(90deg, #2563eb, #10b981)' }}></div>
                </div>
             </div>
          </div>
      </div>

      {/* VIEW CONTENT */}
      {/* ONE PAGER MODIFICATION: Render Wallet AND Catalog sequentially if activeTab is WALLET or CATALOG */}
      
      {(activeTab === 'WALLET' || activeTab === 'CATALOG') && (
        <div className="space-y-12">
            {/* 1. PULPIT (WALLET) */}
            <div id="section-wallet">
                {renderWallet()}
            </div>

            {/* SEPARATOR / HEADER for Catalog */}
            <div className="flex items-center gap-4 py-4" id="catalog-anchor">
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }}></div>
                <h3 className="text-xl font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Zamknięty Katalog Usług</h3>
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }}></div>
            </div>

            {/* 2. CATALOG */}
            <div className="min-h-[600px]">
                <ServiceCatalog 
                    services={displayServices}
                    userBalance={user.voucherBalance}
                    onPurchase={setSelectedService}
                />
            </div>
            
            {/* END MARDER */}
            <div className="text-center py-12 pb-24" style={{ color: 'rgba(255,255,255,0.25)' }}>
                <p className="text-sm font-medium">To już koniec ofert na dziś.</p>
                <div className="w-2 h-2 rounded-full mx-auto mt-4" style={{ background: 'rgba(255,255,255,0.1)' }}></div>
            </div>
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-300">
            <EmployeeTransactionHistory transactions={transactions} />
            <EmployeeBuybackList buybacks={buybacks} onViewAgreement={onViewAgreement} />
        </div>
      )}

      {activeTab === 'ACTIVE_SERVICES' && renderActiveServices()}

      {activeTab === 'SUPPORT' && (
          <div className="space-y-6 animate-in fade-in duration-300">
              
              <EmployeeGuide onClose={() => setShowGuide(false)} forceVisible={true} />

              <SupportTicketSystem 
                  currentUser={user}
                  tickets={tickets}
                  onCreateTicket={actions.handleCreateTicket}
                  onReply={actions.handleReplyTicket}
                  onUpdateStatus={actions.handleUpdateTicketStatus}
              />
          </div>
      )}

      {/* MODALS */}
      {selectedService && (
          <RedemptionModal 
              isOpen={!!selectedService}
              onClose={() => setSelectedService(null)}
              service={selectedService}
              onConfirm={() => {
                  onPurchaseService(selectedService);
                  // Auto-switch to newly purchased app
                  if (selectedService.id === 'SRV-MENTAL-01') {
                      setTimeout(() => setActiveTab('WELLBEING'), 1000);
                  } else if (selectedService.id === 'SRV-LEGAL-01') {
                      setTimeout(() => setActiveTab('LEGAL'), 1000);
                  }
              }}
          />
      )}

      {/* MOBILE NAV (Always at bottom) */}
      <MobileNav
          activeTab={activeTab}
          onChangeTab={(tabId) => {
              if (onViewChange) {
                if (tabId === 'WALLET') onViewChange('emp-dashboard');
                else if (tabId === 'CATALOG') onViewChange('emp-catalog');
                else if (tabId === 'HISTORY') onViewChange('emp-history');
                else setActiveTab(tabId as Tab);
              } else {
                setActiveTab(tabId as Tab);
              }
          }}
          onProfileClick={() => setIsSettingsOpen(true)}
          hasMentalHealth={hasMentalHealthAccess}
          hasLegal={hasLegalAccess}
      />
      </div>{/* end content wrapper */}
    </div>
  );
};
