
import React, { useState, useEffect } from 'react';
import { X, Server, Key, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { IntegrationConfig } from '../../../types';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';

interface IntegrationConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  integration: IntegrationConfig;
  onSave: (id: string, config: IntegrationConfig['config']) => void;
}

export const IntegrationConfigModal: React.FC<IntegrationConfigModalProps> = ({
  isOpen, onClose, integration, onSave
}) => {
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testStatus, setTestStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');

  useEffect(() => {
    if (isOpen) {
        setEndpoint(integration.config.endpointUrl || '');
        setApiKey(integration.config.apiKey || '');
        setTestStatus('IDLE');
    }
  }, [isOpen, integration]);

  if (!isOpen) return null;

  const handleSave = () => {
      onSave(integration.id, {
          ...integration.config,
          endpointUrl: endpoint,
          apiKey: apiKey
      });
      onClose();
  };

  const runConnectionTest = () => {
      setIsTestRunning(true);
      setTestStatus('IDLE');
      
      // Simulate API Ping
      setTimeout(() => {
          setIsTestRunning(false);
          // Simple mock validation
          if (endpoint.includes('http') && apiKey.length > 5) {
              setTestStatus('SUCCESS');
          } else {
              setTestStatus('ERROR');
          }
      }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 p-5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg text-white font-bold flex items-center justify-center w-10 h-10 ${
                        integration.provider === 'SAP' ? 'bg-blue-700' : 
                        integration.provider === 'ENOVA' ? 'bg-orange-500' :
                        integration.provider === 'AUTENTI' ? 'bg-indigo-600' : 'bg-slate-600'
                    }`}>
                        {integration.provider[0]}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Konfiguracja Połączenia</h3>
                        <p className="text-xs text-slate-500">{integration.name}</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X size={24}/></button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
                
                {/* Business Context (Why are we configuring this?) */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
                    <strong>Cel Biznesowy:</strong> {integration.businessGoal}
                </div>

                {/* Endpoint Input */}
                <div>
                    <Input
                        label="Endpoint URL (API)"
                        icon={<Server size={14}/>}
                        value={endpoint}
                        onChange={e => setEndpoint(e.target.value)}
                        placeholder="https://api.system.pl/v1/..."
                        className="font-mono"
                    />
                </div>

                {/* API Key Input */}
                <div>
                    <Input
                        label="API Key / Token"
                        icon={<Key size={14}/>}
                        type="password"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="••••••••••••••••••••••"
                        className="font-mono"
                    />
                </div>

                {/* Connection Status */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {isTestRunning ? <RefreshCw size={16} className="animate-spin text-blue-500"/> :
                         testStatus === 'SUCCESS' ? <CheckCircle size={16} className="text-emerald-500"/> :
                         testStatus === 'ERROR' ? <AlertCircle size={16} className="text-red-500"/> :
                         <div className="w-4 h-4 rounded-full border-2 border-slate-300"></div>}
                        
                        <span className={`text-xs font-bold ${
                            testStatus === 'SUCCESS' ? 'text-emerald-600' : 
                            testStatus === 'ERROR' ? 'text-red-600' : 'text-slate-500'
                        }`}>
                            {isTestRunning ? 'Testowanie połączenia...' : 
                             testStatus === 'SUCCESS' ? 'Połączenie Aktywne' : 
                             testStatus === 'ERROR' ? 'Błąd Połączenia' : 'Status nieznany'}
                        </span>
                    </div>
                    <button 
                        onClick={runConnectionTest}
                        disabled={isTestRunning}
                        className="text-xs text-indigo-600 font-bold hover:underline disabled:opacity-50"
                    >
                        Testuj (Ping)
                    </button>
                </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
                <Button variant="secondary" onClick={onClose} className="flex-1">Anuluj</Button>
                <Button variant="primary" onClick={handleSave} className="flex-1">Zapisz Konfigurację</Button>
            </div>
        </div>
    </div>
  );
};
