import { LedgerTransaction } from '../entity/ledger-transaction.entity';

export abstract class LedgerRepository {
  abstract findByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<LedgerTransaction | undefined>;
  abstract append(entry: LedgerTransaction): Promise<void>;
}
