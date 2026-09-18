export type MoneyUnit = 'USD' | 'COIN';
export const MAX_MINOR = 9223372036854775807n;
const precision: Record<MoneyUnit, number> = { USD: 2, COIN: 0 };

export function assertMinor(value: bigint): bigint {
  if (value < 0n || value > MAX_MINOR)
    throw new RangeError('Amount outside BIGINT range');
  return value;
}
export function parseMinor(value: string): bigint {
  if (!/^\d+$/.test(value) || value.length > 19)
    throw new Error('Expected integer minor units');
  return assertMinor(BigInt(value));
}
/** Parse decimal text without first passing through IEEE-754 numbers. Never round. */
export function decimalToMinor(value: string, unit: MoneyUnit): bigint {
  if (!/^\d+(?:\.\d+)?$/.test(value) || value.length > 24)
    throw new Error('Invalid decimal amount');
  const [whole = '', fraction = ''] = value.split('.');
  const scale = precision[unit];
  if (scale === undefined || fraction.length > scale)
    throw new Error('Unsupported amount precision');
  return assertMinor(
    BigInt(whole) * 10n ** BigInt(scale) +
      BigInt(fraction.padEnd(scale, '0') || '0'),
  );
}
export function minorToDecimal(value: bigint, unit: MoneyUnit): string {
  assertMinor(value);
  const scale = precision[unit];
  if (scale === undefined) throw new Error('Unknown money unit');
  if (!scale) return value.toString();
  const text = value.toString().padStart(scale + 1, '0');
  return `${text.slice(0, -scale)}.${text.slice(-scale)}`;
}
export function multiplyMinor(value: bigint, quantity: bigint): bigint {
  assertMinor(value);
  if (quantity < 0n) throw new RangeError('Negative quantity');
  return assertMinor(value * quantity);
}
export function formatMoney(value: bigint, unit: MoneyUnit): string {
  const [whole = '', fraction] = minorToDecimal(value, unit).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Keep the existing storefront's two-decimal coin presentation; coin arithmetic is integral.
  return `${unit === 'USD' ? '$' : '★ '}${grouped}.${fraction ?? '00'}`;
}
