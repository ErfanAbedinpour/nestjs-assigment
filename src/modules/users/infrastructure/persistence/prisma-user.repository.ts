import { Injectable } from '@nestjs/common';
import { Money } from '../../../../shared/domain/money';
import { UniqueConstraintError } from '../../../../shared/application/unique-constraint.error';
import { isUniqueConstraintError } from '../../../../shared/infrastructure/persistence/prisma-errors';
import { PrismaUnitOfWork } from '../../../../shared/infrastructure/persistence/prisma-unit-of-work';
import { User } from '../../domain/user';
import { UserRepository } from '../../domain/user.repository';

type UserRow = {
  id: string;
  email: string;
  name: string;
  balance: bigint;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly unitOfWork: PrismaUnitOfWork) {
    super();
  }

  override async findById(id: string): Promise<User | undefined> {
    const row = await this.unitOfWork.client().user.findUnique({ where: { id } });
    return row ? toUser(row) : undefined;
  }

  override async findByEmail(email: string): Promise<User | undefined> {
    const row = await this.unitOfWork.client().user.findUnique({ where: { email } });
    return row ? toUser(row) : undefined;
  }

  override async lockById(id: string): Promise<User | undefined> {
    const transaction = this.unitOfWork.requireTransaction();
    // The lock is held until the surrounding transaction commits, so concurrent
    // credits and debits for the same user are serialized.
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE
    `;
    if (locked[0] === undefined) return undefined;
    const row = await transaction.user.findUnique({ where: { id } });
    return row ? toUser(row) : undefined;
  }

  override async insert(user: User): Promise<void> {
    const snapshot = user.snapshot();
    try {
      await this.unitOfWork.client().user.create({
        data: {
          id: snapshot.id,
          email: snapshot.email,
          name: snapshot.name,
          balance: snapshot.balance.toMinorUnits(),
          createdAt: snapshot.createdAt,
          updatedAt: snapshot.updatedAt,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new UniqueConstraintError();
      throw error;
    }
  }

  override async save(user: User): Promise<void> {
    const snapshot = user.snapshot();
    await this.unitOfWork.client().user.update({
      where: { id: snapshot.id },
      data: {
        email: snapshot.email,
        name: snapshot.name,
        balance: snapshot.balance.toMinorUnits(),
        updatedAt: snapshot.updatedAt,
      },
    });
  }
}

function toUser(row: UserRow): User {
  return User.rehydrate({
    id: row.id,
    email: row.email,
    name: row.name,
    balance: Money.ofMinorUnits(row.balance),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
