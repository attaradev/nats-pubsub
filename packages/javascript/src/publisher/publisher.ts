import { JetStreamClient, headers as natsHeaders } from 'nats';
import connection from '../core/connection';
import config from '../core/config';
import { EnvelopeBuilder } from './envelope-builder';
import { SubjectBuilder } from './subject-builder';
import { PublishValidator } from './publish-validator';
import { PublishResultBuilder } from './publish-result';
import {
  TopicPublishOptions,
  DomainResourceActionParams,
  MultiTopicParams,
  MultiTopicPublishResult,
} from './types';

// Re-export types for backward compatibility
export { TopicMessage, TopicPublishOptions } from './types';

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Connection manager interface for dependency injection
 */
export interface ConnectionManager {
  ensureConnection(): Promise<void>;
  getJetStream(): JetStreamClient;
}

/**
 * Publisher - Handles message publishing to NATS JetStream
 *
 * This class follows SOLID principles and best practices:
 * - Single Responsibility: Coordinates publishing operations
 * - Open/Closed: Easy to extend with new publish strategies
 * - Liskov Substitution: Can be replaced with mock implementations
 * - Interface Segregation: Uses focused interfaces
 * - Dependency Inversion: Depends on abstractions (interfaces)
 *
 * Design Patterns:
 * - Dependency Injection: All dependencies are injected
 * - Strategy Pattern: Different publish strategies (topic, multi-topic, domain/resource/action)
 * - Builder Pattern: Uses builder classes for construction
 *
 * @example Basic usage
 * ```typescript
 * const publisher = new Publisher();
 * await publisher.publishToTopic('notifications', { message: 'Hello' });
 * ```
 *
 * @example With dependency injection
 * ```typescript
 * const publisher = new Publisher(
 *   customConnection,
 *   customLogger,
 *   customEnvelopeBuilder,
 *   customSubjectBuilder,
 *   customValidator
 * );
 * ```
 */
export class Publisher {
  private readonly connectionManager: ConnectionManager;
  private readonly logger: Logger;
  private readonly envelopeBuilder: EnvelopeBuilder;
  private readonly subjectBuilder: SubjectBuilder;
  private readonly validator: PublishValidator;

  /**
   * Create a new Publisher instance
   *
   * @param connectionManager - Connection manager (defaults to global connection)
   * @param logger - Logger instance (defaults to global config.logger)
   * @param envelopeBuilder - Envelope builder (created from config if not provided)
   * @param subjectBuilder - Subject builder (created from config if not provided)
   * @param validator - Validator instance (created if not provided)
   */
  constructor(
    connectionManager?: ConnectionManager,
    logger?: Logger,
    envelopeBuilder?: EnvelopeBuilder,
    subjectBuilder?: SubjectBuilder,
    validator?: PublishValidator
  ) {
    this.connectionManager = connectionManager || connection;
    this.logger = logger || config.logger;

    if (envelopeBuilder && subjectBuilder) {
      this.envelopeBuilder = envelopeBuilder;
      this.subjectBuilder = subjectBuilder;
    } else {
      const cfg = config.get();
      this.envelopeBuilder = envelopeBuilder || new EnvelopeBuilder(cfg.appName);
      this.subjectBuilder = subjectBuilder || new SubjectBuilder(cfg.env, cfg.appName);
    }

    this.validator = validator || new PublishValidator();
  }

  /**
   * Publish a message to a specific topic
   *
   * Topics are the foundation of the pubsub system. Use dot notation for
   * hierarchical topics and wildcards (* and >) for pattern matching.
   *
   * @param topic - Topic name (e.g., 'notifications', 'users.user.created')
   * @param message - Message payload
   * @param options - Additional publish options
   *
   * @example
   * ```typescript
   * // Simple topic
   * await publisher.publishToTopic('notifications', { type: 'email' });
   *
   * // Hierarchical topic
   * await publisher.publishToTopic('notifications.email', { to: 'user@example.com' });
   *
   * // With options
   * await publisher.publishToTopic('analytics', { event: 'page_view' }, {
   *   trace_id: 'trace-123',
   *   message_type: 'urgent'
   * });
   * ```
   */
  async publishToTopic(
    topic: string,
    message: Record<string, unknown>,
    options: TopicPublishOptions = {}
  ): Promise<void> {
    // Validate inputs
    this.validator.validateTopic(topic);
    this.validator.validateMessage(message);

    // Ensure connection
    await this.connectionManager.ensureConnection();
    const js = this.connectionManager.getJetStream();

    // Build envelope and subject
    const envelope = this.envelopeBuilder.build(topic, message, options);
    const subject = this.subjectBuilder.buildTopicSubject(topic);

    try {
      this.logger.debug('Publishing to topic', {
        subject,
        topic,
        event_id: envelope.event_id,
      });

      // Build NATS headers
      const hdrs = natsHeaders();
      hdrs.set('Nats-Msg-Id', envelope.event_id);
      hdrs.set('topic', topic);

      if (options.trace_id) {
        hdrs.set('trace_id', options.trace_id);
      }

      // Publish to NATS
      await js.publish(subject, JSON.stringify(envelope), {
        msgID: envelope.event_id,
        headers: hdrs,
      });

      this.logger.info('Topic message published successfully', {
        subject,
        topic,
        event_id: envelope.event_id,
      });
    } catch (error) {
      this.logger.error('Failed to publish topic message', {
        subject,
        topic,
        event_id: envelope.event_id,
        error,
      });
      throw error;
    }
  }

  /**
   * Publish to multiple topics at once
   *
   * Broadcasts the same message to multiple topics. Useful for cross-cutting
   * concerns like audit logs and notifications.
   *
   * @param topics - Array of topic names
   * @param message - Message payload
   * @param options - Additional publish options
   * @returns Results object with statistics
   *
   * @example
   * ```typescript
   * const result = await publisher.publishToTopics(
   *   ['notifications.email', 'audit.user_events'],
   *   { action: 'user_login', user_id: 123 }
   * );
   * console.log(`Published to ${result.successCount} topics`);
   * ```
   */
  async publishToTopics(
    topics: string[],
    message: Record<string, unknown>,
    options: TopicPublishOptions = {}
  ): Promise<MultiTopicPublishResult> {
    // Validate inputs
    this.validator.validateTopicsArray(topics);
    this.validator.validateMessage(message);

    const results: Record<string, boolean> = {};

    await Promise.all(
      topics.map(async (topic) => {
        try {
          await this.publishToTopic(topic, message, options);
          results[topic] = true;
        } catch {
          results[topic] = false;
        }
      })
    );

    return PublishResultBuilder.fromTopicResults(results);
  }

  /**
   * Polymorphic publish method that supports both topic-based and domain/resource/action patterns
   *
   * @overload
   * Publish to a single topic
   * @param topic - Topic name
   * @param message - Message payload
   * @param options - Optional publish options
   *
   * @overload
   * Publish to multiple topics
   * @param params - Object with topics array and message
   * @param params.topics - Array of topic names
   * @param params.message - Message payload
   * @param options - Optional publish options
   *
   * @overload
   * Publish using domain/resource/action pattern
   * @param params - Object with domain, resource, action, and payload
   * @param params.domain - Business domain
   * @param params.resource - Resource type
   * @param params.action - Event action
   * @param params.payload - Event payload
   * @param options - Optional publish options
   *
   * @example Topic-based (single)
   * ```typescript
   * await publisher.publish('notifications.email', { to: 'user@example.com' });
   * ```
   *
   * @example Topic-based (multiple)
   * ```typescript
   * await publisher.publish({
   *   topics: ['notifications', 'audit'],
   *   message: { action: 'login' }
   * });
   * ```
   *
   * @example Domain/Resource/Action
   * ```typescript
   * await publisher.publish({
   *   domain: 'users',
   *   resource: 'user',
   *   action: 'created',
   *   payload: { id: 123, name: 'John' }
   * });
   * ```
   */
  async publish(
    topicOrParams: string | MultiTopicParams | DomainResourceActionParams,
    messageOrOptions?: Record<string, unknown> | TopicPublishOptions,
    options?: TopicPublishOptions
  ): Promise<void | MultiTopicPublishResult> {
    // Case 1: Topic-based single topic - publish(topic, message, options?)
    if (typeof topicOrParams === 'string') {
      const topic = topicOrParams;
      const message = messageOrOptions as Record<string, unknown>;
      const opts = options || {};
      return this.publishToTopic(topic, message, opts);
    }

    // Case 2: Multiple topics - publish({ topics: [...], message: {...} }, options?)
    if ('topics' in topicOrParams && 'message' in topicOrParams) {
      this.validator.validateMultiTopicParams(topicOrParams);
      const opts = (messageOrOptions as TopicPublishOptions) || {};
      return this.publishToTopics(topicOrParams.topics, topicOrParams.message, opts);
    }

    // Case 3: Domain/Resource/Action - publish({ domain, resource, action, payload }, options?)
    if ('domain' in topicOrParams && 'resource' in topicOrParams && 'action' in topicOrParams) {
      this.validator.validateDomainResourceAction(topicOrParams);
      return this.publishDomainResourceAction(
        topicOrParams,
        messageOrOptions as TopicPublishOptions
      );
    }

    throw new Error(
      'Invalid publish arguments. Use topic string, topics array, or domain/resource/action object.'
    );
  }

  /**
   * Publish using domain/resource/action pattern
   *
   * @param params - Domain/resource/action parameters
   * @param options - Optional publish options
   */
  private async publishDomainResourceAction(
    params: DomainResourceActionParams,
    options: TopicPublishOptions = {}
  ): Promise<void> {
    const { domain, resource, action, payload } = params;

    // Map domain/resource/action to topic
    const topic = this.subjectBuilder.buildTopicFromDomainResourceAction(domain, resource, action);

    // Build topic publish options including domain/resource/action for backward compatibility
    const topicOptions: TopicPublishOptions = {
      ...options,
      domain,
      resource,
      action,
      resource_id: this.envelopeBuilder.extractResourceId(payload),
    };

    return this.publishToTopic(topic, payload, topicOptions);
  }
}

// Lazy-initialized singleton instance
let publisherInstance: Publisher | null = null;

function getPublisherInstance(): Publisher {
  if (!publisherInstance) {
    publisherInstance = new Publisher();
  }
  return publisherInstance;
}

export default getPublisherInstance();
