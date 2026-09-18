import { describe, expect, it } from 'vitest';
import {
  decimalToMinor,
  formatMoney,
  MAX_MINOR,
  minorToDecimal,
  multiplyMinor,
  parseMinor,
} from '@box/money';
describe('integer money', () => {
  it('parses USD and coins exactly and formats only at the display boundary', () => {
    expect(decimalToMinor('6.99', 'USD')).toBe(699n);
    expect(decimalToMinor('0.29', 'USD')).toBe(29n);
    expect(decimalToMinor('500', 'COIN')).toBe(500n);
    expect(minorToDecimal(699n, 'USD')).toBe('6.99');
    expect(minorToDecimal(500n, 'COIN')).toBe('500');
    expect(formatMoney(123456n, 'USD')).toBe('$1,234.56');
    expect(formatMoney(500n, 'COIN')).toBe('★ 500.00');
    expect(formatMoney(multiplyMinor(258n, 3n), 'USD')).toBe('$7.74');
  });
  it('retains values beyond the JSON safe integer range', () => {
    expect(decimalToMinor('90071992547409.93', 'USD')).toBe(9007199254740993n);
    expect(minorToDecimal(MAX_MINOR, 'USD')).toBe('92233720368547758.07');
    expect(parseMinor(MAX_MINOR.toString())).toBe(MAX_MINOR);
  });
  it('rejects negatives, fractional coins, excessive precision, exponents and overflow', () => {
    for (const text of [
      '-1',
      'NaN',
      'Infinity',
      '1e3',
      ' 1',
      '',
      '.5',
      '1.001',
      '92233720368547758.08',
    ])
      expect(() => decimalToMinor(text, 'USD')).toThrow();
    expect(() => decimalToMinor('1.0', 'COIN')).toThrow();
    expect(() => parseMinor('1.1')).toThrow();
    expect(() => parseMinor((MAX_MINOR + 1n).toString())).toThrow();
    expect(() => multiplyMinor(MAX_MINOR, 2n)).toThrow();
    expect(() => multiplyMinor(1n, -1n)).toThrow();
    expect(() => minorToDecimal(-1n, 'USD')).toThrow();
  });
});
