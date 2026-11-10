/**
 * Runs the callback in one atomic unit. Nested calls join the unit that is
 * already open so a use case and the collaborators it calls commit together.
 */
export abstract class UnitOfWork {
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
