import { PublishOptions } from '../types';
import connection from '../core/connection';
import config from '../core/config';
import { randomUUID } from 'crypto';
import { headers } from 'nats';

/**
 * Topic message envelope structure
 */
export interface TopicMessage {
  event_id: string;
  schema_version: number;
  topic: string;
  message_type?: string;
  producer: string;
  occurred_at: string;
  trace_id?: string;
  message: Record<string, unknown>;
  // Domain/resource/action fields (for backward compatibility when using publish())
  domain?: string;
  resource?: string;
  action?: string;
  resource_id?: string;
}

/**
 * Options for topic publishing
 */
export interface TopicPublishOptions {
  event_id?: string;
  occurred_at?: Date;
  trace_id?: string;
  message_type?: string;
  // Domain/resource/action fields (used internally by publish())
  domain?: string;
  resource?: string;
  action?: string;
  resource_id?: string;
}

/**
 * Unified Publisher class - Topics are the foundation
 *
 * This publisher uses topics as the base architecture with domain/resource/action
 * as a convenience layer. All messages flow through the topic infrastructure.
 *
 * @example Topic-based publishing (recommended)
 * ```typescript
 * const publisher = new Publisher();
 * await publisher.publishToTopic('notifications.email', { to: 'user@example.com' });
 * await publisher.publishToTopic('users.user.created', { id: 123 });
 * ```
 *
 * @example Domain/resource/action (convenience layer)
 * ```typescript
 * await publisher.publish('users', 'user', 'created', { id: 123 });
 * // Internally maps to topic: 'users.user.created'
 * ```
 */
export class Publisher {
  // ========================================================================
  // TOPIC-BASED METHODS (Foundation)
  // ========================================================================

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
    await connection.ensureConnection();
    const js = connection.getJetStream();
    const cfg = config.get();
    const logger = config.logger;

    const eventId = options.event_id || randomUUID();
    const occurredAt = options.occurred_at || new Date();
    const subject = this.buildTopicSubject(topic);

    const envelope: TopicMessage = {
      event_id: eventId,
      schema_version: 1,
      topic: topic,
      message_type: options.message_type,
      producer: cfg.appName,
      occurred_at: occurredAt.toISOString(),
      trace_id: options.trace_id,
      message,
    };

    // Include domain/resource/action if provided (for backward compatibility)
    if (options.domain) envelope.domain = options.domain;
    if (options.resource) envelope.resource = options.resource;
    if (options.action) envelope.action = options.action;
    if (options.resource_id) envelope.resource_id = options.resource_id;

    try {
      logger.debug('Publishing to topic', {
        subject,
        topic,
        event_id: eventId,
      });

      const hdrs = headers();
      hdrs.set('Nats-Msg-Id', eventId);
      hdrs.set('topic', topic);

      if (options.trace_id) {
        hdrs.set('trace_id', options.trace_id);
      }

      await js.publish(subject, JSON.stringify(envelope), {
        msgID: eventId,
        headers: hdrs,
      });

      logger.info('Topic message published successfully', {
        subject,
        topic,
        event_id: eventId,
      });
    } catch (error) {
      logger.error('Failed to publish topic message', {
        subject,
        topic,
        event_id: eventId,
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
   * @returns Results object with topic => success boolean
   *
   * @example
   * ```typescript
   * const results = await publisher.publishToTopics(
   *   ['notifications.email', 'audit.user_events'],
   *   { action: 'user_login', user_id: 123 }
   * );
   * console.log(results); // { 'notifications.email': true, 'audit.user_events': true }
   * ```
   */
  async publishToTopics(
    topics: string[],
    message: Record<string, unknown>,
    options: TopicPublishOptions = {}
  ): Promise<Record<string, boolean>> {
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

    return results;
  }

  // ========================================================================
  // DOMAIN/RESOURCE/ACTION METHODS (Convenience Layer)
  // ========================================================================

  /**
   * Publish an event using domain/resource/action pattern
   *
   * This is a convenience method that maps to topic-based publishing internally.
   * Domain/resource/action automatically maps to topic: `{domain}.{resource}.{action}`
   *
   * @param domain - Business domain (e.g., 'users', 'orders')
   * @param resource - Resource type (e.g., 'user', 'order')
   * @param action - Event action (e.g., 'created', 'updated', 'deleted')
   * @param payload - Event payload data
   * @param options - Additional publish options
   *
   * @example
   * ```typescript
   * // Publishes to topic: 'users.user.created'
   * await publisher.publish('users', 'user', 'created', {
   *   id: 123,
   *   name: 'John Doe'
   * });
   *
   * // Equivalent to:
   * await publisher.publishToTopic('users.user.created', {
   *   id: 123,
   *   name: 'John Doe'
   * }, { domain: 'users', resource: 'user', action: 'created' });
   * ```
   */
  async publish(
    domain: string,
    resource: string,
    action: string,
    payload: Record<string, unknown>,
    options: PublishOptions = {}
  ): Promise<void> {
    // Map domain/resource/action to topic
    const topic = `${domain}.${resource}.${action}`;

    // Build topic publish options including domain/resource/action for backward compatibility
    const topicOptions: TopicPublishOptions = {
      event_id: options.event_id,
      occurred_at: options.occurred_at,
      trace_id: options.trace_id,
      domain,
      resource,
      action,
      resource_id: this.extractResourceId(payload),
    };

    // Publish using topic infrastructure
    await this.publishToTopic(topic, payload, topicOptions);
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Build NATS subject for topic
   * Format: {env}.${cfg.appName}.{topic_name}
   */
  private buildTopicSubject(topic: string): string {
    const cfg = config.get();
    return `${cfg.env}.${cfg.appName}.${this.normalizeTopicName(topic)}`;
  }

  /**
   * Normalize topic name (replace special characters except dots with underscores)
   * Dots are preserved to allow hierarchical topics
   * NATS wildcards (> and *) are also preserved for pattern matching
   */
  private normalizeTopicName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9_.>*-]/g, '_');
  }

  /**
   * Extract resource_id from payload if present
   */
  private extractResourceId(payload: Record<string, unknown>): string | undefined {
    return (payload.id || payload.ID) as string | undefined;
  }
}

export default new Publisher();
