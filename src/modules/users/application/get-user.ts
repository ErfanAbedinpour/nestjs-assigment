import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../shared/domain/domain-error';
import { UserRepository } from '../domain/user.repository';
import { toUserView, type UserView } from './user.view';

@Injectable()
export class GetUser {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<UserView> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new DomainError('USER_NOT_FOUND', 'User was not found');
    }
    return toUserView(user);
  }

  async balanceOf(userId: string): Promise<bigint | undefined> {
    const user = await this.users.findById(userId);
    return user?.snapshot().balance.toMinorUnits();
  }
}
