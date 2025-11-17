import {
  InboxRepository,
  InboxEvent,
  InboxStatus,
  CreateInboxEventParams,
  FindInboxEventsOptions,
} from './types';

/**
 * In-memory implementation of InboxRepository
 *
 * Useful for:
 * - Testing without database dependencies
 * - Development environments
 * - Simple use cases where persistence isn't critical
 *
 * WARNING: Data is lost when the process restarts!
 * For production use, implement a database-backed repository.
 *
 * Deduplication Strategy:
 * - Primary: event_id (unique event identifier)
 * - Secondary: stream + stream_seq (JetStream sequence)
 *
 * @example
 * ```typescript
 * const repository = new MemoryInboxRepository();
 * const processor = new InboxProcessor(repository);
 * ```
 */
export class MemoryInboxRepository implements InboxRepository {
  private events: Map<string, InboxEvent> = new Map();
  private streamSeqIndex: Map<string, string> = new Map(); // "stream:seq" -> eventId

  async findByEventId(eventId: string): Promise<InboxEvent | null> {
    return this.events.get(eventId) || null;
  }

  async findByStreamSeq(stream: string, seq: number): Promise<InboxEvent | null> {
    const key = `${stream}:${seq}`;
    const eventId = this.streamSeqIndex.get(key);
    if (!eventId) return null;

    return this.events.get(eventId) || null;
  }

  async create(params: CreateInboxEventParams): Promise<InboxEvent> {
    const now = new Date();
    const event: InboxEvent = {
      eventId: params.eventId,
      subject: params.subject,
      payload: params.payload,
      headers: params.headers,
      stream: params.stream,
      streamSeq: params.streamSeq,
      deliveries: params.deliveries,
      status: InboxStatus.PROCESSING,
      receivedAt: params.receivedAt || now,
      createdAt: now,
      updatedAt: now,
    };

    this.events.set(event.eventId, event);

    // Create stream sequence index if applicable
    if (event.stream && event.streamSeq !== undefined) {
      const key = `${event.stream}:${event.streamSeq}`;
      this.streamSeqIndex.set(key, event.eventId);
    }

    return event;
  }

  async findOrCreate(
    params: CreateInboxEventParams
  ): Promise<{ event: InboxEvent; alreadyExists: boolean }> {
    // Try to find by event_id first
    let existing = await this.findByEventId(params.eventId);
    if (existing) {
      return { event: existing, alreadyExists: true };
    }

    // Try to find by stream sequence if provided
    if (params.stream && params.streamSeq !== undefined) {
      existing = await this.findByStreamSeq(params.stream, params.streamSeq);
      if (existing) {
        return { event: existing, alreadyExists: true };
      }
    }

    // Create new event
    const event = await this.create(params);
    return { event, alreadyExists: false };
  }

  async isProcessed(eventId: string): Promise<boolean> {
    const event = this.events.get(eventId);
    return event?.status === InboxStatus.PROCESSED && !!event.processedAt;
  }

  async markAsProcessed(eventId: string): Promise<void> {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    event.status = InboxStatus.PROCESSED;
    event.processedAt = new Date();
    event.updatedAt = new Date();
  }

  async markAsFailed(eventId: string, error: string): Promise<void> {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    event.status = InboxStatus.FAILED;
    event.lastError = error;
    event.updatedAt = new Date();
  }

  async findByStatus(
    status: InboxStatus,
    options: FindInboxEventsOptions = {}
  ): Promise<InboxEvent[]> {
    const { limit = 100 } = options;

    const results = Array.from(this.events.values())
      .filter((event) => {
        if (event.status !== status) return false;
        if (options.olderThan && event.receivedAt > options.olderThan) return false;
        return true;
      })
      .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
      .slice(0, limit);

    return results;
  }

  async cleanup(olderThan: Date): Promise<number> {
    let deletedCount = 0;

    for (const [eventId, event] of this.events.entries()) {
      if (
        event.status === InboxStatus.PROCESSED &&
        event.processedAt &&
        event.processedAt < olderThan
      ) {
        // Remove from main index
        this.events.delete(eventId);

        // Remove from stream sequence index
        if (event.stream && event.streamSeq !== undefined) {
          const key = `${event.stream}:${event.streamSeq}`;
          this.streamSeqIndex.delete(key);
        }

        deletedCount++;
      }
    }

    return deletedCount;
  }

  async resetStaleProcessing(olderThan: Date): Promise<number> {
    let resetCount = 0;

    for (const event of this.events.values()) {
      if (event.status === InboxStatus.PROCESSING && event.updatedAt < olderThan) {
        event.status = InboxStatus.FAILED;
        event.lastError = 'Reset from stale processing state';
        event.updatedAt = new Date();
        resetCount++;
      }
    }

    return resetCount;
  }

  /**
   * Clear all events (useful for testing)
   */
  clear(): void {
    this.events.clear();
    this.streamSeqIndex.clear();
  }

  /**
   * Get all events (useful for testing/debugging)
   */
  getAll(): InboxEvent[] {
    return Array.from(this.events.values());
  }

  /**
   * Get event count by status (useful for monitoring)
   */
  getCountByStatus(): Record<InboxStatus, number> {
    const counts: Record<InboxStatus, number> = {
      [InboxStatus.PROCESSING]: 0,
      [InboxStatus.PROCESSED]: 0,
      [InboxStatus.FAILED]: 0,
    };

    for (const event of this.events.values()) {
      counts[event.status]++;
    }

    return counts;
  }
}
