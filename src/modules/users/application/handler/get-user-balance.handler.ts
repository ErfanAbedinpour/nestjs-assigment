import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { UserRepository } from '../../domain/repository/user.repository';
import { GetUserBalanceQuery } from '../query/get-user-balance.query';
@QueryHandler(GetUserBalanceQuery)
export class GetUserBalanceHandler implements IQueryHandler<GetUserBalanceQuery> {
  constructor(private readonly users: UserRepository) {}
  async execute(query: GetUserBalanceQuery): Promise<bigint | undefined> {
    const user = await this.users.findById(query.userId);
    return user?.snapshot().balance.toMinorUnits();
  }
}
