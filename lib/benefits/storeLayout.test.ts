import { describe, it, expect } from 'vitest';
import { STORE_LAYOUT, EMPLOYEE_HOME, STORE_IS_HOME } from './storeLayout';

// Strażnik przełączników właściciela: sklep może być ekranem startowym tylko wtedy, gdy w ogóle
// istnieje (układ 'v2'). Kombinacja 'v1' + 'store' zostawiłaby pracownika bez Pulpitu i bez sklepu.
describe('storeLayout — przełączniki ekranu pracownika', () => {
  it('wartości mieszczą się w dopuszczalnych zbiorach', () => {
    expect(['v1', 'v2']).toContain(STORE_LAYOUT);
    expect(['wallet', 'store']).toContain(EMPLOYEE_HOME);
  });

  it('sklep jako ekran startowy wymaga układu v2', () => {
    if (STORE_IS_HOME) expect(STORE_LAYOUT).toBe('v2');
    if ((STORE_LAYOUT as string) === 'v1') expect(STORE_IS_HOME).toBe(false);
  });

  it('flaga STORE_IS_HOME odzwierciedla obie stałe', () => {
    expect(STORE_IS_HOME).toBe((STORE_LAYOUT as string) === 'v2' && (EMPLOYEE_HOME as string) === 'store');
  });
});
