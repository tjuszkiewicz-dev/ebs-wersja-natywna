
import React from 'react';
import { Users, FileText, CreditCard, Send, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

export type ProcessStep = 'EMPLOYEES' | 'ORDER' | 'PENDING_APPROVAL' | 'PAYMENT' | 'DISTRIBUTION' | 'COMPLETE';

interface Props {
  currentStep: ProcessStep;
  onNavigate: (step: ProcessStep) => void;
}

export const HRProcessTimeline: React.FC<Props> = ({ currentStep, onNavigate }) => {
  
  const steps = [
    { 
        id: 'EMPLOYEES', 
        label: '1. Kadry', 
        icon: Users, 
        desc: 'Aktualizacja listy',
        targetTab: 'EMPLOYEES'
    },
    { 
        id: 'ORDER', 
        label: '2. Zamówienie', 
        icon: FileText, 
        desc: 'Kalkulacja netto',
        targetTab: 'SETTLEMENTS'
    },
    { 
        id: 'DISTRIBUTION', 
        label: '3. Dystrybucja', 
        icon: Send, 
        desc: 'Trust Model',
        targetTab: 'START' 
    },
    { 
        id: 'PAYMENT', 
        label: '4. Płatność', 
        icon: CreditCard, 
        desc: 'Faktura VAT',
        targetTab: 'SETTLEMENTS' 
    }
  ];

  // Helper to determine status based on currentStep enum order
  const getStatus = (stepId: string) => {
      const order = ['EMPLOYEES', 'ORDER', 'PENDING_APPROVAL', 'DISTRIBUTION', 'PAYMENT', 'COMPLETE'];
      const currentIndex = order.indexOf(currentStep);
      const stepIndex = order.indexOf(stepId);

      if (stepIndex < currentIndex) return 'DONE';
      if (stepIndex === currentIndex) return 'ACTIVE';
      return 'PENDING';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 md:p-4 mb-4 md:mb-6 shadow-sm overflow-hidden">
        <h4 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 md:mb-4 px-1 md:px-2">Cykl Rozliczeniowy</h4>
        
        {/* Mobile: Horizontal Scroll Snap */}
        <div className="flex md:hidden overflow-x-auto gap-4 pb-2 snap-x no-scrollbar -mx-3 px-3">
            {steps.map((step) => {
                const status = getStatus(step.id);
                const isClickable = status !== 'PENDING';
                let circleClass = 'bg-slate-50 text-slate-300 border-slate-100';
                let textClass = 'text-slate-400 opacity-60';

                if (status === 'DONE') {
                    circleClass = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                    textClass = 'text-emerald-700 font-medium';
                } else if (status === 'ACTIVE') {
                    circleClass = 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200';
                    textClass = 'text-indigo-700 font-bold';
                }

                return (
                    <div 
                        key={step.id}
                        onClick={() => isClickable && onNavigate(step.id as ProcessStep)}
                        className={`flex flex-col items-center gap-1.5 min-w-[70px] snap-center transition-all ${isClickable ? 'cursor-pointer' : ''}`}
                    >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 text-sm transition-all duration-300 ${circleClass}`}>
                            {status === 'DONE' ? <CheckCircle2 size={16}/> : <step.icon size={16}/>}
                        </div>
                        <span className={`text-[10px] text-center whitespace-nowrap ${textClass}`}>{step.label}</span>
                    </div>
                );
            })}
        </div>

        {/* Desktop: Standard Timeline */}
        <div className="hidden md:flex flex-row justify-between items-center gap-4 relative">
            
            {/* Connecting Line */}
            <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-slate-100 -z-0 -translate-y-3"></div>

            {steps.map((step) => {
                const status = getStatus(step.id);
                const isClickable = status !== 'PENDING';

                let circleClass = 'bg-slate-100 text-slate-400 border-slate-200';
                let textClass = 'text-slate-400';
                
                if (status === 'DONE') {
                    circleClass = 'bg-emerald-100 text-emerald-600 border-emerald-200';
                    textClass = 'text-emerald-700';
                } else if (status === 'ACTIVE') {
                    circleClass = 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-110';
                    textClass = 'text-indigo-700 font-bold';
                }

                return (
                    <div 
                        key={step.id} 
                        onClick={() => isClickable && onNavigate(step.id as ProcessStep)}
                        className={`relative z-10 flex flex-col items-center gap-2 flex-1 cursor-pointer group transition-all ${isClickable ? 'hover:opacity-80' : 'opacity-60 cursor-not-allowed'}`}
                    >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${circleClass}`}>
                            {status === 'DONE' ? <CheckCircle2 size={20}/> : <step.icon size={18}/>}
                        </div>
                        
                        <div className="text-center">
                            <p className={`text-sm font-medium ${textClass}`}>{step.label}</p>
                            <p className="text-[10px] text-slate-500">{step.desc}</p>
                        </div>
                    </div>
                );
            })}
            
            {currentStep === 'COMPLETE' && (
                <div className="flex items-center justify-center bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full absolute -right-2 -top-2 shadow-sm animate-in fade-in zoom-in">
                    Cykl Zamknięty
                </div>
            )}
        </div>
    </div>
  );
};
