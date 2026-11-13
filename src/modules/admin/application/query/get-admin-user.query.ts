import { Query } from '@nestjs/cqrs';
import type { AdminUserView } from '../admin-read-models';
export class GetAdminUserQuery extends Query<AdminUserView> {
  constructor(public readonly userId: string) {
    super();
  }
}
