import { describe, it, expect } from 'vitest';
import { isWithinDedupWindow, INQUIRY_DEDUP_DAYS } from './inquiry';

describe('isWithinDedupWindow', () => {
  const now = new Date('2026-09-15T12:00:00Z');
  it('okno ma 7 dni', () => expect(INQUIRY_DEDUP_DAYS).toBe(7));
  it('zgłoszenie sprzed godziny → w oknie', () => {
    expect(isWithinDedupWindow('2026-09-15T11:00:00Z', now)).toBe(true);
  });
  it('zgłoszenie sprzed 6 dni 23 h → w oknie; sprzed 7 dni 1 h → poza', () => {
    expect(isWithinDedupWindow('2026-09-08T13:00:00Z', now)).toBe(true);
    expect(isWithinDedupWindow('2026-09-08T11:00:00Z', now)).toBe(false);
  });
  it('akceptuje Date i string', () => {
    expect(isWithinDedupWindow(new Date('2026-09-14T12:00:00Z'), now)).toBe(true);
  });
});
