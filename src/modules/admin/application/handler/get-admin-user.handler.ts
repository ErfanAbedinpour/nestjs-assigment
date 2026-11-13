import { QueryHandler } from '@nestjs/cqrs';
import { AdminQueryPort } from '../ports/admin-query.port';
import { DomainError } from '../../../../shared/domain/error/domain.error';
import type { AdminUserView } from '../admin-read-models';
import { GetAdminUserQuery } from '../query/get-admin-user.query';
@QueryHandler(GetAdminUserQuery)
export class GetAdminUserHandler {
  constructor(private readonly queries: AdminQueryPort) {}
  async execute({ userId }: GetAdminUserQuery): Promise<AdminUserView> {
    const user = await this.queries.findUser(userId);
    if (!user) throw new DomainError('USER_NOT_FOUND', 'User was not found');
    return user;
  }
}
