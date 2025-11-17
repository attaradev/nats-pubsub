/**
 * Types for Inbox pattern implementation
 *
 * The Inbox pattern ensures idempotent message processing by:
 * 1. Checking if message was already processed
 * 2. Marking message as processing
 * 3. Processing the message
 * 4. Marking as processed
 *
 * This prevents duplicate processing of the same message
 */

/**
 * Status of an inbox event
 */
export enum InboxStatus {
  /** Event is being processed */
  PROCESSING = 'processing',
  /** Event has been successfully processed */
  PROCESSED = 'processed',
  /** Event failed to process */
  FAILED = 'failed',
}

/**
 * Inbox event stored in the repository
 */
export interface InboxEvent {
  /** Unique event identifier (UUID) */
  eventId: string;
  /** NATS subject received from */
  subject: string;
  /** Message payload (JSON-serialized) */
  payload: string;
  /** NATS headers (JSON-serialized) */
  headers: string;
  /** JetStream stream name */
  stream?: string;
  /** JetStream stream sequence number */
  streamSeq?: number;
  /** Number of delivery attempts */
  deliveries: number;
  /** Current status */
  status: InboxStatus;
  /** Last error message if failed */
  lastError?: string;
  /** When the event was received */
  receivedAt: Date;
  /** When the event was processed (null if not processed) */
  processedAt?: Date;
  /** When the event was created */
  createdAt: Date;
  /** When the event was last updated */
  updatedAt: Date;
}

/**
 * Parameters for creating a new inbox event
 */
export interface CreateInboxEventParams {
  eventId: string;
  subject: string;
  payload: string;
  headers: string;
  stream?: string;
  streamSeq?: number;
  deliveries: number;
  receivedAt?: Date;
}

/**
 * Options for querying inbox events
 */
export interface FindInboxEventsOptions {
  status?: InboxStatus;
  limit?: number;
  olderThan?: Date;
}

/**
 * Repository interface for Inbox pattern
 * Implementations should handle database operations
 */
export interface InboxRepository {
  /**
   * Find an inbox event by event ID
   * Returns null if not found
   */
  findByEventId(eventId: string): Promise<InboxEvent | null>;

  /**
   * Find an inbox event by stream sequence
   * Alternative deduplication key for JetStream
   */
  findByStreamSeq(stream: string, seq: number): Promise<InboxEvent | null>;

  /**
   * Create a new inbox event
   * Marks it as "processing"
   */
  create(params: CreateInboxEventParams): Promise<InboxEvent>;

  /**
   * Find or create an inbox event
   * Used for idempotency check
   */
  findOrCreate(
    params: CreateInboxEventParams
  ): Promise<{ event: InboxEvent; alreadyExists: boolean }>;

  /**
   * Check if an event was already processed
   */
  isProcessed(eventId: string): Promise<boolean>;

  /**
   * Mark an event as successfully processed
   */
  markAsProcessed(eventId: string): Promise<void>;

  /**
   * Mark an event as failed with error message
   */
  markAsFailed(eventId: string, error: string): Promise<void>;

  /**
   * Find events by status
   */
  findByStatus(status: InboxStatus, options?: FindInboxEventsOptions): Promise<InboxEvent[]>;

  /**
   * Delete successfully processed events older than retention period
   * Used for cleanup/maintenance
   */
  cleanup(olderThan: Date): Promise<number>;

  /**
   * Reset stale processing events back to failed
   * Events stuck in "processing" state for too long
   */
  resetStaleProcessing(olderThan: Date): Promise<number>;
}
