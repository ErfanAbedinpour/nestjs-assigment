export abstract class AggregateRoot<TEvent> {
  private readonly pendingEvents: TEvent[] = [];

  protected record(event: TEvent): void {
    this.pendingEvents.push(event);
  }

  pullDomainEvents(): TEvent[] {
    return this.pendingEvents.splice(0, this.pendingEvents.length);
  }
}
