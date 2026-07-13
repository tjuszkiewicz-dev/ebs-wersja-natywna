import { describe, it, expect } from 'vitest';
import { isValidIBAN, formatIBAN } from './iban';

describe('isValidIBAN', () => {
  it('accepts a valid IBAN (canonical GB example)', () => {
    expect(isValidIBAN('GB82 WEST 1234 5698 7654 32')).toBe(true);
  });
  it('accepts a valid PL IBAN', () => {
    expect(isValidIBAN('PL61 1090 1014 0000 0712 1981 2874')).toBe(true);
  });
  it('rejects a wrong checksum', () => {
    expect(isValidIBAN('GB82 WEST 1234 5698 7654 33')).toBe(false);
  });
  it('rejects too short / empty / non-iban', () => {
    expect(isValidIBAN('PL12')).toBe(false);
    expect(isValidIBAN('')).toBe(false);
    expect(isValidIBAN('66 1160 2202')).toBe(false);
  });
});

describe('formatIBAN', () => {
  it('groups into blocks of 4', () => {
    expect(formatIBAN('PL61109010140000071219812874')).toBe('PL61 1090 1014 0000 0712 1981 2874');
  });
});
