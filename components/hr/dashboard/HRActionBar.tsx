
import React from 'react';
import { ProcessStep } from './HRProcessTimeline';
import { Users, FileText, Send, CreditCard, CheckCircle, ArrowRight, AlertCircle, Calculator, Plus, Sparkles, UserPlus, Clock, UserCheck } from 'lucide-react';
import { Button } from '../../ui/Button';

interface HRActionBarProps {
  step: ProcessStep;
  onNavigate: (tab: string) => void;
  onAction: (actionType: 'DISTRIBUTE_CHOICE' | 'DISTRIBUTE_SINGLE' | 'DISTRIBUTE_BULK') => void;
  employeesCount?: number; 
}

export const HRActionBar: React.FC<HRActionBarProps> = ({ step, onNavigate, onAction, employeesCount = 0 }) => {
  
  // Konfiguracja dla każdego kroku
  const renderContent = () => {
    switch (step) {
      case 'EMPLOYEES':
        if (employeesCount === 0) {
            return {
                icon: <UserPlus size={24} className="text-white" />,
                iconBg: "bg-blue-600",
                title: "Witaj w Systemie! Krok 1: Dodaj Pracowników",
                desc: "Aby rozpocząć, musisz utworzyć bazę pracowników. Możesz dodać ich ręcznie lub zaimportować listę z Excela.",
                buttonText: "Rozpocznij Import",
                buttonIcon: <ArrowRight size={18} />,
                buttonAction: () => onNavigate('EMPLOYEES'),
                colorClass: "border-l-4 border-blue-600 bg-blue-50"
            };
        } else {
            return {
                icon: <Users size={24} className="text-blue-600" />,
                title: "Krok 1: Weryfikacja Bazy Pracowników",
                desc: "Nowy miesiąc rozliczeniowy. System wymaga potwierdzenia aktualności listy pracowników przed złożeniem zamówienia.",
                buttonText: "Zweryfikuj Listę",
                buttonIcon: <ArrowRight size={18} />,
                buttonAction: () => onNavigate('EMPLOYEES'),
                colorClass: "border-l-4 border-blue-500 bg-blue-50/50"
            };
        }
      case 'ORDER':
        return {
          icon: <Calculator size={24} className="text-amber-600" />, // Amber for Draft/Pending
          title: "Krok 2: Zasilenie Budżetu",
          desc: "Lista pracowników gotowa. Użyj kalkulatora, aby wyliczyć kwoty netto i zamówić vouchery.",
          buttonText: "Złóż Zamówienie",
          buttonIcon: <FileText size={18} />,
          buttonAction: () => onNavigate('SETTLEMENTS'),
          colorClass: "border-l-4 border-amber-500 bg-amber-50/50"
        };
      case 'PENDING_APPROVAL':
        return {
          icon: <Clock size={24} className="text-amber-600" />,
          title: "Zamówienie w trakcie weryfikacji",
          desc: "Twoje zamówienie zostało przyjęte. Czekaj na zatwierdzenie przez operatora.",
          buttonText: "Szczegóły",
          buttonIcon: <FileText size={18} />,
          buttonAction: () => onNavigate('SETTLEMENTS'),
          colorClass: "border-l-4 border-amber-500 bg-amber-50/50"
        };
      case 'DISTRIBUTION':
        return {
          icon: <Send size={24} className="text-indigo-600 animate-pulse" />,
          title: "Krok 3: Dystrybucja (Model Zaufania)",
          desc: "Zamówienie zatwierdzone przez Admina! Możesz rozdać vouchery pracownikom już teraz (Trust Mode).",
          buttonText: "Rozdaj Vouchery",
          buttonIcon: <Send size={18} />,
          buttonAction: () => onAction('DISTRIBUTE_CHOICE'), // Wywołanie okna wyboru
          colorClass: "border-l-4 border-indigo-600 bg-indigo-50/50" // Indigo/Violet
        };
      case 'PAYMENT':
        return {
          icon: <AlertCircle size={24} className="text-rose-600" />,
          title: "Krok 4: Płatność (Wymagana)",
          desc: "Środki rozdane (Trust Model). Twoja faktura oczekuje na opłacenie, aby zamknąć cykl.",
          buttonText: "Opłać Fakturę", 
          buttonIcon: <CreditCard size={18}/>,
          buttonAction: () => onNavigate('SETTLEMENTS'),
          colorClass: "border-l-4 border-rose-500 bg-rose-50/50" // Rose/Red for Payment Alert
        };
      case 'COMPLETE':
        return {
          icon: <Sparkles size={24} className="text-emerald-600" />,
          title: "Cykl Zamknięty. Gotowość na nowe zamówienie.",
          desc: "Wszystkie środki zostały rozdane, a faktury opłacone. Możesz rozpocząć nowy proces, ale pamiętaj: sprawdź najpierw czy lista pracowników (zatrudnienia/zwolnienia) jest aktualna.",
          buttonText: "Sprawdź Kadry i Zamów",
          buttonIcon: <UserCheck size={18} />,
          buttonAction: () => onNavigate('EMPLOYEES'), // Kierujemy do Kadr, a nie od razu do Rozliczeń
          colorClass: "border-l-4 border-emerald-500 bg-emerald-50/50" // Emerald/Green for Success
        };
      default:
        return null;
    }
  };

  const content = renderContent();
  if (!content) return null;

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ${content.colorClass} transition-all duration-500`}>
        
        <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shadow-sm shrink-0 ${content.iconBg ? content.iconBg : 'bg-white border border-slate-100'}`}>
                {content.icon}
            </div>
            <div>
                <h3 className="text-lg font-bold text-slate-800">{content.title}</h3>
                <p className="text-sm text-slate-600 mt-1 max-w-xl leading-relaxed">
                    {content.desc}
                </p>
            </div>
        </div>

        {content.buttonAction && (
            <Button 
                onClick={content.buttonAction}
                variant="primary"
                size="lg"
                icon={content.buttonIcon}
                className="w-full md:w-auto shadow-lg shadow-slate-900/10 whitespace-nowrap"
            >
                {content.buttonText}
            </Button>
        )}

    </div>
  );
};
