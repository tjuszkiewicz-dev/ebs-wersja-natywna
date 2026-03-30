
import React, { useState, useEffect } from 'react';
import { Send, AlertCircle, Wallet, ShieldCheck, Info } from 'lucide-react';
import { User } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';

interface DistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEmployees: User[];
  initialEmployeeId?: string;
  activePool: number;
  reservedPool: number;
  onConfirm: (employeeId: string, amount: number) => void;
}

export const DistributionModal: React.FC<DistributionModalProps> = ({
  isOpen, onClose, activeEmployees, initialEmployeeId, activePool, reservedPool, onConfirm
}) => {
  const [selectedId, setSelectedId] = useState(initialEmployeeId || '');
  const [amount, setAmount] = useState<number | ''>(10);

  useEffect(() => {
    if (isOpen) {
        setSelectedId(initialEmployeeId || '');
        setAmount(10);
    }
  }, [isOpen, initialEmployeeId]);

  const handleSubmit = (e?: React.FormEvent) => {
      if(e) e.preventDefault();
      if (!selectedId || !amount || typeof amount !== 'number') return;
      onConfirm(selectedId, amount);
      onClose();
  };

  const selectedUser = activeEmployees.find(u => u.id === selectedId);
  const totalAvailable = activePool + reservedPool;
  const numericAmount = typeof amount === 'number' ? amount : 0;
  
  // Calculate usage
  const useFromActive = Math.min(numericAmount, activePool);
  const useFromReserved = Math.max(0, numericAmount - activePool);
  const isDippingIntoReserve = useFromReserved > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Przekaż Vouchery"
      icon={<Send size={20}/>}
      maxWidth="max-w-md"
      footer={
          <>
            <Button variant="secondary" onClick={onClose}>Anuluj</Button>
            <Button 
                variant={isDippingIntoReserve ? 'primary' : 'success'}
                disabled={!selectedId || !amount || numericAmount > totalAvailable}
                onClick={() => handleSubmit()}
                icon={<Send size={16}/>}
            >
                {isDippingIntoReserve ? 'Przekaż (Trust)' : 'Przekaż'}
            </Button>
          </>
      }
    >
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Pool Info Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border flex flex-col justify-center transition-colors ${isDippingIntoReserve && activePool < numericAmount ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-emerald-50 border-emerald-100'}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <Wallet size={14} className="text-emerald-600"/>
                        <span className="label-text text-emerald-600">Aktywne</span>
                    </div>
                    <span className="text-xl font-bold text-emerald-800">{activePool}</span>
                </div>
                <div className={`p-3 rounded-xl border flex flex-col justify-center transition-colors ${isDippingIntoReserve ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck size={14} className="text-indigo-600"/>
                        <span className="label-text text-indigo-600">Zaufanie (Trust)</span>
                    </div>
                    <span className="text-xl font-bold text-indigo-800">{reservedPool}</span>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <Select 
                        label="Wybierz Pracownika"
                        value={selectedId}
                        onChange={(e) => setSelectedId(e.target.value)}
                        options={[
                            { value: '', label: '-- Wybierz z listy --' },
                            ...activeEmployees.map(emp => ({ value: emp.id, label: `${emp.name} (${emp.email})` }))
                        ]}
                    />
                </div>

                <div>
                    <Input 
                        label="Kwota (Punkty)"
                        type="number"
                        min="1"
                        max={totalAvailable}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value === '' ? '' : parseInt(e.target.value))}
                        rightElement={<span className="text-sm font-bold text-slate-400">PLN</span>}
                        className={`text-xl font-bold font-mono ${isDippingIntoReserve ? 'border-indigo-300 focus:ring-indigo-500 bg-indigo-50/30' : ''}`}
                        placeholder="0"
                    />
                    
                    <div className="flex justify-between items-start mt-2">
                        {selectedUser && numericAmount > 0 && (
                            <p className="text-[10px] text-slate-400">
                                Nowe saldo: <strong className="text-emerald-600">{(selectedUser.voucherBalance + numericAmount)} pkt</strong>
                            </p>
                        )}
                        {isDippingIntoReserve && (
                            <div className="text-[10px] text-right font-medium">
                                <span className="text-slate-400">Pobranie: </span>
                                <span className="text-emerald-600">{useFromActive} akt.</span>
                                <span className="text-slate-300 mx-1">+</span>
                                <span className="text-indigo-600">{useFromReserved} rez.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Notifications / Warnings */}
            <div className="space-y-2">
                {isDippingIntoReserve && numericAmount <= totalAvailable && (
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex gap-2 text-xs text-indigo-700 animate-in fade-in slide-in-from-bottom-2">
                        <Info size={16} className="shrink-0 mt-0.5"/>
                        <span>
                            Wykorzystujesz środki z puli rezerwacyjnej. 
                            Pracownik otrzyma vouchery natychmiast (Trust Model), a Ty opłacisz fakturę później.
                        </span>
                    </div>
                )}

                {numericAmount > totalAvailable && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-2 text-xs text-red-700 animate-in fade-in slide-in-from-bottom-2">
                        <AlertCircle size={16} className="shrink-0 mt-0.5"/>
                        <span>Brak wystarczających środków (nawet w rezerwacji). Złóż nowe zamówienie.</span>
                    </div>
                )}
            </div>
        </form>
    </Modal>
  );
};
