
import React, { useState } from 'react';
import { DocumentTemplate, SystemConfig } from '../../../types';
import { Edit3, Save, Eye, RefreshCw, FileText, Variable } from 'lucide-react';
import { DocumentModal } from '../../DocumentModal';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';

interface DocumentEditorProps {
  systemConfig: SystemConfig;
  onUpdateConfig: (config: SystemConfig) => void;
}

const VARIABLES = [
    { label: 'Nazwa Użytkownika', code: '{USER_NAME}' },
    { label: 'ID Użytkownika', code: '{USER_ID}' },
    { label: 'Data Generowania', code: '{DATE}' },
    { label: 'Liczba Voucherów', code: '{VOUCHER_COUNT}' },
    { label: 'Wartość Łączna', code: '{TOTAL_VALUE}' },
    { label: 'Numer Umowy', code: '{AGREEMENT_ID}' },
];

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ systemConfig, onUpdateConfig }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState(systemConfig.templates[0]?.id || '');
  const [content, setContent] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Load content on select
  React.useEffect(() => {
      const tpl = systemConfig.templates.find(t => t.id === selectedTemplateId);
      if (tpl) setContent(tpl.content);
  }, [selectedTemplateId, systemConfig.templates]);

  const handleSave = () => {
      const updatedTemplates = systemConfig.templates.map(t => 
          t.id === selectedTemplateId 
          ? { ...t, content, version: t.version + 1, lastModified: new Date().toISOString() } 
          : t
      );
      
      // Update specific fields if it's a system template
      const isBuyback = selectedTemplateId === 'TPL-001';
      
      onUpdateConfig({
          ...systemConfig,
          templates: updatedTemplates,
          buybackAgreementTemplate: isBuyback ? content : systemConfig.buybackAgreementTemplate
      });
  };

  const insertVariable = (code: string) => {
      setContent(prev => prev + code);
  };

  const selectedTemplate = systemConfig.templates.find(t => t.id === selectedTemplateId);

  // Mock data for preview
  const previewData = {
      id: 'UMOWA-TEST-001',
      dateGenerated: new Date().toISOString(),
      voucherCount: 100,
      totalValue: 100,
      userId: 'USER-TEST',
      snapshot: {
          user: { name: 'Jan Kowalski (Podgląd)', email: 'jan@test.pl', pesel: '00000000000', iban: 'PL 00 0000 0000' }
      }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
            <div className="flex items-center gap-3 w-full sm:w-auto">
                <FileText size={20} className="text-slate-500 hidden sm:block"/>
                <div className="w-full sm:w-64">
                    <Select 
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        options={systemConfig.templates.map(t => ({ value: t.id, label: `${t.name} (v${t.version})` }))}
                        className="!py-1.5 !text-xs font-bold"
                    />
                </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                    onClick={() => setIsPreviewOpen(true)}
                    variant="secondary"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    icon={<Eye size={14}/>}
                >
                    Podgląd
                </Button>
                <Button 
                    onClick={handleSave}
                    variant="primary"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    icon={<Save size={14}/>}
                >
                    Zapisz
                </Button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            {/* Main Editor */}
            <div className="flex-1 p-0 relative">
                <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-full p-6 resize-none outline-none font-mono text-sm leading-relaxed text-slate-800"
                    spellCheck={false}
                />
            </div>

            {/* Sidebar Variables */}
            <div className="w-64 bg-slate-50 border-l border-slate-200 p-4 overflow-y-auto shrink-0 hidden md:block">
                <h4 className="label-text flex items-center gap-2">
                    <Variable size={14}/> Zmienne
                </h4>
                <div className="space-y-2">
                    {VARIABLES.map(v => (
                        <button 
                            key={v.code}
                            onClick={() => insertVariable(v.code)}
                            className="w-full text-left p-2 bg-white border border-slate-200 rounded hover:border-indigo-300 hover:text-indigo-600 transition group"
                        >
                            <span className="block text-[10px] font-bold text-slate-400 group-hover:text-indigo-400">{v.label}</span>
                            <span className="block text-xs font-mono font-bold">{v.code}</span>
                        </button>
                    ))}
                </div>
                <div className="mt-6 text-[10px] text-slate-400 leading-relaxed">
                    Kliknij zmienną, aby wstawić ją do treści. Zostanie ona automatycznie podmieniona podczas generowania PDF.
                </div>
            </div>
        </div>

        {/* Live Preview Modal (Reusing DocumentModal) */}
        {isPreviewOpen && selectedTemplate && (
            <DocumentModal 
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                type="BUYBACK_AGREEMENT" // Mocking type as most templates are agreements currently
                data={previewData}
                user={previewData.snapshot.user as any}
            />
        )}
    </div>
  );
};
