// Core
export { default as config } from './core/config';
export { default as connection } from './core/connection';
export { parseDuration, toNanos, fromNanos } from './core/duration';
export { Subject } from './core/subject';
export {
  NatsPubsubError,
  ConnectionError,
  PublishError,
  SubscriptionError,
  TopologyError,
  DlqError,
  ConfigurationError,
  TimeoutError,
} from './core/errors';
export { HealthCheck, HealthCheckResult, ComponentHealth } from './core/health-check';
export { Presets } from './core/presets';
export { StructuredLogger, LoggerFactory } from './core/structured-logger';
export type { LogLevel, LogEntry } from './core/structured-logger';
export {
  SchemaValidator,
  createValidator,
  validateSchema,
  CommonSchemas,
  createMessageSchema,
} from './core/schema-validator';
export type { ValidationResult, ValidationErrorDetail } from './core/schema-validator';
export {
  CircuitBreaker,
  CircuitBreakerError,
  createCircuitBreaker,
  CircuitState,
} from './core/circuit-breaker';
export type { CircuitBreakerOptions, CircuitBreakerStats } from './core/circuit-breaker';

// Validation
export {
  validate,
  validateConfig,
  validateMetadata,
  createValidatedSubscriber,
  ValidationError,
  EventMetadataSchema,
  ConfigSchema,
  z,
} from './core/validation';

// Publisher
export { Publisher, default as publisher } from './publisher/publisher';
export { FluentBatchPublisher, FluentBatchPublishResult } from './publisher/fluent-batch';
export { BatchPublisher, BatchPublishResult } from './publisher/batch-publisher';

// Consumer
export { Consumer, default as consumer } from './subscribers/consumer';

// Subscriber
export { subscriber, Subscriber } from './subscribers/subscriber';
export { GracefulShutdown } from './subscribers/graceful-shutdown';
export type { GracefulShutdownOptions } from './subscribers/graceful-shutdown';
export { ErrorHandler } from './subscribers/error-handler';

// DLQ
export { DlqHandler } from './dlq/dlq-handler';
export {
  DlqConsumer,
  DlqMessage,
  DlqHandler as IDlqHandler,
  PersistentDlqStore,
  LoggingDlqHandler,
  AlertDlqHandler,
  StorageDlqHandler,
  default as dlqConsumer,
} from './dlq/dlq-consumer';

// Topology
export { TopologyManager } from './topology/topology-manager';

// Registry
export { Registry } from './subscribers/registry';

// Middleware
export { MiddlewareChain } from './middleware/chain';
export { LoggingMiddleware, default as loggingMiddleware } from './middleware/logging';
export { RetryLoggerMiddleware, default as retryLoggerMiddleware } from './middleware/retry-logger';

// Types
export * from './types';
export type {
  MessageContext,
  ErrorAction,
  ErrorContext,
  RetryStrategy,
  CircuitBreakerConfig,
  DlqConfig,
} from './types';

// Testing utilities
export * from './testing';

// Outbox Pattern (Reliable Message Publishing)
export * from './outbox';

// Inbox Pattern (Idempotent Message Processing)
export * from './inbox';

// Main API
import config from './core/config';
import publisher from './publisher/publisher';
import consumer from './subscribers/consumer';
import connection from './core/connection';
import { TopologyManager } from './topology/topology-manager';
import { HealthCheck } from './core/health-check';
import { FluentBatchPublisher } from './publisher/fluent-batch';

/**
 * Main NatsPubsub API
 * Provides a unified interface for all NatsPubsub functionality
 */
export const NatsPubsub = {
  // Configuration
  configure: config.configure.bind(config),
  getConfig: () => config.get(),
  validate: () => config.validate(),

  // Connection & Topology
  connect: connection.connect.bind(connection),
  disconnect: connection.disconnect.bind(connection),
  ensureConnection: connection.ensureConnection.bind(connection),

  // Health checks
  healthCheck: HealthCheck.check.bind(HealthCheck),
  quickHealthCheck: HealthCheck.quickCheck.bind(HealthCheck),
  healthCheckMiddleware: HealthCheck.middleware.bind(HealthCheck),
  quickHealthCheckMiddleware: HealthCheck.quickMiddleware.bind(HealthCheck),

  /**
   * Ensure JetStream topology is set up
   * Creates necessary streams and consumers
   */
  async ensureTopology(): Promise<void> {
    await connection.ensureConnection();
    const nc = connection.getConnection();
    const jsm = await nc.jetstreamManager();
    const topologyManager = new TopologyManager();
    await topologyManager.ensureTopology(jsm);
  },

  /**
   * Setup and connect in one call
   * Combines configure + ensureTopology for simpler initialization
   *
   * @example
   * await NatsPubsub.setup({
   *   env: 'production',
   *   appName: 'my-service',
   *   natsUrls: 'nats://nats.example.com:4222'
   * });
   */
  async setup(options?: Parameters<typeof config.configure>[0]): Promise<void> {
    if (options) {
      config.configure(options);
    }
    config.validate();
    await this.ensureTopology();
  },

  // Publishing
  publish: publisher.publish.bind(publisher),

  /**
   * Create a batch publisher for publishing multiple messages efficiently
   *
   * @example
   * ```typescript
   * const result = await NatsPubsub.batch()
   *   .add('user.created', { id: 1, name: 'Alice' })
   *   .add('notification.sent', { userId: 1 })
   *   .withOptions({ traceId: 'batch-123' })
   *   .publish();
   * ```
   */
  batch(): FluentBatchPublisher {
    return new FluentBatchPublisher(publisher);
  },

  // Subscribing
  registerSubscriber: consumer.registerSubscriber.bind(consumer),
  use: consumer.use.bind(consumer),
  start: consumer.start.bind(consumer),
  stop: consumer.stop.bind(consumer),

  // Configuration helpers
  get useDlq(): boolean {
    return config.get().useDlq ?? true;
  },

  get useOutbox(): boolean {
    return config.get().useOutbox ?? false;
  },

  get useInbox(): boolean {
    return config.get().useInbox ?? false;
  },
};

export default NatsPubsub;
