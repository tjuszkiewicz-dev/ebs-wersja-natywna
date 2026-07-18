import { describe, it, expect } from 'vitest';
import { consumeTranslator, DAILY_LIMIT_S, TEXT_COST_S, VOICE_UTTER_COST_S } from './translatorLimit';

// consumeTranslator jest w większości sprzężone z DB (hr_translator_usage) — testujemy tylko
// czyste, wczesne gałęzie zwracające przed jakimkolwiek wywołaniem admin()/sieci:
// (1) role != 'pracownik_tymczasowy' → brak limitu, bez dotykania DB
// (2) id nie jest UUID (konto testowe) → traktowane jako bez zużycia, bez dotykania DB
// Właściwa ścieżka DB (odczyt/upsert hr_translator_usage) NIE jest testowana tutaj — DONE_WITH_CONCERNS.

describe('consumeTranslator (czyste gałęzie, bez DB)', () => {
  it('role inny niż pracownik_tymczasowy → brak limitu (limited:false), niezależnie od seconds', async () => {
    const state = await consumeTranslator({ id: 'anything', role: 'koordynator' }, 15);
    expect(state).toEqual({ limited: false, ok: true, used: 0, remaining: DAILY_LIMIT_S });
  });

  it('brak roli (undefined) → traktowane jak nie-pracownik_tymczasowy, brak limitu', async () => {
    const state = await consumeTranslator({ id: 'x' }, 0);
    expect(state.limited).toBe(false);
    expect(state.ok).toBe(true);
  });

  it('pracownik_tymczasowy z nie-UUID id (konto testowe) → limited:true, ok:true, 0 zużycia', async () => {
    const state = await consumeTranslator({ id: 'test-user-not-uuid', role: 'pracownik_tymczasowy' }, 15);
    expect(state).toEqual({ limited: true, ok: true, used: 0, remaining: DAILY_LIMIT_S });
  });

  it('inwariant: limit dzienny i koszty jednostkowe', () => {
    expect(DAILY_LIMIT_S).toBe(600);
    expect(TEXT_COST_S).toBe(15);
    expect(VOICE_UTTER_COST_S).toBe(15);
    // koszt jednej akcji nigdy nie powinien przekroczyć całego dziennego limitu
    expect(TEXT_COST_S).toBeLessThan(DAILY_LIMIT_S);
    expect(VOICE_UTTER_COST_S).toBeLessThan(DAILY_LIMIT_S);
  });
});
