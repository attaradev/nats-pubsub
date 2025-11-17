/**
 * Types for Outbox pattern implementation
 *
 * The Outbox pattern ensures reliable message delivery by:
 * 1. Persisting the message to storage before publishing
 * 2. Publishing to NATS
 * 3. Marking as sent in storage
 *
 * This prevents message loss if the application crashes between publishing and commit
 */

/**
 * Status of an outbox event
 */
export enum OutboxStatus {
  /** Event is pending and ready to be published */
  PENDING = 'pending',
  /** Event is currently being published */
  PUBLISHING = 'publishing',
  /** Event has been successfully published */
  SENT = 'sent',
  /** Event failed to publish after retries */
  FAILED = 'failed',
}

/**
 * Outbox event stored in the repository
 */
export interface OutboxEvent {
  /** Unique event identifier (UUID) */
  eventId: string;
  /** NATS subject to publish to */
  subject: string;
  /** Message envelope (JSON-serialized) */
  payload: string;
  /** NATS headers (JSON-serialized) */
  headers: string;
  /** Current status */
  status: OutboxStatus;
  /** Number of publish attempts */
  attempts: number;
  /** Last error message if failed */
  lastError?: string;
  /** When the event was enqueued */
  enqueuedAt: Date;
  /** When the event was sent (null if not sent) */
  sentAt?: Date;
  /** When the event was created */
  createdAt: Date;
  /** When the event was last updated */
  updatedAt: Date;
}

/**
 * Parameters for creating a new outbox event
 */
export interface CreateOutboxEventParams {
  eventId: string;
  subject: string;
  payload: string;
  headers: string;
  enqueuedAt?: Date;
}

/**
 * Options for querying outbox events
 */
export interface FindOutboxEventsOptions {
  status?: OutboxStatus;
  limit?: number;
  olderThan?: Date;
}

/**
 * Repository interface for Outbox pattern
 * Implementations should handle database operations
 */
export interface OutboxRepository {
  /**
   * Find or create an outbox event by event ID
   * Used for idempotency - prevents duplicate events
   */
  findOrCreate(params: CreateOutboxEventParams): Promise<OutboxEvent>;

  /**
   * Find an outbox event by event ID
   */
  findByEventId(eventId: string): Promise<OutboxEvent | null>;

  /**
   * Find pending events ready to be published
   */
  findPending(options?: FindOutboxEventsOptions): Promise<OutboxEvent[]>;

  /**
   * Mark an event as publishing (in-progress)
   */
  markAsPublishing(eventId: string): Promise<void>;

  /**
   * Mark an event as successfully sent
   */
  markAsSent(eventId: string): Promise<void>;

  /**
   * Mark an event as failed with error message
   */
  markAsFailed(eventId: string, error: string): Promise<void>;

  /**
   * Increment attempt count for an event
   */
  incrementAttempts(eventId: string): Promise<void>;

  /**
   * Delete successfully sent events older than retention period
   * Used for cleanup/maintenance
   */
  cleanup(olderThan: Date): Promise<number>;

  /**
   * Reset stale publishing events back to pending
   * Events stuck in "publishing" state for too long
   */
  resetStalePublishing(olderThan: Date): Promise<number>;

  /**
   * Mark a batch of events as sent (for performance)
   */
  markBatchAsSent(eventIds: string[]): Promise<number>;

  /**
   * Mark a batch of events as failed (for performance)
   */
  markBatchAsFailed(eventIds: string[], error: string): Promise<number>;
}

/**
 * Result of a publish operation
 */
export interface PublishResult {
  success: boolean;
  eventId: string;
  subject: string;
  reason?: string;
  details?: string;
  error?: Error;
}
