import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { GetUserQuery } from '../query/get-user.query';
import { DomainError } from '../../../../shared/domain/error/domain.error';
import { UserRepository } from '../../domain/repository/user.repository';
import { toUserView, type UserView } from '../user.view';

@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery> {
  constructor(private readonly users: UserRepository) {}

  async execute({ userId }: GetUserQuery): Promise<UserView> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new DomainError('USER_NOT_FOUND', 'User was not found');
    }
    return toUserView(user);
  }
}
