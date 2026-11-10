import { LedgerTransaction } from './ledger-transaction';

export abstract class LedgerRepository {
  abstract findByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<LedgerTransaction | undefined>;
  abstract append(entry: LedgerTransaction): Promise<void>;
}
