import { QueryHandler } from '@nestjs/cqrs';
import { AdminQueryPort } from '../ports/admin-query.port';
import type { AdminUserView, Page } from '../admin-read-models';
import { ListAdminUsersQuery } from '../query/list-admin-users.query';
@QueryHandler(ListAdminUsersQuery)
export class ListAdminUsersHandler {
  constructor(private readonly queries: AdminQueryPort) {}
  execute({ page }: ListAdminUsersQuery): Promise<Page<AdminUserView>> {
    return this.queries.listUsers(page);
  }
}
