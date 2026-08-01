'use client';
import { useEffect, useRef } from 'react';

// Historia ekranow SPA: kazda zmiana widoku dokłada wpis do historii przegladarki,
// dzieki czemu "wstecz" cofa do poprzedniego ekranu zamiast wychodzic z aplikacji.
export function useHistoryView(view: string, setView: (v: string) => void) {
  const fromPop = useRef(false);
  const first = useRef(true);
  const setViewRef = useRef(setView);
  setViewRef.current = setView;

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const v = (e.state as any)?.ebsView;
      if (typeof v === 'string') {
        fromPop.current = true;
        setViewRef.current(v);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (fromPop.current) { fromPop.current = false; return; }
    // Spread zachowuje stan routera Next.js - nadpisujemy tylko nasz klucz.
    const next = { ...(window.history.state || {}), ebsView: view };
    if (first.current) {
      first.current = false;
      window.history.replaceState(next, '');
    } else {
      window.history.pushState(next, '');
    }
  }, [view]);
}
