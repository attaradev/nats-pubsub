import {
  OutboxRepository,
  OutboxEvent,
  OutboxStatus,
  CreateOutboxEventParams,
  FindOutboxEventsOptions,
} from './types';

/**
 * In-memory implementation of OutboxRepository
 *
 * Useful for:
 * - Testing without database dependencies
 * - Development environments
 * - Simple use cases where persistence isn't critical
 *
 * WARNING: Data is lost when the process restarts!
 * For production use, implement a database-backed repository.
 *
 * @example
 * ```typescript
 * const repository = new MemoryOutboxRepository();
 * const publisher = new OutboxPublisher(repository);
 * ```
 */
export class MemoryOutboxRepository implements OutboxRepository {
  private events: Map<string, OutboxEvent> = new Map();

  async findOrCreate(params: CreateOutboxEventParams): Promise<OutboxEvent> {
    const existing = this.events.get(params.eventId);
    if (existing) {
      return existing;
    }

    const now = new Date();
    const event: OutboxEvent = {
      eventId: params.eventId,
      subject: params.subject,
      payload: params.payload,
      headers: params.headers,
      status: OutboxStatus.PENDING,
      attempts: 0,
      enqueuedAt: params.enqueuedAt || now,
      createdAt: now,
      updatedAt: now,
    };

    this.events.set(event.eventId, event);
    return event;
  }

  async findByEventId(eventId: string): Promise<OutboxEvent | null> {
    return this.events.get(eventId) || null;
  }

  async findPending(options: FindOutboxEventsOptions = {}): Promise<OutboxEvent[]> {
    const { status = OutboxStatus.PENDING, limit = 100 } = options;

    const results = Array.from(this.events.values())
      .filter((event) => {
        if (event.status !== status) return false;
        if (options.olderThan && event.enqueuedAt > options.olderThan) return false;
        return true;
      })
      .sort((a, b) => a.enqueuedAt.getTime() - b.enqueuedAt.getTime())
      .slice(0, limit);

    return results;
  }

  async markAsPublishing(eventId: string): Promise<void> {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    event.status = OutboxStatus.PUBLISHING;
    event.updatedAt = new Date();
  }

  async markAsSent(eventId: string): Promise<void> {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    event.status = OutboxStatus.SENT;
    event.sentAt = new Date();
    event.updatedAt = new Date();
  }

  async markAsFailed(eventId: string, error: string): Promise<void> {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    event.status = OutboxStatus.FAILED;
    event.lastError = error;
    event.updatedAt = new Date();
  }

  async incrementAttempts(eventId: string): Promise<void> {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    event.attempts += 1;
    event.updatedAt = new Date();
  }

  async cleanup(olderThan: Date): Promise<number> {
    let deletedCount = 0;

    for (const [eventId, event] of this.events.entries()) {
      if (event.status === OutboxStatus.SENT && event.sentAt && event.sentAt < olderThan) {
        this.events.delete(eventId);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async resetStalePublishing(olderThan: Date): Promise<number> {
    let resetCount = 0;

    for (const event of this.events.values()) {
      if (event.status === OutboxStatus.PUBLISHING && event.updatedAt < olderThan) {
        event.status = OutboxStatus.PENDING;
        event.lastError = 'Reset from stale publishing state';
        event.updatedAt = new Date();
        resetCount++;
      }
    }

    return resetCount;
  }

  async markBatchAsSent(eventIds: string[]): Promise<number> {
    let count = 0;
    const now = new Date();

    for (const eventId of eventIds) {
      const event = this.events.get(eventId);
      if (event) {
        event.status = OutboxStatus.SENT;
        event.sentAt = now;
        event.updatedAt = now;
        count++;
      }
    }

    return count;
  }

  async markBatchAsFailed(eventIds: string[], error: string): Promise<number> {
    let count = 0;
    const now = new Date();

    for (const eventId of eventIds) {
      const event = this.events.get(eventId);
      if (event) {
        event.status = OutboxStatus.FAILED;
        event.lastError = error;
        event.updatedAt = now;
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all events (useful for testing)
   */
  clear(): void {
    this.events.clear();
  }

  /**
   * Get all events (useful for testing/debugging)
   */
  getAll(): OutboxEvent[] {
    return Array.from(this.events.values());
  }

  /**
   * Get event count by status (useful for monitoring)
   */
  getCountByStatus(): Record<OutboxStatus, number> {
    const counts: Record<OutboxStatus, number> = {
      [OutboxStatus.PENDING]: 0,
      [OutboxStatus.PUBLISHING]: 0,
      [OutboxStatus.SENT]: 0,
      [OutboxStatus.FAILED]: 0,
    };

    for (const event of this.events.values()) {
      counts[event.status]++;
    }

    return counts;
  }
}
