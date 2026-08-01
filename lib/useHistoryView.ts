'use client';
import { useEffect, useRef } from 'react';

// Czysta logika decyzyjna (bez React/DOM) - testowalna w izolacji w Vitest (environment: 'node').
// Zwraca widok, ktory nalezy ustawic po popstate, albo null jesli wpis nalezy zignorowac:
//  - rawValue nie jest stringiem (uszkodzony/obcy wpis w history.state),
//  - rawValue nie nalezy do zbioru widokow wypchnietych przez ten hook (obcy/uszkodzony wpis),
//  - rawValue === currentView (brak zmiany -> React zrobi bailout, nie ma czego "skonsumowac"
//    flaga fromPop nie powinna zostac ustawiona, bo zjadlaby kolejna, prawdziwa nawigacje).
export function resolvePoppedView(
  rawValue: unknown,
  knownViews: ReadonlySet<string>,
  currentView: string
): string | null {
  if (typeof rawValue !== 'string') return null;
  if (!knownViews.has(rawValue)) return null;
  if (rawValue === currentView) return null;
  return rawValue;
}

// Historia ekranow SPA: kazda zmiana widoku dokłada wpis do historii przegladarki,
// dzieki czemu "wstecz" cofa do poprzedniego ekranu zamiast wychodzic z aplikacji.
export function useHistoryView(view: string, setView: (v: string) => void) {
  const fromPop = useRef(false);
  const first = useRef(true);
  const setViewRef = useRef(setView);
  setViewRef.current = setView;
  // Aktualnie renderowany widok - do porownania wewnatrz handlera popstate
  // (ktory jest rejestrowany raz, wiec nie moze polegac na domknieciu z pierwszego renderu).
  const viewRef = useRef(view);
  viewRef.current = view;
  // Widoki, ktore ten hook sam wypchnal/zainicjowal w tej sesji - jedyne akceptowane
  // z historii przegladarki (chroni przed obcym/uszkodzonym wpisem w history.state).
  const knownViews = useRef<Set<string>>(new Set([view]));

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const v = (e.state as any)?.ebsView;
      const resolved = resolvePoppedView(v, knownViews.current, viewRef.current);
      if (resolved === null) return;
      fromPop.current = true;
      setViewRef.current(resolved);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (fromPop.current) { fromPop.current = false; return; }
    knownViews.current.add(view);
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
