import { User } from './user';

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | undefined>;
  abstract findByEmail(email: string): Promise<User | undefined>;
  /** Row-level lock. Must be called inside an active unit of work. */
  abstract lockById(id: string): Promise<User | undefined>;
  abstract insert(user: User): Promise<void>;
  abstract save(user: User): Promise<void>;
}
