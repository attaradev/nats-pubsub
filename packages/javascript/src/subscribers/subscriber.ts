import { EventMetadata, Subscriber as SubscriberInterface, SubscriberOptions } from '../types';
import config from '../core/config';
import { Subject } from '../core/subject';

export interface TopicMetadata extends EventMetadata {
  topic: string;
}

/**
 * Decorator for creating subscriber classes with type-safe message handling
 * Subscribes to NATS subjects directly
 *
 * @template TMessage - Type of the message payload (defaults to Record<string, unknown>)
 * @template TMetadata - Type of the metadata (defaults to EventMetadata)
 *
 * @example
 * ```typescript
 * interface UserCreatedMessage {
 *   id: string;
 *   name: string;
 *   email: string;
 * }
 *
 * @subscriber<UserCreatedMessage>('production.app.user.created')
 * class UserSubscriber {
 *   async handle(message: UserCreatedMessage, metadata: EventMetadata) {
 *     // message is fully typed!
 *     console.log(message.name.toUpperCase());
 *   }
 * }
 * ```
 */
export function subscriber<
  TMessage extends Record<string, unknown> = Record<string, unknown>,
  TMetadata extends EventMetadata = EventMetadata,
>(subjects: string | string[], options?: SubscriberOptions) {
  return function <
    T extends new (...args: any[]) => {
      handle(message: TMessage, metadata: TMetadata): Promise<void>;
    },
  >(constructor: T) {
    const subjectArray = Array.isArray(subjects) ? subjects : [subjects];

    return class extends constructor implements SubscriberInterface {
      subjects = subjectArray;
      options = options;

      async handle(event: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
        // Handle with typed parameters
        return super.handle(event as TMessage, metadata as TMetadata);
      }
    };
  };
}

/**
 * Decorator for subscribing to topics with type-safe message handling
 * Topics are the foundation of the pubsub system
 *
 * @template TMessage - Type of the message payload
 * @template TMetadata - Type of the metadata (defaults to TopicMetadata)
 *
 * @param topics - Topic name or array of topic names (e.g., 'notification.email', 'user.*')
 * @param options - Subscription options
 *
 * @example
 * ```typescript
 * interface EmailMessage {
 *   to: string;
 *   subject: string;
 *   body: string;
 * }
 *
 * @topicSubscriber<EmailMessage>('notification.email')
 * class EmailNotificationSubscriber {
 *   async handle(message: EmailMessage, metadata: TopicMetadata) {
 *     // message.to is fully typed!
 *     console.log('Sending to:', message.to);
 *   }
 * }
 *
 * // With wildcards
 * @topicSubscriber('user.*')
 * class AllUserEventsSubscriber {
 *   async handle(message: Record<string, unknown>, metadata: TopicMetadata) {
 *     console.log('User event on topic:', metadata.topic);
 *   }
 * }
 * ```
 */
export function topicSubscriber<
  TMessage extends Record<string, unknown> = Record<string, unknown>,
  TMetadata extends TopicMetadata = TopicMetadata,
>(topics: string | string[], options?: SubscriberOptions) {
  return function <
    T extends new (...args: any[]) => {
      handle(message: TMessage, metadata: TMetadata): Promise<void>;
    },
  >(constructor: T) {
    const topicArray = Array.isArray(topics) ? topics : [topics];
    const cfg = config.get();

    // Build subject patterns for topics using Subject utility
    const subjects = topicArray.map((topic) => {
      return Subject.forTopic(cfg.env, cfg.appName, topic);
    });

    return class extends constructor implements SubscriberInterface {
      subjects = subjects;
      options = options;

      async handle(message: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
        // Handle with typed parameters
        return super.handle(message as TMessage, metadata as TMetadata);
      }
    };
  };
}

/**
 * Decorator for subscribing to all subtopics using wildcard (>) with type safety
 *
 * @template TMessage - Type of the message payload
 * @template TMetadata - Type of the metadata (defaults to TopicMetadata)
 *
 * @param topic - Topic name to subscribe to with wildcard
 * @param options - Subscription options
 *
 * @example
 * ```typescript
 * @topicSubscriberWildcard('notification')
 * class AllNotificationSubscriber {
 *   async handle(message: Record<string, unknown>, metadata: TopicMetadata) {
 *     // Receives: notification.email, notification.sms, notification.push, etc.
 *     console.log('Notification on:', metadata.topic);
 *   }
 * }
 * ```
 */
export function topicSubscriberWildcard<
  TMessage extends Record<string, unknown> = Record<string, unknown>,
  TMetadata extends TopicMetadata = TopicMetadata,
>(topic: string, options?: SubscriberOptions) {
  return function <
    T extends new (...args: any[]) => {
      handle(message: TMessage, metadata: TMetadata): Promise<void>;
    },
  >(constructor: T) {
    const cfg = config.get();
    // Use Subject utility to build wildcard pattern
    const subject = Subject.forTopic(cfg.env, cfg.appName, `${topic}.>`);

    return class extends constructor implements SubscriberInterface {
      subjects = [subject];
      options = options;

      async handle(message: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
        return super.handle(message as TMessage, metadata as TMetadata);
      }
    };
  };
}

/**
 * Decorator for subscribing to domain/resource/action events with type safety
 * This is a convenience layer that maps to topics internally
 *
 * @template TMessage - Type of the message payload
 * @template TMetadata - Type of the metadata (defaults to TopicMetadata)
 *
 * @param domain - Business domain
 * @param resource - Resource type
 * @param action - Event action (can use '*' wildcard)
 * @param options - Subscription options
 *
 * @example
 * ```typescript
 * interface UserCreatedPayload {
 *   id: string;
 *   name: string;
 *   email: string;
 * }
 *
 * @eventSubscriber<UserCreatedPayload>('user', 'user', 'created')
 * class UserCreatedSubscriber {
 *   async handle(message: UserCreatedPayload, metadata: TopicMetadata) {
 *     // message is fully typed!
 *     console.log('User created:', message.email);
 *   }
 * }
 *
 * // With wildcard action
 * @eventSubscriber('user', 'user', '*')
 * class AllUserEventSubscriber {
 *   async handle(message: Record<string, unknown>, metadata: TopicMetadata) {
 *     console.log('User event:', metadata.action);
 *   }
 * }
 * ```
 */
export function eventSubscriber<
  TMessage extends Record<string, unknown> = Record<string, unknown>,
  TMetadata extends TopicMetadata = TopicMetadata,
>(domain: string, resource: string, action: string, options?: SubscriberOptions) {
  // Map to topic pattern: {domain}.{resource}.{action}
  const topic = `${domain}.${resource}.${action}`;
  return topicSubscriber<TMessage, TMetadata>(topic, options);
}

/**
 * Base class for subscribers with topic support and type-safe message handling
 *
 * Provides helper methods for working with both topic-based and
 * domain/resource/action patterns.
 *
 * @template TMessage - Type of the message payload (defaults to Record<string, unknown>)
 * @template TMetadata - Type of the metadata (defaults to EventMetadata)
 *
 * @example
 * ```typescript
 * interface OrderPlacedMessage {
 *   orderId: string;
 *   userId: string;
 *   total: number;
 * }
 *
 * class OrderSubscriber extends Subscriber<OrderPlacedMessage> {
 *   constructor() {
 *     super('production.shop.order.placed');
 *   }
 *
 *   async handle(message: OrderPlacedMessage, metadata: EventMetadata) {
 *     // message is fully typed!
 *     console.log(`Order ${message.orderId} total: $${message.total}`);
 *   }
 * }
 * ```
 */
export abstract class Subscriber<
  TMessage extends Record<string, unknown> = Record<string, unknown>,
  TMetadata extends EventMetadata = EventMetadata,
> implements SubscriberInterface
{
  subjects: string[] = [];
  options?: SubscriberOptions;

  constructor(subjects: string | string[], options?: SubscriberOptions) {
    this.subjects = Array.isArray(subjects) ? subjects : [subjects];
    this.options = options;
  }

  /**
   * Process a message - must be implemented by subclasses
   * The message and metadata are typed according to the class generic parameters
   */
  abstract handle(message: TMessage, metadata: TMetadata): Promise<void>;

  /**
   * Check if message is from a specific topic
   */
  protected fromTopic(metadata: TopicMetadata, topicName: string): boolean {
    return metadata.topic === topicName;
  }

  /**
   * Check if message is from a specific domain/resource/action
   */
  protected fromEvent(
    metadata: EventMetadata,
    domain: string,
    resource: string,
    action: string
  ): boolean {
    return (
      metadata.domain === domain && metadata.resource === resource && metadata.action === action
    );
  }

  /**
   * Extract topic from NATS subject
   * Format: {env}.${cfg.appName}.{topic_name}
   */
  protected extractTopic(subject: string): string {
    const parsed = Subject.parseTopic(subject);
    return parsed ? parsed.topic : '';
  }
}
