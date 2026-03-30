import React, { useState, useCallback, useRef, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import {
    LegalCase,
    ChatMessage,
    DocumentTemplate,
    ViewMode,
    DUMMY_CASES
} from './types';

const callAiChat = async (
    messages: { role: 'user' | 'model'; text: string }[],
    systemInstruction?: string,
    fileData?: { base64: string; mimeType: string }
): Promise<string> => {
    const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, systemInstruction, fileData }),
    });
    if (!res.ok) throw new Error('AI service error');
    const data = await res.json();
    return data.text as string;
};

export const useLegalAssistant = (currentUser: any, onSpend: (amount: number, description: string) => Promise<boolean>) => {
    // --- PODSTAWOWY STAN ---
    const [userCases, setUserCases] = useState<LegalCase[]>(DUMMY_CASES);
    const [loading, setLoading] = useState(false);
    
    // Stan Czatu
    const [aiInput, setAiInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Stan Nawigacji i Modali
    const [selectedCase, setSelectedCase] = useState<LegalCase | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);

    // Stan Analizatora Plików
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);

    // Stan Generatora Dokumentów
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);

    // Stan Kreatora Konsumenckiego (Wizard)
    const [wizardStep, setWizardStep] = useState<string>('START');
    const [wizardHistory, setWizardHistory] = useState<string[]>([]);

    // Stan Kalkulatorów
    const [activeCalc, setActiveCalc] = useState<'INTEREST' | 'COURT_FEES' | 'NOTICE_PERIOD' | null>(null);
    const [calcInputs, setCalcInputs] = useState<Record<string, string>>({});
    const [calcResult, setCalcResult] = useState<string | null>(null);

    // Scroll chat to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [selectedCase?.messages, isThinking]);

    // --- LOGIKA ASYSTENTA AI ---

    const handleChatSubmit = useCallback(async (e: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!aiInput.trim() || !selectedCase) return;

        const success = await onSpend(10, `Konsultacja AI (Sprawa PR): ${selectedCase.title}`);
        if (!success) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: aiInput,
            timestamp: new Date().toISOString()
        };

        const updatedCase: LegalCase = {
            ...selectedCase,
            messages: [...(selectedCase.messages || []), userMsg]
        };

        // Update main state and local case
        setSelectedCase(updatedCase);
        setUserCases(prev => prev.map(c => c.id === selectedCase.id ? updatedCase : c));
        setAiInput('');
        setIsThinking(true);

        try {
            const history = (updatedCase.messages || []).map(m => ({
                role: m.role === 'user' ? 'user' as const : 'model' as const,
                text: m.content,
            }));
            history.push({ role: 'user', text: aiInput });

            const responseText = await callAiChat(
                history,
                'Jesteś profesjonalnym ekspertem prawnym. Odpowiadaj rzeczowo, po polsku, w Markdown.'
            );

            const assistantMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: responseText,
                timestamp: new Date().toISOString()
            };

            const finalizedCase: LegalCase = {
                ...updatedCase,
                messages: [...(updatedCase.messages || []), assistantMsg]
            };

            setSelectedCase(finalizedCase);
            setUserCases(prev => prev.map(c => c.id === selectedCase.id ? finalizedCase : c));
        } catch (error) {
            console.error('Błąd AI:', error);
        } finally {
            setIsThinking(false);
        }
    }, [aiInput, selectedCase, onSpend]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadedFile(file);
            setAnalysisResult(null);
            
            // Generate preview for images/pdfs
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => setFilePreview(reader.result as string);
                reader.readAsDataURL(file);
            } else {
                setFilePreview(null);
            }
        }
    };

    const handleAnalyzeDocument = useCallback(async () => {
        if (!uploadedFile) return;

        const success = await onSpend(25, `Analiza dokumentu: ${uploadedFile.name}`);
        if (!success) return;

        setIsAnalyzing(true);
        try {
            const reader = new FileReader();
            const fileDataPromise = new Promise<string>((resolve) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(uploadedFile);
            });

            const dataUrl = await fileDataPromise;
            const base64Data = dataUrl.split(',')[1];

            const text = await callAiChat(
                [{ role: 'user', text: 'Dokonaj szczegółowej analizy tego dokumentu. Wyodrębnij kluczowe terminy, daty, strony umowy oraz potencjalne ryzyka. Zidentyfikuj najważniejsze punkty dla właściciela. Odpowiedz po polsku w Markdown.' }],
                'Jesteś profesjonalnym ekspertem prawnym.',
                { base64: base64Data, mimeType: uploadedFile.type }
            );

            setAnalysisResult(text);
        } catch (error) {
            console.error('Błąd analizy:', error);
        } finally {
            setIsAnalyzing(false);
        }
    }, [uploadedFile, onSpend]);

    const saveAnalysisToCases = useCallback(() => {
        if (!analysisResult || !uploadedFile) return;

        const newCase: LegalCase = {
            id: `ANALYSIS-${Date.now()}`,
            title: `Analiza: ${uploadedFile.name}`,
            status: 'ANALYZED',
            createdAt: new Date().toISOString(),
            category: 'ANALYSIS',
            description: analysisResult,
            messages: [{
                id: 'init-1',
                role: 'assistant',
                content: `Wyniki analizy dla dokumentu **${uploadedFile.name}**:\n\n${analysisResult}`,
                timestamp: new Date().toISOString()
            }]
        };

        setUserCases(prev => [newCase, ...prev]);
        setSelectedCase(newCase);
        setUploadedFile(null);
        setAnalysisResult(null);
    }, [analysisResult, uploadedFile]);

    const handleGenerateDocument = useCallback(async () => {
        if (!selectedTemplate) return;

        const cost = selectedTemplate.price || 50;
        const success = await onSpend(cost, `Generowanie dokumentu: ${selectedTemplate.name}`);
        if (!success) return;

        setIsGenerating(true);
        try {
            const prompt = `Zostań wykwalifikowanym prawnikiem. Wygeneruj profesjonalne pismo prawne ("${selectedTemplate.name}") na podstawie tych danych: ${JSON.stringify(formValues)}. 
            Pismo ma być gotowe do użycia, w języku urzędowym/prawniczym, zawierać miejsca na datę i podpisy. Zwróć tylko czysty tekst dokumentu (Markdown).`;

            const docText = await callAiChat(
                [{ role: 'user', text: prompt }],
                'Jesteś wykwalifikowanym prawnikiem. Generujesz profesjonalne pisma prawne gotowe do użycia.'
            );
            setGeneratedDoc(docText);
        } catch (error) {
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
    }, [selectedTemplate, formValues, onSpend]);

    const handleDownloadPDF = useCallback((elementId: string = 'generated-doc') => {
        const element = document.getElementById(elementId);
        if (!element) return;

        const opt = {
            margin: 1,
            filename: `${selectedTemplate?.name || 'dokument'}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
        };

        html2pdf().set(opt).from(element).save();
    }, [selectedTemplate]);

    const handleQuickAction = useCallback(async (action: string) => {
        const newCase: LegalCase = {
            id: `QUICK-${Date.now()}`,
            title: `Konsultacja: ${action}`,
            status: 'OPEN',
            createdAt: new Date().toISOString(),
            category: 'CONSULTATION',
            messages: [{
                id: 'init-1',
                role: 'assistant',
                content: `Jak mogę Ci dzisiaj pomóc w temacie: **${action}**?`,
                timestamp: new Date().toISOString()
            }]
        };

        setUserCases(prev => [newCase, ...prev]);
        setSelectedCase(newCase);
    }, []);

    const handleCloseCase = () => {
        setSelectedCase(null);
    };

    return {
        userCases,
        loading,
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
    };
};
