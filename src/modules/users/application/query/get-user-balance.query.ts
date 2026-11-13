import { Query } from '@nestjs/cqrs';
export class GetUserBalanceQuery extends Query<bigint | undefined> {
  constructor(public readonly userId: string) {
    super();
  }
}
