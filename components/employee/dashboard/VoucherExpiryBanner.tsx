import React, { useEffect, useState, useCallback } from 'react';
import { Clock, AlertTriangle, CheckCircle, X, RefreshCw, Zap } from 'lucide-react';
import { VoucherStatus } from '../../../types';

interface Props {
  companyId: string;
  balance: number;        // voucherBalance — prawdziwy sygnał czy pracownik ma vouchery
  vouchers?: { status: string }[]; // opcjonalne — tylko do wykrycia statusu EXPIRED
}

interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface ExpiryConfig {
  day: number;
  hour: number;
  minute: number;
}

/** Returns THIS month's expiry datetime using the company's configured hour:minute. */
function thisMonthExpiryDate(day: number, hour: number, minute: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), day, hour, minute, 0, 0);
}

function calcCountdown(target: Date): CountdownState {
  const diff = Math.max(0, target.getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(n: number) { return String(n).padStart(2, '0'); }

export const VoucherExpiryBanner: React.FC<Props> = ({ companyId, balance, vouchers = [] }) => {
  const [expiryDay,    setExpiryDay]    = useState<number | null>(null);
  const [expiryHour,   setExpiryHour]   = useState<number>(0);
  const [expiryMinute, setExpiryMinute] = useState<number>(5);
  const [loading,      setLoading]      = useState(true);
  const [countdown,    setCountdown]    = useState<CountdownState | null>(null);
  const [showModal,    setShowModal]    = useState(false);
  const [activating,   setActivating]   = useState(false);
  const [activated,    setActivated]    = useState(false);
  const [activateErr,  setActivateErr]  = useState<string | null>(null);
  const [dismissed,    setDismissed]    = useState(false);

  // Primary signal: employee has/had vouchers
  const hasBalance = balance > 0 || vouchers.some(v =>
    [VoucherStatus.DISTRIBUTED, VoucherStatus.ACTIVE, VoucherStatus.EXPIRED].includes(v.status as VoucherStatus)
  );

  // Fetch company's expiry day
  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/companies/${companyId}`)
      .then(r => r.json())
      .then(d => {
        setExpiryDay(d.voucher_expiry_day ?? 10);
        setExpiryHour(d.voucher_expiry_hour ?? 0);
        setExpiryMinute(d.voucher_expiry_minute ?? 5);
        setLoading(false);
      })
      .catch(() => {
        setExpiryDay(10);
        setLoading(false);
      });
  }, [companyId]);

  // Countdown to THIS month's expiry (stays at 0 when past — does NOT jump to next month)
  useEffect(() => {
    if (expiryDay === null || !hasBalance) return;
    const update = () => setCountdown(calcCountdown(thisMonthExpiryDate(expiryDay, expiryHour, expiryMinute)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiryDay, expiryHour, expiryMinute, hasBalance]);

  const handleActivate = useCallback(async () => {
    setActivating(true);
    setActivateErr(null);
    try {
      const res = await fetch('/api/vouchers/activate', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setActivated(true);
    } catch (e: any) {
      setActivateErr(e.message ?? 'Błąd aktywacji');
    } finally {
      setActivating(false);
    }
  }, []);

  if (loading || expiryDay === null || !hasBalance || !countdown || dismissed) return null;

  const isExpired = countdown.days === 0 && countdown.hours === 0 &&
    countdown.minutes === 0 && countdown.seconds === 0;

  // Activation success state
  if (activated) {
    return (
      <div className="rounded-2xl px-5 py-4 flex items-center gap-4 bg-green-50 border border-green-200 relative">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-100">
          <CheckCircle size={20} className="text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-green-700">Vouchery zostały aktywowane!</p>
          <p className="text-xs text-green-500">Możesz korzystać z benefitów. Następne wygaśnięcie: {expiryDay}. dnia przyszłego miesiąca o {String(expiryHour).padStart(2,'0')}:{String(expiryMinute).padStart(2,'0')}.</p>
        </div>
        <button onClick={() => setDismissed(true)} className="flex-shrink-0 p-1.5 rounded-full hover:bg-green-200 text-green-400 transition" aria-label="Zamknij"><X size={16} /></button>
      </div>
    );
  }

  // Expired state — show "Aktywuj vouchery" button directly in banner
  if (isExpired) {
    return (
      <div className="rounded-2xl px-5 py-4 flex items-center gap-4 bg-orange-50 border border-orange-200 relative">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-100">
          <AlertTriangle size={20} className="text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-orange-700">Vouchery wygasły</p>
          {activateErr
            ? <p className="text-xs text-red-500 mt-0.5">{activateErr}</p>
            : <p className="text-xs text-orange-500">Wygasły {expiryDay}. dnia miesiąca o {String(expiryHour).padStart(2,'0')}:{String(expiryMinute).padStart(2,'0')}. Aktywuj je, aby korzystać z benefitów.</p>
          }
        </div>
        <button
          onClick={handleActivate}
          disabled={activating}
          className="flex-shrink-0 px-4 py-2 rounded-xl font-bold text-sm text-white bg-orange-500 hover:bg-orange-600 active:bg-orange-700 transition disabled:opacity-60 flex items-center gap-2"
        >
          {activating
            ? <><RefreshCw size={14} className="animate-spin" /> Aktywuję...</>
            : <><Zap size={14} /> Aktywuj vouchery</>
          }
        </button>
        <button onClick={() => setDismissed(true)} className="flex-shrink-0 p-1.5 rounded-full hover:bg-orange-200 text-orange-400 transition" aria-label="Zamknij"><X size={16} /></button>
      </div>
    );
  }

  // Normal countdown banner
  return (
    <>
      <div
        className="rounded-2xl px-5 py-4 flex items-center gap-4 transition-all bg-amber-50 border border-amber-200"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-100 cursor-pointer" onClick={() => setShowModal(true)}>
          <Clock size={20} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowModal(true)}>
          <p className="text-sm font-bold text-amber-700">Vouchery wygasną {expiryDay}. dnia miesiąca o {String(expiryHour).padStart(2,'0')}:{String(expiryMinute).padStart(2,'0')}</p>
          <p className="text-xs text-amber-500">
            Pozostało: {countdown.days}d {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 bg-amber-500 text-white cursor-pointer" onClick={() => setShowModal(true)}>
          Szczegóły
        </span>
        <button onClick={() => setDismissed(true)} className="flex-shrink-0 p-1.5 rounded-full hover:bg-amber-200 text-amber-400 transition" aria-label="Zamknij"><X size={16} /></button>
      </div>

      {/* Modal — info o nadchodzącym wygaśnięciu */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 text-slate-400">
              <X size={18} />
            </button>

            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto bg-amber-100">
              <Clock size={28} className="text-amber-600" />
            </div>

            <h2 className="text-xl font-black text-slate-900 text-center mb-1">Zbliża się wygaśnięcie</h2>
            <p className="text-sm text-slate-500 text-center mb-6">
              Twoje vouchery wygasą {expiryDay}. dnia bieżącego miesiąca o godz. {String(expiryHour).padStart(2,'0')}:{String(expiryMinute).padStart(2,'0')}.
              Po wygaśnięciu użyj przycisku „Aktywuj vouchery", aby je przywrócić.
            </p>

            <div className="rounded-2xl px-4 py-4 text-center mb-6 bg-amber-50">
              <div className="flex justify-center gap-4">
                {[
                  { val: countdown.days, label: 'Dni' },
                  { val: countdown.hours, label: 'Godz' },
                  { val: countdown.minutes, label: 'Min' },
                ].map(({ val, label }) => (
                  <div key={label} className="text-center">
                    <p className="text-3xl font-black text-amber-600">{val}</p>
                    <p className="text-xs text-amber-400 font-semibold uppercase">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs mt-2 text-amber-400">
                Do wygaśnięcia ({expiryDay}. dnia miesiąca, godz. {String(expiryHour).padStart(2,'0')}:{String(expiryMinute).padStart(2,'0')})
              </p>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-3 rounded-xl font-bold text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Zamknij
            </button>
          </div>
        </div>
      )}
    </>
  );
};
