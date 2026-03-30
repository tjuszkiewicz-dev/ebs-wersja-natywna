import React from 'react';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../constants';
import { Clock, Calendar, ChevronRight } from 'lucide-react';

export const PulseIndicator = () => (
    <span className="relative flex h-2 w-2 mr-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
    </span>
);

export const LegalBadge = ({ category, className = "" }: { category: string, className?: string }) => (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-tight ${CATEGORY_COLORS[category] || 'bg-slate-100 text-slate-700'} ${className}`}>
        {CATEGORY_LABELS[category] || category}
    </span>
);

export const CaseSummaryCard: React.FC<{ caseItem: any; onClick: () => void }> = ({ caseItem, onClick }) => {
    const caseIdDisplay = caseItem.id.includes('-') ? caseItem.id.split('-')[1] : caseItem.id;
    
    return (
        <div 
            onClick={onClick}
            className="group relative flex items-center p-3 sm:p-4 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <LegalBadge category={caseItem.category} />
                    <span className="text-[11px] text-slate-400 font-mono">#{caseIdDisplay}</span>
                </div>
                <h4 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                    {caseItem.title}
                </h4>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {caseItem.status === 'OPEN' ? 'W toku' : 'Zamknięta'}
                    </span>
                    <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {typeof caseItem.createdAt === 'string' ? caseItem.createdAt : 
                         caseItem.createdAt instanceof Date ? caseItem.createdAt.toLocaleDateString() : 
                         'N/A'}
                    </span>
                </div>
            </div>
            <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-400 group-hover:translate-x-1 transition-all flex-shrink-0 ml-4" />
        </div>
    );
};
