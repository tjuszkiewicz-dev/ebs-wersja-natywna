'use client';
// Panel szczegółów pozycji sklepu — cztery akcje (spec 2026-09-15 §5.4/§5.5, Task 9).
//
// Tokeny wizualne — przejęte 1:1 z components/employee/store/BenefitStore.tsx (komentarz
// nagłówkowy, Task 8), żeby panel nie wyglądał jak osobny ekran: jeden akcent `primary-*`
// (zieleń EBS — stąd `bg-primary-700` dla CTA „Otwórz", ten sam ton co odznaka `open` na
// kafelku), `rounded-t-3xl`/`rounded-l-3xl` na kontenerze panelu (rodzina `rounded-2xl` z
// reszty sklepu), `rounded-xl` na przyciskach, `shadow-2xl` (spójne z modalem zakupu),
// `focus-visible` ring (`FOCUS_RING`, identyczny jak w StoreHeader/StoreGrid/StoreCategories)
// na każdym klikalnym elemencie, i ruch spięty z `useReducedMotion` — zarówno na tle, jak
// i na samym panelu (brief animował tylko `aside`; tło jako zwykły `<div>` znikałoby
// natychmiast, podczas gdy panel jeszcze zjeżdża — ujednolicone na `motion.div`, żeby wejście
// i wyjście całej nakładki było jedną spójną animacją, tak jak w powłoce sklepu).
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X, CheckCircle2, Loader2 } from 'lucide-react';
import type { ServiceItem, PurchaseResult } from '@/types';
import { APP_TAB_BY_SERVICE, type StoreAction, type EmployeeAppTab } from '@/lib/benefits/catalog';
import { BOK_SLA_TEXT } from '@/lib/benefits/constants';
import { RedemptionModal } from '../RedemptionModal';

interface Props {
  item: ServiceItem;
  action: StoreAction;
  balance: number;
  canTransact: boolean;
  userEmail?: string;
  onClose: () => void;
  onPurchase: (item: ServiceItem) => Promise<PurchaseResult>;
  onOpenApp: (tab: EmployeeAppTab) => void;
}

type InquiryState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; reportedAt?: string }
  | { kind: 'error'; message: string };

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2';

export function StoreDetail({ item, action, balance, canTransact, userEmail, onClose, onPurchase, onOpenApp }: Props) {
  const [buying, setBuying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [inquiry, setInquiry] = useState<InquiryState>({ kind: 'idle' });
  const reduceMotion = useReducedMotion();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const asideRef = useRef<HTMLElement>(null);

  // Fokus wjeżdża w panel przy otwarciu (na przycisk zamknięcia — pierwszy sensowny,
  // widoczny cel) i wraca dokładnie tam, skąd przyszedł, przy odmontowaniu — użytkownik
  // klawiatury/czytnika ekranu nie gubi miejsca w siatce sklepu za panelem.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus();
    };
  }, []);

  // Escape zamyka najpierw najwyższą warstwę: modal zakupu, jeśli jest otwarty (tak samo jak
  // jego własny przycisk X), a dopiero potem panel — bez tego przypadkowy Escape w trakcie
  // „Przetwarzanie…" ucinałby cały panel (i modal razem z nim) bez pokazania wyniku zakupu.
  // Gdy zakup jest faktycznie w locie (processing), Escape nie robi NIC — ten fetch nie da się
  // cofnąć, więc zniknięcie modalu bez pokazania SUCCESS/ERROR ukryłoby, czy punkty zeszły.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Prosty focus trap (zawijanie Tab/Shift+Tab w obrębie panelu) — tylko gdy modal zakupu
      // nie jest zamontowany (wtedy fokus i tak żyje w jego własnym poddrzewie DOM, poza asideRef).
      if (e.key === 'Tab' && !buying && asideRef.current) {
        const focusable = asideRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (e.key !== 'Escape') return;
      if (processing) return;
      if (buying) { setBuying(false); return; }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [processing, buying, onClose]);

  const sendInquiry = async () => {
    setInquiry({ kind: 'sending' });
    try {
      const res = await fetch('/api/benefits/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: item.id }),
      });
      if (res.ok) { setInquiry({ kind: 'done' }); return; }
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) { setInquiry({ kind: 'done', reportedAt: body.reportedAt }); return; }
      setInquiry({ kind: 'error', message: typeof body.error === 'string' ? body.error : 'Nie udało się wysłać zapytania.' });
    } catch {
      setInquiry({ kind: 'error', message: 'Brak połączenia. Spróbuj ponownie.' });
    }
  };

  const tab = APP_TAB_BY_SERVICE[item.id];

  const cta = () => {
    if (!canTransact && action !== 'open') {
      return (
        <button disabled className="w-full h-12 rounded-xl bg-slate-200 text-slate-500 font-semibold cursor-not-allowed">
          Tylko dla pracowników
        </button>
      );
    }
    switch (action) {
      case 'open':
        return (
          <button
            onClick={() => tab && onOpenApp(tab)}
            className={`w-full h-12 rounded-xl bg-primary-700 text-white font-semibold transition hover:bg-primary-800 ${FOCUS_RING}`}
          >
            Otwórz
          </button>
        );
      case 'insufficient':
        return (
          <button disabled className="w-full h-12 rounded-xl bg-slate-200 text-slate-500 font-semibold cursor-not-allowed">
            Brakuje {item.price - balance} pkt
          </button>
        );
      case 'buy':
        return (
          <button
            onClick={() => setBuying(true)}
            className={`w-full h-12 rounded-xl bg-slate-900 text-white font-semibold transition hover:bg-slate-800 ${FOCUS_RING}`}
          >
            Kup za {item.price} pkt
          </button>
        );
      case 'inquire':
        if (inquiry.kind === 'done') {
          const when = inquiry.reportedAt ? new Date(inquiry.reportedAt).toLocaleDateString('pl-PL') : null;
          return (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 flex gap-3">
              <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
              <span>{when ? `Zgłoszone ${when}.` : 'Zgłoszone ✓'} BOK odezwie się w ciągu {BOK_SLA_TEXT}.</span>
            </div>
          );
        }
        return (
          <div className="space-y-2">
            <button
              onClick={sendInquiry}
              disabled={inquiry.kind === 'sending'}
              className={`w-full h-12 rounded-xl bg-amber-500 text-white font-semibold transition hover:bg-amber-600 disabled:opacity-60 flex items-center justify-center gap-2 ${FOCUS_RING}`}
            >
              {inquiry.kind === 'sending' ? <><Loader2 size={18} className="animate-spin" /> Wysyłanie…</> : 'Zapytaj o ofertę'}
            </button>
            {inquiry.kind === 'error' && <p className="text-sm text-rose-600">{inquiry.message}</p>}
            <p className="text-xs text-slate-500">Jedno kliknięcie — BOK skontaktuje się z Tobą w ciągu {BOK_SLA_TEXT}.</p>
          </div>
        );
    }
  };

  return (
    <>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
        className="fixed inset-0 z-[110] bg-slate-900/40"
        onClick={() => { if (!processing) onClose(); }}
        aria-hidden
      />
      <motion.aside
        initial={reduceMotion ? false : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduceMotion ? undefined : { y: 40, opacity: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        className="fixed z-[120] inset-x-0 bottom-0 md:inset-y-0 md:right-0 md:left-auto md:w-[440px] bg-white rounded-t-3xl md:rounded-none md:rounded-l-3xl shadow-2xl overflow-y-auto max-h-[92vh] md:max-h-none"
      >
        <div className="relative aspect-[16/9] bg-slate-100">
          {item.image && <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Zamknij"
            className={`absolute top-1 right-1 p-3 rounded-full bg-white/90 text-slate-800 shadow transition hover:bg-white ${FOCUS_RING}`}
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            {item.partner && <p className="text-xs uppercase tracking-wider text-slate-500">{item.partner}</p>}
            <h2 className="text-xl font-bold text-slate-900 mt-1 text-balance">{item.name}</h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.description}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 p-4">
            <span className="text-xs font-bold uppercase text-slate-400">Cena</span>
            <span className="text-lg font-bold text-slate-900">{item.price > 0 ? `${item.price} pkt` : 'Zapytaj o ofertę'}</span>
          </div>
          {cta()}
        </div>
      </motion.aside>
      <AnimatePresence>
        {buying && (
          <RedemptionModal
            key="redemption"
            isOpen
            service={item}
            onClose={() => { setBuying(false); onClose(); }}
            onConfirm={() => onPurchase(item)}
            userEmail={userEmail}
            onOpenApp={tab ? () => { setBuying(false); onClose(); onOpenApp(tab); } : undefined}
            onProcessingChange={setProcessing}
          />
        )}
      </AnimatePresence>
    </>
  );
}
