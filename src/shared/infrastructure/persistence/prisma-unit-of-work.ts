import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../infrastructure/database/prisma/generated/client';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { UnitOfWork } from '../../application/ports/unit-of-work';

const transactionContext = new AsyncLocalStorage<Prisma.TransactionClient>();

/**
 * Binds a Prisma interactive transaction to the current async call stack.
 * Nested use cases join the transaction that is already open, so a payment
 * settlement and its balance debit commit or roll back as one unit.
 */
@Injectable()
export class PrismaUnitOfWork extends UnitOfWork {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  override run<T>(work: () => Promise<T>): Promise<T> {
    const current = transactionContext.getStore();
    if (current) return work();

    return this.prisma.$transaction(
      (transaction) => transactionContext.run(transaction, work),
      {
        maxWait: 5_000,
        timeout: 20_000,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }

  client(): Prisma.TransactionClient {
    return transactionContext.getStore() ?? this.prisma;
  }

  requireTransaction(): Prisma.TransactionClient {
    const current = transactionContext.getStore();
    if (!current) {
      throw new Error('This operation must run inside a unit of work');
    }
    return current;
  }
}
