import { createHash } from 'node:crypto';

export function paymentFingerprint(input: {
  userId: string;
  amount: string;
  reference: string;
  description: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify([input.userId, input.amount, input.reference, input.description]),
    )
    .digest('hex');
}

export function truncateReason(reason: string): string {
  const normalized = reason.trim();
  const text = normalized.length > 0 ? normalized : 'Technical payment failure';
  return text.length <= 500 ? text : text.slice(0, 500);
}
