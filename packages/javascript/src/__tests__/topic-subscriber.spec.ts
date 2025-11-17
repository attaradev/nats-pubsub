import {
  topicSubscriber,
  topicSubscriberWildcard,
  Subscriber,
  TopicMetadata,
} from '../subscribers/subscriber';
import { Subscriber as SubscriberInterface } from '../types';
import config from '../core/config';

describe('Topic Subscriber', () => {
  beforeEach(() => {
    config.configure({
      env: 'test',
      appName: 'test-app',
    });
  });

  describe('topicSubscriber decorator', () => {
    it('should create subscriber for single topic', () => {
      @topicSubscriber('notifications')
      class NotificationSubscriber {
        async handle(_message: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Process notification
        }
      }

      const subscriber = new NotificationSubscriber() as unknown as SubscriberInterface;
      expect(subscriber.subjects).toEqual(['test.test-app.notifications']);
    });

    it('should create subscriber for hierarchical topic', () => {
      @topicSubscriber('notifications.email')
      class EmailNotificationSubscriber {
        async handle(_message: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Process email notification
        }
      }

      const subscriber = new EmailNotificationSubscriber() as unknown as SubscriberInterface;
      expect(subscriber.subjects).toEqual(['test.test-app.notifications.email']);
    });

    it('should create subscriber for multiple topics', () => {
      @topicSubscriber(['notifications', 'audit.events'])
      class MultiTopicSubscriber {
        async handle(_message: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Process multiple topics
        }
      }

      const subscriber = new MultiTopicSubscriber() as unknown as SubscriberInterface;
      expect(subscriber.subjects).toEqual([
        'test.test-app.notifications',
        'test.test-app.audit.events',
      ]);
    });

    it('should handle topic with wildcard', () => {
      @topicSubscriber('notifications.*')
      class WildcardSubscriber {
        async handle(_message: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Process wildcard topics
        }
      }

      const subscriber = new WildcardSubscriber() as unknown as SubscriberInterface;
      expect(subscriber.subjects).toEqual(['test.test-app.notifications.*']);
    });

    it('should normalize topic names', () => {
      @topicSubscriber('USER@EVENTS!')
      class NormalizedSubscriber {
        async handle(_message: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Process normalized topic
        }
      }

      const subscriber = new NormalizedSubscriber() as unknown as SubscriberInterface;
      expect(subscriber.subjects).toEqual(['test.test-app.user_events_']);
    });

    it('should preserve dots in hierarchical topics', () => {
      @topicSubscriber('analytics.user.signup')
      class AnalyticsSubscriber {
        async handle(_message: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Process analytics event
        }
      }

      const subscriber = new AnalyticsSubscriber() as unknown as SubscriberInterface;
      expect(subscriber.subjects).toEqual(['test.test-app.analytics.user.signup']);
    });

    it('should pass through subscription options', () => {
      @topicSubscriber('notifications', { ackWait: 60000 })
      class OptionsSubscriber {
        async handle(_message: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Process with options
        }
      }

      const subscriber = new OptionsSubscriber() as unknown as SubscriberInterface;
      expect(subscriber.options).toEqual({ ackWait: 60000 });
    });
  });

  describe('topicSubscriberWildcard decorator', () => {
    it('should create subscriber with wildcard pattern', () => {
      @topicSubscriberWildcard('notifications')
      class AllNotificationsSubscriber {
        async handle(_message: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Process all notifications
        }
      }

      const subscriber = new AllNotificationsSubscriber() as unknown as SubscriberInterface;
      expect(subscriber.subjects).toEqual(['test.test-app.notifications.>']);
    });

    it('should create subscriber for nested wildcard', () => {
      @topicSubscriberWildcard('order.processing')
      class OrderProcessingSubscriber {
        async handle(_message: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Process order events
        }
      }

      const subscriber = new OrderProcessingSubscriber() as unknown as SubscriberInterface;
      expect(subscriber.subjects).toEqual(['test.test-app.order.processing.>']);
    });

    it('should pass through subscription options', () => {
      @topicSubscriberWildcard('notifications', { ackWait: 60000 })
      class WildcardOptionsSubscriber {
        async handle(_message: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Process with options
        }
      }

      const subscriber = new WildcardOptionsSubscriber() as unknown as SubscriberInterface;
      expect(subscriber.options).toEqual({ ackWait: 60000 });
    });
  });

  describe('Subscriber', () => {
    it('should initialize with subject', () => {
      class TestSubscriber extends Subscriber {
        constructor() {
          super('test.test-app.notifications');
        }

        async handle(_event: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Test implementation
        }
      }

      const subscriber = new TestSubscriber();
      expect(subscriber.subjects).toEqual(['test.test-app.notifications']);
    });

    it('should initialize with multiple subjects', () => {
      class TestSubscriber extends Subscriber {
        constructor() {
          super(['test.test-app.notifications', 'test.test-app.audit']);
        }

        async handle(_event: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Test implementation
        }
      }

      const subscriber = new TestSubscriber();
      expect(subscriber.subjects).toEqual(['test.test-app.notifications', 'test.test-app.audit']);
    });

    it('should extract topic from subject', () => {
      class TestSubscriber extends Subscriber {
        constructor() {
          super('test.test-app.notifications.email');
        }

        async handle(_event: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Test implementation
        }

        public testExtractTopic(subject: string): string {
          return this.extractTopic(subject);
        }
      }

      const subscriber = new TestSubscriber();
      expect(subscriber.testExtractTopic('test.test-app.notifications.email')).toBe(
        'notifications.email'
      );
      expect(subscriber.testExtractTopic('production.prod-app.order.processing.completed')).toBe(
        'order.processing.completed'
      );
    });

    it('should check if message is from specific topic', () => {
      class TestSubscriber extends Subscriber {
        constructor() {
          super('test.test-app.notifications');
        }

        async handle(_event: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Test implementation
        }

        public testFromTopic(metadata: TopicMetadata, topicName: string): boolean {
          return this.fromTopic(metadata, topicName);
        }
      }

      const subscriber = new TestSubscriber();
      const metadata: TopicMetadata = {
        topic: 'notifications.email',
        subject: 'test.test-app.notifications.email',
        event_id: '123',
        domain: 'notifications',
        resource: 'notification',
        action: 'email',
        deliveries: 1,
      };

      expect(subscriber.testFromTopic(metadata, 'notifications.email')).toBe(true);
      expect(subscriber.testFromTopic(metadata, 'notifications')).toBe(false);
    });
  });

  describe('cross-environment support', () => {
    it('should work with different environments', () => {
      config.configure({
        env: 'production',
        appName: 'prod-app',
      });

      @topicSubscriber('notifications')
      class ProdSubscriber {
        async handle(_message: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Process notification in production
        }
      }

      const subscriber = new ProdSubscriber() as unknown as SubscriberInterface;
      expect(subscriber.subjects).toEqual(['production.prod-app.notifications']);
    });

    it('should create wildcard subscribers in different environments', () => {
      config.configure({
        env: 'staging',
        appName: 'staging-app',
      });

      @topicSubscriberWildcard('notifications')
      class StagingSubscriber {
        async handle(_message: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Process notification in staging
        }
      }

      const subscriber = new StagingSubscriber() as unknown as SubscriberInterface;
      expect(subscriber.subjects).toEqual(['staging.staging-app.notifications.>']);
    });
  });
});
