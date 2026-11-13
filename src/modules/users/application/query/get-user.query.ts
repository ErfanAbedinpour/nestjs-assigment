import { Query } from '@nestjs/cqrs';
import type { UserView } from '../user.view';

export class GetUserQuery extends Query<UserView> {
  constructor(public readonly userId: string) {
    super();
  }
}
