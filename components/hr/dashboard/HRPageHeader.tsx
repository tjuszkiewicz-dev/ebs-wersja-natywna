import React from 'react';
import {
    LayoutDashboard, Users, FileText, FolderOpen, HelpCircle,
    Calendar, Download, BarChart3, Settings2, ArrowRight, ChevronLeft, ChevronRight
} from 'lucide-react';
import { ProcessStep } from './HRProcessTimeline';
import { Button } from '../../ui/Button';

export type HRTab = 'START' | 'EMPLOYEES' | 'SETTLEMENTS' | 'REPORTS' | 'INTEGRATIONS' | 'DOCUMENTS' | 'HELP';

const HR_TABS = [
    { id: 'START',        label: 'Pulpit',      icon: <LayoutDashboard size={16}/> },
    { id: 'EMPLOYEES',    label: 'Pracownicy',   icon: <Users size={16}/> },
    { id: 'SETTLEMENTS',  label: 'Rozliczenia',  icon: <FileText size={16}/> },
    { id: 'REPORTS',      label: 'Raporty',      icon: <BarChart3 size={16}/> },
    { id: 'INTEGRATIONS', label: 'Integracje',   icon: <Settings2 size={16}/> },
    { id: 'DOCUMENTS',    label: 'Teczka',       icon: <FolderOpen size={16}/> },
    { id: 'HELP',         label: 'Pomoc',        icon: <HelpCircle size={16}/> },
] as const;

interface Props {
    currentPeriod: string;
    systemStatus: { label: string; color: string };
    workflowStep: ProcessStep;
    activeTab: HRTab;
    onPrevPeriod: () => void;
    onNextPeriod: () => void;
    onTabChange: (tab: HRTab) => void;
}

export const HRPageHeader: React.FC<Props> = ({
    currentPeriod, systemStatus, workflowStep, activeTab,
    onPrevPeriod, onNextPeriod, onTabChange
}) => (
    <div className="bg-white border-b border-slate-200 pt-6 px-4 md:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">

                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-bold text-slate-800">Panel Kadrowy</h1>
                        <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wider ${systemStatus.color}`}>
                            {systemStatus.label}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 group">
                        <button
                            onClick={onPrevPeriod}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <div className="flex items-center gap-2 text-slate-500 font-medium text-sm border-b border-dashed border-slate-300 pb-0.5 cursor-pointer hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                            <Calendar size={14} />
                            <span className="capitalize">
                                {new Date(currentPeriod).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
                            </span>
                        </div>

                        <button
                            onClick={onNextPeriod}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onTabChange('REPORTS')}
                        icon={<Download size={16}/>}
                        className="w-full md:w-auto"
                    >
                        Raport
                    </Button>
                    {workflowStep === 'ORDER' && activeTab !== 'SETTLEMENTS' && (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onTabChange('SETTLEMENTS')}
                            icon={<ArrowRight size={16}/>}
                            className="w-full md:w-auto"
                        >
                            Nowe Zamówienie
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex overflow-x-auto no-scrollbar gap-1 -mb-px">
                {HR_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id as HRTab)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                            activeTab === tab.id
                            ? 'border-indigo-600 text-indigo-700 bg-indigo-50/10'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    </div>
);
