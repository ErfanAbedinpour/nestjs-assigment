/** Raised by repositories when the database rejects a duplicate unique key. */
export class UniqueConstraintError extends Error {
  constructor() {
    super('Unique constraint violated');
    this.name = 'UniqueConstraintError';
  }
}
