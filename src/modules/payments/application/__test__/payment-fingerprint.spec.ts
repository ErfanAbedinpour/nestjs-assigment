import { describe, expect, it } from 'vitest';
import { paymentFingerprint, truncateReason } from '../payment-fingerprint';

describe('payment fingerprint', () => {
  it('is deterministic and distinguishes each request field', () => {
    const input = { userId: 'u', amount: '10', reference: 'r', description: 'd' };
    const fingerprint = paymentFingerprint(input);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(paymentFingerprint(input)).toBe(fingerprint);
    for (const field of Object.keys(input) as (keyof typeof input)[]) {
      expect(paymentFingerprint({ ...input, [field]: input[field] + 'x' })).not.toBe(
        fingerprint,
      );
    }
  });

  it('normalizes and limits failure reasons', () => {
    expect(truncateReason('  failure  ')).toBe('failure');
    expect(truncateReason('  ')).toBe('Technical payment failure');
    expect(truncateReason('x'.repeat(501))).toBe('x'.repeat(500));
  });
});
