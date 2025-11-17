/**
 * Centralized constants for the library
 * Extracts magic numbers and strings into named, documented constants
 */

/**
 * Timeout-related constants
 */
export const Timeouts = {
  /** Default acknowledgment wait time in milliseconds */
  ACK_WAIT_DEFAULT: 30_000, // 30 seconds

  /** Default idle wait time in milliseconds */
  IDLE_WAIT_DEFAULT: 100, // 100ms

  /** Default connection timeout in milliseconds */
  CONNECTION_TIMEOUT: 5_000, // 5 seconds

  /** Default request timeout for management operations */
  MANAGEMENT_TIMEOUT: 10_000, // 10 seconds

  /** Default message processing timeout */
  PROCESSING_TIMEOUT: 60_000, // 60 seconds
} as const;

/**
 * Retry strategy constants
 */
export const Retry = {
  /** Default exponential backoff delays in milliseconds */
  DEFAULT_BACKOFF: [1_000, 5_000, 15_000, 30_000, 60_000] as const,

  /** Maximum number of delivery attempts before sending to DLQ */
  MAX_ATTEMPTS: 5,

  /** Base delay for transient errors (milliseconds) */
  TRANSIENT_BASE_DELAY: 500,

  /** Base delay for persistent errors (milliseconds) */
  PERSISTENT_BASE_DELAY: 2_000,

  /** Maximum backoff delay cap (milliseconds) */
  MAX_BACKOFF_CAP: 60_000, // 60 seconds
} as const;

/**
 * Dead Letter Queue constants
 */
export const DLQ = {
  /** Default retention period for DLQ messages (30 days in nanoseconds) */
  RETENTION_PERIOD: 30 * 24 * 60 * 60 * 1_000_000_000,

  /** DLQ stream suffix */
  STREAM_SUFFIX: '-dlq',

  /** Maximum attempts before moving to DLQ */
  MAX_ATTEMPTS: 3,
} as const;

/**
 * Stream and consumer configuration constants
 */
export const Stream = {
  /** Default stream retention policy */
  RETENTION_POLICY: 'limits' as const, // limits, interest, workqueue

  /** Default storage type */
  STORAGE_TYPE: 'file' as const, // file or memory

  /** Default max message age (7 days in nanoseconds) */
  MAX_AGE: 7 * 24 * 60 * 60 * 1_000_000_000,

  /** Default max messages per stream */
  MAX_MESSAGES: 1_000_000,

  /** Default max bytes per stream (1GB) */
  MAX_BYTES: 1_073_741_824,
} as const;

/**
 * Consumer configuration constants
 */
export const Consumer = {
  /** Default concurrency level */
  DEFAULT_CONCURRENCY: 5,

  /** Minimum concurrency */
  MIN_CONCURRENCY: 1,

  /** Maximum concurrency (prevents resource exhaustion) */
  MAX_CONCURRENCY: 1000,

  /** Default batch size for pull consumers */
  BATCH_SIZE: 10,

  /** Maximum batch size */
  MAX_BATCH_SIZE: 256,
} as const;

/**
 * Subject pattern constants
 */
export const Subject = {
  /** Wildcard for matching one level */
  SINGLE_LEVEL_WILDCARD: '*',

  /** Wildcard for matching multiple levels */
  MULTI_LEVEL_WILDCARD: '>',

  /** Subject token separator */
  SEPARATOR: '.',

  /** Maximum subject length */
  MAX_LENGTH: 255,
} as const;

/**
 * Envelope schema constants
 */
export const Envelope = {
  /** Current schema version */
  SCHEMA_VERSION: 1,

  /** Required envelope fields */
  REQUIRED_FIELDS: ['event_id', 'schema_version', 'producer', 'occurred_at'] as const,

  /** Topic envelope required fields */
  TOPIC_REQUIRED_FIELDS: [
    'event_id',
    'schema_version',
    'producer',
    'occurred_at',
    'topic',
    'message',
  ] as const,

  /** Event envelope required fields (legacy) */
  EVENT_REQUIRED_FIELDS: [
    'event_id',
    'schema_version',
    'producer',
    'occurred_at',
    'domain',
    'resource',
    'action',
    'payload',
  ] as const,
} as const;

/**
 * Error classification constants
 */
export const Errors = {
  /** Errors that should not be retried */
  UNRECOVERABLE_ERRORS: ['TypeError', 'ReferenceError', 'SyntaxError', 'ValidationError'] as const,

  /** Errors indicating malformed messages */
  MALFORMED_ERRORS: ['SyntaxError', 'JSON.parse error'] as const,

  /** Transient errors that should be retried */
  TRANSIENT_ERRORS: [
    'TimeoutError',
    'ConnectionError',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
  ] as const,
} as const;

/**
 * Logging constants
 */
export const Logging = {
  /** Default log level */
  DEFAULT_LEVEL: 'info' as const,

  /** Available log levels */
  LEVELS: ['debug', 'info', 'warn', 'error', 'fatal'] as const,

  /** Structured log field names */
  FIELDS: {
    EVENT_ID: 'event_id',
    TRACE_ID: 'trace_id',
    SUBJECT: 'subject',
    TOPIC: 'topic',
    DELIVERY_COUNT: 'delivery_count',
    ELAPSED_MS: 'elapsed_ms',
    ERROR_CLASS: 'error_class',
    ERROR_MESSAGE: 'error_message',
  } as const,
} as const;

/**
 * Health check constants
 */
export const HealthCheck = {
  /** Quick check timeout (milliseconds) */
  QUICK_TIMEOUT: 5_000,

  /** Full check timeout (milliseconds) */
  FULL_TIMEOUT: 30_000,

  /** Health check statuses */
  HEALTHY: 'healthy' as const,
  DEGRADED: 'degraded' as const,
  UNHEALTHY: 'unhealthy' as const,
} as const;

/**
 * Circuit breaker constants
 */
export const CircuitBreaker = {
  /** Default failure threshold */
  FAILURE_THRESHOLD: 5,

  /** Default success threshold for half-open state */
  SUCCESS_THRESHOLD: 2,

  /** Default timeout before attempting recovery (milliseconds) */
  TIMEOUT: 60_000,

  /** States */
  CLOSED: 'closed' as const,
  OPEN: 'open' as const,
  HALF_OPEN: 'half_open' as const,
} as const;
