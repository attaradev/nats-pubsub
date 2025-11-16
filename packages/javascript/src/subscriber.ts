import { EventMetadata, Subscriber, SubscriberOptions } from './types';
import config from './core/config';

export interface TopicMetadata extends EventMetadata {
  topic: string;
}

/**
 * Decorator for creating subscriber classes
 * Subscribes to NATS subjects directly
 */
export function subscriber(subjects: string | string[], options?: SubscriberOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends new (...args: any[]) => object>(constructor: T) {
    const subjectArray = Array.isArray(subjects) ? subjects : [subjects];

    return class extends constructor implements Subscriber {
      subjects = subjectArray;
      options = options;

      async call(_event: Record<string, unknown>, _metadata: EventMetadata): Promise<void> {
        // This will be overridden by the actual implementation
        throw new Error('Subscriber must implement call() method');
      }
    };
  };
}

/**
 * Decorator for subscribing to topics
 * Topics are the foundation of the pubsub system
 *
 * @param topics - Topic name or array of topic names (e.g., 'notifications.email', 'users.user.*')
 * @param options - Subscription options
 *
 * @example
 * ```typescript
 * @topicSubscriber('notifications.email')
 * class EmailNotificationSubscriber {
 *   async call(message: Record<string, unknown>, metadata: TopicMetadata) {
 *     console.log('Email notification:', message);
 *   }
 * }
 *
 * // With wildcards
 * @topicSubscriber('users.user.*')
 * class AllUserEventsSubscriber {
 *   async call(message: Record<string, unknown>, metadata: TopicMetadata) {
 *     console.log('User event on topic:', metadata.topic);
 *   }
 * }
 * ```
 */
export function topicSubscriber(topics: string | string[], options?: SubscriberOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends new (...args: any[]) => object>(constructor: T) {
    const topicArray = Array.isArray(topics) ? topics : [topics];
    const cfg = config.get();

    // Build subject patterns for topics
    // Format: {env}.${cfg.appName}.{topic_name}
    const subjects = topicArray.map((topic) => {
      return `${cfg.env}.${cfg.appName}.${normalizeTopicName(topic)}`;
    });

    return class extends constructor implements Subscriber {
      subjects = subjects;
      options = options;

      async call(_message: Record<string, unknown>, _metadata: EventMetadata): Promise<void> {
        throw new Error('Topic subscriber must implement call() method');
      }
    };
  };
}

/**
 * Decorator for subscribing to all subtopics using wildcard (>)
 *
 * @param topic - Topic name to subscribe to with wildcard
 * @param options - Subscription options
 *
 * @example
 * ```typescript
 * @topicSubscriberWildcard('notifications')
 * class AllNotificationsSubscriber {
 *   async call(message: Record<string, unknown>, metadata: TopicMetadata) {
 *     // Receives: notifications.email, notifications.sms, notifications.push, etc.
 *     console.log('Notification on:', metadata.topic);
 *   }
 * }
 * ```
 */
export function topicSubscriberWildcard(topic: string, options?: SubscriberOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends new (...args: any[]) => object>(constructor: T) {
    const cfg = config.get();
    // Format: {env}.${cfg.appName}.{topic_name}.>
    const subject = `${cfg.env}.${cfg.appName}.${normalizeTopicName(topic)}.>`;

    return class extends constructor implements Subscriber {
      subjects = [subject];
      options = options;

      async call(_message: Record<string, unknown>, _metadata: EventMetadata): Promise<void> {
        throw new Error('Topic subscriber must implement call() method');
      }
    };
  };
}

/**
 * Decorator for subscribing to domain/resource/action events
 * This is a convenience layer that maps to topics internally
 *
 * @param domain - Business domain
 * @param resource - Resource type
 * @param action - Event action (can use '*' wildcard)
 * @param options - Subscription options
 *
 * @example
 * ```typescript
 * @eventSubscriber('users', 'user', 'created')
 * class UserCreatedSubscriber {
 *   async call(message: Record<string, unknown>, metadata: EventMetadata) {
 *     console.log('User created:', message);
 *   }
 * }
 *
 * // With wildcard action
 * @eventSubscriber('users', 'user', '*')
 * class AllUserEventsSubscriber {
 *   async call(message: Record<string, unknown>, metadata: EventMetadata) {
 *     console.log('User event:', metadata.action);
 *   }
 * }
 * ```
 */
export function eventSubscriber(
  domain: string,
  resource: string,
  action: string,
  options?: SubscriberOptions
) {
  // Map to topic pattern: {domain}.{resource}.{action}
  const topic = `${domain}.${resource}.${action}`;
  return topicSubscriber(topic, options);
}

/**
 * Base class for subscribers with topic support
 *
 * Provides helper methods for working with both topic-based and
 * domain/resource/action patterns.
 */
export abstract class BaseSubscriber implements Subscriber {
  subjects: string[] = [];
  options?: SubscriberOptions;

  constructor(subjects: string | string[], options?: SubscriberOptions) {
    this.subjects = Array.isArray(subjects) ? subjects : [subjects];
    this.options = options;
  }

  abstract call(event: Record<string, unknown>, metadata: EventMetadata): Promise<void>;

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
    const parts = subject.split('.');
    // Skip env and 'topics', return the rest
    return parts.slice(2).join('.');
  }
}

/**
 * Normalize topic name (replace special characters except dots with underscores)
 * Dots are preserved to allow hierarchical topics
 * NATS wildcards (> and *) are also preserved for pattern matching
 */
function normalizeTopicName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_.>*-]/g, '_');
}
