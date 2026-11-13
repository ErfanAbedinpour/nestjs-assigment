import { Query } from '@nestjs/cqrs';
import type { AdminUserView, Page } from '../admin-read-models';
import type { PageRequest } from '../ports/admin-query.port';
export class ListAdminUsersQuery extends Query<Page<AdminUserView>> {
  constructor(public readonly page: PageRequest) {
    super();
  }
}
