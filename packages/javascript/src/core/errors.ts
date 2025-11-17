/**
 * Base error class for NatsPubsub
 */
export class NatsPubsubError extends Error {
  public readonly context?: Record<string, unknown>;
  public readonly resolution?: string;

  constructor(message: string, context?: Record<string, unknown>, resolution?: string) {
    super(message);
    this.name = 'NatsPubsubError';
    this.context = context;
    this.resolution = resolution;
    Object.setPrototypeOf(this, NatsPubsubError.prototype);
  }
}

/**
 * Connection-related errors
 *
 * Common causes:
 * - NATS server not running
 * - Incorrect connection URL
 * - Network issues
 * - Authentication failures
 */
export class ConnectionError extends NatsPubsubError {
  constructor(message: string, context?: Record<string, unknown>, resolution?: string) {
    const defaultResolution =
      resolution ||
      'Verify NATS server is running with JetStream enabled: nats-server -js\n' +
        'Check NATS_URLS configuration and network connectivity';
    super(message, context, defaultResolution);
    this.name = 'ConnectionError';
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/**
 * Publishing-related errors
 *
 * Common causes:
 * - Stream not found
 * - Permission denied
 * - Message too large
 * - Connection lost
 */
export class PublishError extends NatsPubsubError {
  constructor(message: string, context?: Record<string, unknown>, resolution?: string) {
    super(message, context, resolution);
    this.name = 'PublishError';
    Object.setPrototypeOf(this, PublishError.prototype);
  }
}

/**
 * Subscription-related errors
 *
 * Common causes:
 * - Consumer not found
 * - Stream not found
 * - Permission denied
 * - Invalid subject pattern
 */
export class SubscriptionError extends NatsPubsubError {
  constructor(message: string, context?: Record<string, unknown>, resolution?: string) {
    super(message, context, resolution);
    this.name = 'SubscriptionError';
    Object.setPrototypeOf(this, SubscriptionError.prototype);
  }
}

/**
 * Schema validation errors
 *
 * Thrown when message payload doesn't match expected schema
 */
export class ValidationError extends NatsPubsubError {
  public readonly validationErrors?: unknown;

  constructor(message: string, validationErrors?: unknown, context?: Record<string, unknown>) {
    const resolution = 'Check message payload matches expected schema. Review publisher code.';
    super(message, context, resolution);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Topology-related errors
 *
 * Common causes:
 * - Stream subjects overlap
 * - Invalid stream configuration
 * - JetStream disabled
 */
export class TopologyError extends NatsPubsubError {
  constructor(message: string, context?: Record<string, unknown>, resolution?: string) {
    const defaultResolution =
      resolution ||
      'Check stream configuration for subject overlaps.\n' +
        'Verify JetStream is enabled: nats account info';
    super(message, context, defaultResolution);
    this.name = 'TopologyError';
    Object.setPrototypeOf(this, TopologyError.prototype);
  }
}

/**
 * DLQ (Dead Letter Queue) related errors
 *
 * Thrown when DLQ operations fail
 */
export class DlqError extends NatsPubsubError {
  constructor(message: string, context?: Record<string, unknown>, resolution?: string) {
    super(message, context, resolution);
    this.name = 'DlqError';
    Object.setPrototypeOf(this, DlqError.prototype);
  }
}

/**
 * Configuration-related errors
 *
 * Thrown when configuration is invalid or missing
 */
export class ConfigurationError extends NatsPubsubError {
  constructor(message: string, context?: Record<string, unknown>, resolution?: string) {
    const defaultResolution =
      resolution ||
      'Review your NatsPubsub.configure() call.\n' +
        'Ensure required fields (natsUrls, env, appName) are set.';
    super(message, context, defaultResolution);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Timeout errors
 *
 * Thrown when operations exceed configured timeout
 */
export class TimeoutError extends NatsPubsubError {
  public readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number, context?: Record<string, unknown>) {
    const resolution = `Operation timed out after ${timeoutMs}ms. Consider increasing ackWait or optimizing subscriber logic.`;
    super(message, context, resolution);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}
