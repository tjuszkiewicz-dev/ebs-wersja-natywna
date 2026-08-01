import { describe, it, expect } from 'vitest';
import { resolvePoppedView } from './useHistoryView';

// Testujemy wylacznie czysta logike decyzyjna (bez React/DOM - projekt nie ma jsdom/
// @testing-library/react skonfigurowanego w vitest.config.ts, environment: 'node').
// Pelny hook (useEffect/useRef/window.history) wymagalby srodowiska DOM i renderHook,
// co jest poza zakresem tej poprawki - patrz task-13-report.md.
describe('resolvePoppedView', () => {
  it('ignoruje wartosc spoza znanych widokow (obcy/uszkodzony wpis w history.state)', () => {
    expect(resolvePoppedView('nieznany-widok', new Set(['a', 'b']), 'a')).toBeNull();
  });

  it('ignoruje wartosc, ktora nie jest stringiem', () => {
    expect(resolvePoppedView(undefined, new Set(['a']), 'a')).toBeNull();
    expect(resolvePoppedView(null, new Set(['a']), 'a')).toBeNull();
    expect(resolvePoppedView(42, new Set(['a']), 'a')).toBeNull();
    expect(resolvePoppedView({}, new Set(['a']), 'a')).toBeNull();
  });

  it('ignoruje wartosc rowna biezacemu widokowi (brak zmiany - React zrobi bailout)', () => {
    expect(resolvePoppedView('b', new Set(['a', 'b']), 'b')).toBeNull();
  });

  it('akceptuje znany widok rozny od biezacego', () => {
    expect(resolvePoppedView('a', new Set(['a', 'b']), 'b')).toBe('a');
  });

  it('scenariusz: wejscie(A) -> B -> C, cofniecie do B (znane, rozne od C) -> akceptuje', () => {
    const known = new Set(['A', 'B', 'C']);
    expect(resolvePoppedView('B', known, 'C')).toBe('B');
  });

  it('scenariusz regresyjny (Finding 1): popstate dostarcza widok == aktualny -> null, nie "konsumuje"', () => {
    // To jest dokladnie sytuacja opisana w recenzji: App Router z czasem nadpisuje
    // history.state, wiec popstate z ebsView rownym biezacemu widokowi jest realny.
    // Zwrocenie null tutaj oznacza, ze hook NIE ustawi flagi fromPop, wiec nie zje
    // najblizszej prawdziwej zmiany widoku.
    expect(resolvePoppedView('C', new Set(['A', 'B', 'C']), 'C')).toBeNull();
  });
});
