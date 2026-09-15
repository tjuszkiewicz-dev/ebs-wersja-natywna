
import React, { useState, useEffect, useRef } from 'react';
import { X, ShoppingCart, CheckCircle, ChevronRight, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import type { ServiceItem, PurchaseResult } from '../../types';
import { BOK_SLA_TEXT } from '../../lib/benefits/constants';

interface RedemptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceItem;
  onConfirm: () => Promise<PurchaseResult>;
  userEmail?: string;
  onOpenApp?: () => void;
}

type Step = 'REVIEW' | 'PROCESSING' | 'SUCCESS' | 'ERROR';

export const RedemptionModal: React.FC<RedemptionModalProps> = ({
  isOpen, onClose, service, onConfirm, userEmail, onOpenApp
}) => {
  const [step, setStep] = useState<Step>('REVIEW');
  const [sliderValue, setSliderValue] = useState(0);
  const [errorText, setErrorText] = useState<string>('');
  const sliderRef = useRef<HTMLInputElement>(null);
  const isProcessing = step === 'PROCESSING';

  useEffect(() => {
    if (isOpen) {
        setStep('REVIEW');
        setSliderValue(0);
        setErrorText('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePurchase = async () => {
      if (step !== 'REVIEW') return;
      setStep('PROCESSING');
      setSliderValue(100);

      const result = await onConfirm();
      if (result.ok) {
          setStep('SUCCESS');
      } else {
          setErrorText(result.error ?? 'Nie udało się zrealizować zakupu.');
          setStep('ERROR');
      }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (step !== 'REVIEW') return;
      const val = parseInt(e.target.value);
      setSliderValue(val);

      if (val >= 98) {
          handlePurchase();
      }
  };

  const handleTouchEnd = () => {
      if (sliderValue < 98) {
          // Snap back animation
          const snapInterval = setInterval(() => {
              setSliderValue(prev => {
                  if (prev <= 0) {
                      clearInterval(snapInterval);
                      return 0;
                  }
                  return prev - 5;
              });
          }, 10);
      }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full rounded-t-2xl md:rounded-2xl max-w-md overflow-hidden shadow-2xl transition-all h-[90vh] md:h-auto flex flex-col">

            {(step === 'REVIEW' || step === 'PROCESSING') && (
                <>
                    {/* Header Image */}
                    <div className="h-48 bg-slate-100 relative flex items-center justify-center overflow-hidden">
                        <div className={`absolute inset-0 opacity-20 bg-emerald-500`}></div>
                        <ShoppingCart size={64} className="text-emerald-700 relative z-10" />
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 bg-white/50 hover:bg-white p-2 rounded-full backdrop-blur-sm transition"
                        >
                            <X size={20} className="text-slate-800"/>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 flex-1 flex flex-col">
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">{service.name}</h2>
                        <p className="text-slate-500 text-sm mb-6 leading-relaxed">{service.description}</p>

                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-auto">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-slate-400 uppercase">Cena</span>
                                <span className="text-xl font-bold text-slate-800">{service.price} pkt</span>
                            </div>
                            <div className="h-px bg-slate-200 my-2"></div>
                            <div className="flex justify-between items-center text-xs text-slate-500">
                                <span>Typ usługi</span>
                                <span className="font-medium bg-white px-2 py-1 rounded border border-slate-200">{service.type}</span>
                            </div>
                        </div>

                        {/* SLIDE TO PAY */}
                        <div className="mt-8 relative h-14 bg-slate-100 rounded-full border border-slate-200 overflow-hidden select-none">
                            <div
                                className="absolute left-0 top-0 bottom-0 bg-emerald-500 transition-all duration-75"
                                style={{ width: `${sliderValue}%` }}
                            ></div>

                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className={`text-sm font-bold uppercase tracking-wider transition-colors ${sliderValue > 50 ? 'text-white' : 'text-slate-400'}`}>
                                    {isProcessing ? 'Przetwarzanie...' : 'Przesuń aby zapłacić'}
                                </span>
                            </div>

                            <input
                                ref={sliderRef}
                                type="range"
                                min="0"
                                max="100"
                                value={sliderValue}
                                onChange={handleSliderChange}
                                onTouchEnd={handleTouchEnd}
                                onMouseUp={handleTouchEnd}
                                disabled={isProcessing}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            />

                            {/* Thumb Visualization */}
                            <div
                                className="absolute top-1 bottom-1 w-12 bg-white rounded-full shadow-md flex items-center justify-center transition-all duration-75 z-10 pointer-events-none"
                                style={{ left: `calc(${sliderValue}% - ${sliderValue * 0.48}px + 4px)` }}
                            >
                                {isProcessing ? <Loader2 size={20} className="animate-spin text-emerald-600"/> : <ChevronRight size={24} className="text-emerald-600" />}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {step === 'SUCCESS' && (
              <div className="flex flex-col h-full">
                <div className="bg-emerald-600 p-8 text-center text-white shrink-0">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} /></div>
                  <h2 className="text-2xl font-bold">{service.fulfillment === 'auto' ? 'Aplikacja aktywna' : 'Zamówienie przyjęte'}</h2>
                  <p className="text-emerald-100 text-sm mt-1">Pobraliśmy {service.price} pkt z Twojego portfela.</p>
                </div>
                <div className="bg-white flex-1 p-6 flex flex-col items-center justify-center text-center gap-4">
                  {service.fulfillment === 'auto' ? (
                    <>
                      <p className="text-slate-600 text-sm max-w-xs">„{service.name}" jest już odblokowana. Znajdziesz ją też w sekcji „Twoje Aplikacje".</p>
                      {onOpenApp && (
                        <button onClick={onOpenApp} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition flex items-center justify-center gap-2">
                          <ExternalLink size={18} /> Otwórz
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-600 text-sm max-w-xs">
                      Biuro Obsługi Klienta prześle kod lub aktywację na <span className="font-semibold text-slate-800">{userEmail ?? 'Twój e-mail'}</span> w ciągu {BOK_SLA_TEXT}.
                    </p>
                  )}
                  <button onClick={onClose} className="w-full py-3 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition">Wróć do sklepu</button>
                </div>
              </div>
            )}
            {step === 'ERROR' && (
              <div className="flex flex-col h-full">
                <div className="bg-rose-600 p-8 text-center text-white shrink-0">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} /></div>
                  <h2 className="text-2xl font-bold">Zakup nie przeszedł</h2>
                  <p className="text-rose-100 text-sm mt-1">Punkty nie zostały pobrane.</p>
                </div>
                <div className="bg-white flex-1 p-6 flex flex-col items-center justify-center text-center gap-4">
                  <p className="text-slate-600 text-sm max-w-xs">{errorText}</p>
                  <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition">Zamknij</button>
                </div>
              </div>
            )}

        </div>
    </div>
  );
};
