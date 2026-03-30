import React from 'react';
import { Scale, X } from 'lucide-react';
import { User as UserType } from '../../../types';
import { useLegalAssistant } from './legal/useLegalAssistant';
import { DashboardView } from './legal/DashboardView';
import { AnalyzerView } from './legal/AnalyzerView';
import { GeneratorView } from './legal/GeneratorView';
import { ConsumerWizardView } from './legal/ConsumerWizardView';
import { CaseDetailView } from './legal/CaseDetailView';
import { CalculatorsView } from './legal/CalculatorsView';
import { ViewMode } from './legal/types';

interface LegalAssistantDashboardProps {
    currentUser: UserType;
    balance: number;
    onSpend: (amount: number, description: string) => Promise<void>;
    onExit: () => void;
}

export const LegalAssistantDashboard: React.FC<LegalAssistantDashboardProps> = ({ 
    currentUser, balance, onSpend, onExit 
}) => {
    // Local navigation state
    const [viewMode, setViewMode] = React.useState<ViewMode>('DASHBOARD');

    // Wrapper for spend to match hook expectations
    const handleSpendWrapper = async (amount: number, description: string) => {
        try {
            const success = await onSpend(amount, description);
            // In case onSpend returns boolean, use it. If it returns void, assume success.
            return typeof success === 'boolean' ? success : true;
        } catch (e) {
            return false;
        }
    };

    // Core business logic and state management extracted to a custom hook
    const {
        userCases,
        aiInput,
        setAiInput,
        isThinking,
        messagesEndRef,
        selectedCase,
        setSelectedCase,
        selectedTemplate,
        setSelectedTemplate,
        isAnalyzing,
        analysisResult,
        setAnalysisResult,
        uploadedFile,
        setUploadedFile,
        filePreview,
        setFilePreview,
        formValues,
        setFormValues,
        isGenerating,
        generatedDoc,
        setGeneratedDoc,
        wizardStep,
        setWizardStep,
        wizardHistory,
        setWizardHistory,
        activeCalc,
        setActiveCalc,
        calcInputs,
        setCalcInputs,
        calcResult,
        setCalcResult,
        handleChatSubmit,
        handleFileChange,
        handleAnalyzeDocument,
        saveAnalysisToCases,
        handleGenerateDocument,
        handleDownloadPDF,
        handleQuickAction,
        handleCloseCase
    } = useLegalAssistant(currentUser, handleSpendWrapper);

    return (
        <div className="fixed inset-0 bg-slate-50 z-[100] overflow-hidden flex flex-col font-sans text-slate-900">
            {/* Minimal Top Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shrink-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
                        <Scale size={18}/>
                    </div>
                    <span className="font-bold tracking-tight text-slate-900">STRATTON <span className="text-indigo-600">LEGAL</span></span>
                </div>
                <button onClick={onExit} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition">
                    <X size={20}/>
                </button>
            </div>

            {/* Content Area - Routes based on viewMode */}
            <div className="flex-1 overflow-y-auto relative bg-[#f8fafc]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full">
                    {viewMode === 'DASHBOARD' && (
                        <DashboardView 
                            userCases={userCases || []} 
                            setView={setViewMode} 
                            setSelectedCase={(c) => {
                                setSelectedCase(c);
                                setViewMode('CASE_DETAIL');
                            }}
                            handleQuickAction={(action) => {
                                handleQuickAction(action);
                                setViewMode('CASE_DETAIL');
                            }}
                        />
                    )}
                    
                    {viewMode === 'CASE_DETAIL' && (
                        <CaseDetailView 
                            selectedCase={selectedCase} 
                            setView={setViewMode} 
                            aiInput={aiInput}
                            setAiInput={setAiInput}
                            isThinking={isThinking}
                            handleChatSubmit={handleChatSubmit}
                            messagesEndRef={messagesEndRef}
                            handleCloseCase={() => {
                                handleCloseCase();
                                setViewMode('DASHBOARD');
                            }}
                        />
                    )}
                    
                    {viewMode === 'ANALYZER' && (
                        <AnalyzerView 
                            isAnalyzing={isAnalyzing}
                            analysisResult={analysisResult}
                            uploadedFile={uploadedFile}
                            filePreview={filePreview}
                            handleFileChange={handleFileChange}
                            handleAnalyzeDocument={handleAnalyzeDocument}
                            saveAnalysisToCases={saveAnalysisToCases}
                            setView={setViewMode}
                            setUploadedFile={setUploadedFile}
                            setFilePreview={setFilePreview}
                            setAnalysisResult={setAnalysisResult}
                        />
                    )}
                    
                    {viewMode === 'GENERATOR' && (
                        <GeneratorView 
                            selectedTemplate={selectedTemplate}
                            setSelectedTemplate={setSelectedTemplate}
                            formValues={formValues}
                            setFormValues={setFormValues}
                            isGenerating={isGenerating}
                            generatedDoc={generatedDoc}
                            handleGenerateDocument={handleGenerateDocument}
                            handleDownloadPDF={handleDownloadPDF}
                            setView={setViewMode}
                        />
                    )}
                    
                    {viewMode === 'CONSUMER_WIZARD' && (
                        <ConsumerWizardView 
                            wizardStep={wizardStep}
                            setWizardStep={setWizardStep}
                            wizardHistory={wizardHistory}
                            setWizardHistory={setWizardHistory}
                            setView={setViewMode}
                            setSelectedTemplate={(tpl) => {
                                setSelectedTemplate(tpl);
                                setViewMode('GENERATOR');
                            }}
                        />
                    )}
                    
                    {viewMode === 'CALCULATORS' && (
                        <CalculatorsView 
                            activeCalc={activeCalc}
                            setActiveCalc={setActiveCalc}
                            calcInputs={calcInputs}
                            setCalcInputs={setCalcInputs}
                            calcResult={calcResult}
                            setCalcResult={setCalcResult}
                            setView={setViewMode}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};