'use client';

import React, { useState, useCallback } from 'react';
import type { Firma, Pracownik, GlobalneWyniki, CalcConfig } from '@/lib/agencja/tax-engine/types';
import { DEFAULT_CONFIG } from '@/lib/agencja/tax-engine/constants';
import { Step0Company } from './steps/Step0Company';
import { Step1Employees } from './steps/Step1Employees';
import { Step2Standard } from './steps/Step2Standard';
import { Step3Split } from './steps/Step3Split';
import { Step4BusinessCase } from './steps/Step4BusinessCase';
import { Step5Summary } from './steps/Step5Summary';
import { ChevronLeft, ChevronRight, Calculator } from 'lucide-react';

const STEPS = [
  { id: 0, label: 'Firma' },
  { id: 1, label: 'Pracownicy' },
  { id: 2, label: 'Model Standard' },
  { id: 3, label: 'Model Ofertowy' },
  { id: 4, label: 'Oszczędności' },
  { id: 5, label: 'Podsumowanie' },
];

const TEAL = '#4a95a9';

export default function CalculatorWizard() {
  const [step, setStep] = useState(0);
  const [firma, setFirma] = useState<Firma>({
    nazwa: '',
    nip: '',
    adres: '',
    kodPocztowy: '',
    miasto: '',
    email: '',
    telefon: '',
    osobaKontaktowa: '',
    okres: new Date().toISOString().slice(0, 7),
    stawkaWypadkowa: 1.67,
  });
  const [pracownicy, setPracownicy] = useState<Pracownik[]>([]);
  const [provisionPct, setProvisionPct] = useState(28);
  const [wyniki, setWyniki] = useState<GlobalneWyniki | null>(null);
  const [config] = useState<CalcConfig>(DEFAULT_CONFIG);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  const runCalculation = useCallback(async () => {
    if (pracownicy.length === 0) return;
    setIsCalculating(true);
    setCalcError(null);
    try {
      const res = await fetch('/api/crm/kalkulator/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firma, pracownicy, provisionPct }),
      });
      if (!res.ok) throw new Error('Błąd obliczenia');
      const data = await res.json();
      setWyniki(data.wyniki);
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : 'Nieznany błąd');
    } finally {
      setIsCalculating(false);
    }
  }, [firma, pracownicy, provisionPct]);

  const goNext = async () => {
    if (step === 1) await runCalculation();
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const canNext = () => {
    if (step === 0) return firma.nazwa.trim().length > 0;
    if (step === 1) return pracownicy.length > 0;
    return true;
  };

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: '#f0f7fa', fontFamily: '"Segoe UI", system-ui, sans-serif' }}>
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: TEAL }}>
          <Calculator size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Kalkulator Ofertowy</h1>
          <p className="text-xs text-slate-500">Symulacja optymalizacji kosztów zatrudnienia</p>
        </div>
      </div>

      {/* Step progress */}
      <div className="bg-white border-b border-slate-100 px-6 py-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {STEPS.map((s, idx) => (
            <React.Fragment key={s.id}>
              <button
                onClick={() => idx <= step ? setStep(idx) : undefined}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  idx === step
                    ? 'text-white shadow-sm'
                    : idx < step
                    ? 'text-white/80 opacity-80'
                    : 'bg-slate-100 text-slate-400'
                }`}
                style={idx <= step ? { backgroundColor: TEAL } : undefined}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  idx < step ? 'bg-white/30' : idx === step ? 'bg-white/20' : 'bg-slate-200 text-slate-400'
                }`}>
                  {idx + 1}
                </span>
                {s.label}
              </button>
              {idx < STEPS.length - 1 && <div className="w-4 h-px bg-slate-200 flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6">
            {calcError && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {calcError}
              </div>
            )}
            {step === 0 && <Step0Company firma={firma} onFirmaChange={setFirma} onLeadPicked={setLeadId} />}
            {step === 1 && (
              <Step1Employees
                pracownicy={pracownicy}
                onPracownicyChange={setPracownicy}
                config={config}
              />
            )}
            {step === 2 && wyniki && <Step2Standard wyniki={wyniki} pracownicy={pracownicy} />}
            {step === 3 && wyniki && <Step3Split wyniki={wyniki} pracownicy={pracownicy} />}
            {step === 4 && wyniki && (
              <Step4BusinessCase
                wyniki={wyniki}
                firma={firma}
                provisionPct={provisionPct}
                onProvisionChange={setProvisionPct}
                onRecalculate={runCalculation}
                isCalculating={isCalculating}
              />
            )}
            {step === 5 && wyniki && (
              <Step5Summary
                firma={firma}
                pracownicy={pracownicy}
                wyniki={wyniki}
                provisionPct={provisionPct}
                leadId={leadId}
              />
            )}
            {(step === 2 || step === 3 || step === 4 || step === 5) && !wyniki && (
              <div className="text-center py-12 text-slate-400">
                <Calculator size={48} className="mx-auto mb-3 opacity-30" />
                <p>Wróć do kroku "Pracownicy" i przelicz.</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="border-t border-slate-100 px-6 py-4 flex justify-between items-center bg-slate-50/50">
            <button
              onClick={() => setStep(s => Math.max(s - 1, 0))}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              Wstecz
            </button>

            <span className="text-xs text-slate-400">{step + 1} / {STEPS.length}</span>

            {step < STEPS.length - 1 ? (
              <button
                onClick={goNext}
                disabled={!canNext() || isCalculating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: TEAL }}
              >
                {isCalculating ? 'Liczę…' : 'Dalej'}
                <ChevronRight size={16} />
              </button>
            ) : (
              <span className="text-xs text-slate-400">Koniec — eksportuj raport</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
