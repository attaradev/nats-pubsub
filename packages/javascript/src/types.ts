import { NatsConnection, JetStreamClient } from 'nats';

export interface NatsPubsubConfig {
  natsUrls: string | string[];
  env: string;
  appName: string;
  concurrency?: number;
  maxDeliver?: number;
  ackWait?: number; // in milliseconds
  backoff?: number[]; // array of milliseconds
  useOutbox?: boolean;
  useInbox?: boolean;
  useDlq?: boolean;
  streamName?: string;
  dlqSubject?: string;
  // Optional metrics hook for DLQ counting
  metrics?: {
    recordDlqMessage(subject: string, reason: string): void;
  };
  // Execution controls
  perMessageConcurrency?: number;
  subscriberTimeoutMs?: number;
  dlqMaxAttempts?: number;
  logger?: Logger;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface EventEnvelope {
  event_id: string;
  schema_version: number;
  event_type: string;
  producer: string;
  resource_type: string;
  resource_id?: string;
  occurred_at: string;
  trace_id?: string;
  payload: Record<string, unknown>;
}

export interface EventMetadata {
  event_id: string;
  subject: string;
  domain: string;
  resource: string;
  action: string;
  stream?: string;
  stream_seq?: number;
  deliveries?: number;
  trace_id?: string;
}

/**
 * Unified message context interface
 * Consolidates all metadata into a single, well-typed context object
 *
 * @example
 * ```typescript
 * @subscribe('notifications.email')
 * class EmailSubscriber {
 *   async handle(message: EmailMessage, context: MessageContext): Promise<void> {
 *     console.log(`Processing event ${context.eventId} with trace ${context.traceId}`);
 *   }
 * }
 * ```
 */
export interface MessageContext {
  /** Unique event identifier (UUID) */
  eventId: string;
  /** Full NATS subject (e.g., 'production.myapp.notifications.email') */
  subject: string;
  /** Extracted topic from subject (e.g., 'notifications.email') */
  topic: string;
  /** Optional distributed tracing ID */
  traceId?: string;
  /** Optional correlation ID for request tracking */
  correlationId?: string;
  /** Timestamp when the event occurred */
  occurredAt: Date;
  /** Number of delivery attempts */
  deliveries: number;
  /** JetStream stream name */
  stream?: string;
  /** JetStream stream sequence number */
  streamSeq?: number;
  /** Application that produced the event */
  producer?: string;
  /** Legacy: domain field (for backward compatibility) */
  domain?: string;
  /** Legacy: resource field (for backward compatibility) */
  resource?: string;
  /** Legacy: action field (for backward compatibility) */
  action?: string;
}

export interface PublishOptions {
  event_id?: string;
  trace_id?: string;
  occurred_at?: Date;
  correlation_id?: string;
  ttl?: number; // Time-to-live in milliseconds
  priority?: number; // Message priority (1-10)
}

/**
 * Error action enum for fine-grained error handling control
 */
export enum ErrorAction {
  /** Retry the message with backoff strategy */
  RETRY = 'retry',
  /** Acknowledge and discard the message (no retry) */
  DISCARD = 'discard',
  /** Send message to dead letter queue */
  DLQ = 'dlq',
}

/**
 * Error context passed to error handlers
 */
export interface ErrorContext {
  /** The error that occurred */
  error: Error;
  /** The message that failed */
  message: Record<string, unknown>;
  /** Message context */
  context: MessageContext;
  /** Current attempt number (1-based) */
  attemptNumber: number;
  /** Maximum delivery attempts configured */
  maxAttempts: number;
}

/**
 * Retry strategy configuration
 */
export interface RetryStrategy {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Backoff strategy: 'exponential', 'linear', or 'fixed' */
  backoff: 'exponential' | 'linear' | 'fixed';
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Multiplier for exponential backoff */
  multiplier?: number;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Enable circuit breaker */
  enabled: boolean;
  /** Number of failures before opening circuit */
  threshold: number;
  /** Time to keep circuit open in milliseconds */
  timeout: number;
  /** Number of test calls in half-open state */
  halfOpenMaxCalls: number;
}

/**
 * Dead letter queue configuration
 */
export interface DlqConfig {
  /** Enable DLQ */
  enabled: boolean;
  /** Maximum attempts before sending to DLQ */
  maxAttempts: number;
  /** Custom DLQ subject pattern */
  subject?: string;
}

export interface SubscriberOptions {
  /** Number of retry attempts */
  retry?: number;
  /** Acknowledgment wait time in milliseconds */
  ackWait?: number;
  /** Maximum delivery attempts */
  maxDeliver?: number;
  /** Enhanced retry strategy configuration */
  retryStrategy?: RetryStrategy | number;
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;
  /** Dead letter queue configuration */
  deadLetter?: DlqConfig | boolean;
  /** Zod schema for message validation */
  schema?: unknown;
}

export interface Subscriber {
  subjects: string[];
  options?: SubscriberOptions;
  /** Handle incoming messages */
  handle(event: Record<string, unknown>, metadata: EventMetadata): Promise<void>;
  /** Optional error handler for fine-grained error control */
  onError?(errorContext: ErrorContext): Promise<ErrorAction>;
}

export interface Middleware {
  call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>
  ): Promise<void>;
}

export interface ConnectionManager {
  connection: NatsConnection | null;
  jetstream: JetStreamClient | null;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ensureConnection(): Promise<void>;
}

export type MessageHandler = (
  event: Record<string, unknown>,
  metadata: EventMetadata
) => Promise<void>;
