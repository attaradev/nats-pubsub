import {
  topicSubscriber,
  topicSubscriberWildcard,
  BaseTopicSubscriber,
  TopicMetadata,
} from '../topic-subscriber';
import { Subscriber } from '../types';
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
        async call(message: Record<string, unknown>, metadata: TopicMetadata) {
          return { message, metadata };
        }
      }

      const subscriber = new NotificationSubscriber() as unknown as Subscriber;
      expect(subscriber.subjects).toEqual(['test.test-app.notifications']);
    });

    it('should create subscriber for hierarchical topic', () => {
      @topicSubscriber('notifications.email')
      class EmailNotificationSubscriber {
        async call(message: Record<string, unknown>, metadata: TopicMetadata) {
          return { message, metadata };
        }
      }

      const subscriber = new EmailNotificationSubscriber() as unknown as Subscriber;
      expect(subscriber.subjects).toEqual(['test.test-app.notifications.email']);
    });

    it('should create subscriber for multiple topics', () => {
      @topicSubscriber(['notifications', 'audit.events'])
      class MultiTopicSubscriber {
        async call(message: Record<string, unknown>, metadata: TopicMetadata) {
          return { message, metadata };
        }
      }

      const subscriber = new MultiTopicSubscriber() as unknown as Subscriber;
      expect(subscriber.subjects).toEqual([
        'test.test-app.notifications',
        'test.test-app.audit.events',
      ]);
    });

    it('should handle topic with wildcard', () => {
      @topicSubscriber('notifications.*')
      class WildcardSubscriber {
        async call(message: Record<string, unknown>, metadata: TopicMetadata) {
          return { message, metadata };
        }
      }

      const subscriber = new WildcardSubscriber() as unknown as Subscriber;
      expect(subscriber.subjects).toEqual(['test.test-app.notifications.*']);
    });

    it('should normalize topic names', () => {
      @topicSubscriber('USER@EVENTS!')
      class NormalizedSubscriber {
        async call(message: Record<string, unknown>, metadata: TopicMetadata) {
          return { message, metadata };
        }
      }

      const subscriber = new NormalizedSubscriber() as unknown as Subscriber;
      expect(subscriber.subjects).toEqual(['test.test-app.user_events_']);
    });

    it('should preserve dots in hierarchical topics', () => {
      @topicSubscriber('analytics.user.signup')
      class AnalyticsSubscriber {
        async call(message: Record<string, unknown>, metadata: TopicMetadata) {
          return { message, metadata };
        }
      }

      const subscriber = new AnalyticsSubscriber() as unknown as Subscriber;
      expect(subscriber.subjects).toEqual(['test.test-app.analytics.user.signup']);
    });

    it('should pass through subscription options', () => {
      @topicSubscriber('notifications', { ackWait: 60000 })
      class OptionsSubscriber {
        async call(message: Record<string, unknown>, metadata: TopicMetadata) {
          return { message, metadata };
        }
      }

      const subscriber = new OptionsSubscriber() as unknown as Subscriber;
      expect(subscriber.options).toEqual({ ackWait: 60000 });
    });
  });

  describe('topicSubscriberWildcard decorator', () => {
    it('should create subscriber with wildcard pattern', () => {
      @topicSubscriberWildcard('notifications')
      class AllNotificationsSubscriber {
        async call(message: Record<string, unknown>, metadata: TopicMetadata) {
          return { message, metadata };
        }
      }

      const subscriber = new AllNotificationsSubscriber() as unknown as Subscriber;
      expect(subscriber.subjects).toEqual(['test.test-app.notifications.>']);
    });

    it('should create subscriber for nested wildcard', () => {
      @topicSubscriberWildcard('order.processing')
      class OrderProcessingSubscriber {
        async call(message: Record<string, unknown>, metadata: TopicMetadata) {
          return { message, metadata };
        }
      }

      const subscriber = new OrderProcessingSubscriber() as unknown as Subscriber;
      expect(subscriber.subjects).toEqual(['test.test-app.order.processing.>']);
    });

    it('should pass through subscription options', () => {
      @topicSubscriberWildcard('notifications', { ackWait: 60000 })
      class WildcardOptionsSubscriber {
        async call(message: Record<string, unknown>, metadata: TopicMetadata) {
          return { message, metadata };
        }
      }

      const subscriber = new WildcardOptionsSubscriber() as unknown as Subscriber;
      expect(subscriber.options).toEqual({ ackWait: 60000 });
    });
  });

  describe('BaseTopicSubscriber', () => {
    it('should initialize with subject', () => {
      class TestSubscriber extends BaseTopicSubscriber {
        constructor() {
          super('test.test-app.notifications');
        }

        async call(_event: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Test implementation
        }
      }

      const subscriber = new TestSubscriber();
      expect(subscriber.subjects).toEqual(['test.test-app.notifications']);
    });

    it('should initialize with multiple subjects', () => {
      class TestSubscriber extends BaseTopicSubscriber {
        constructor() {
          super(['test.test-app.notifications', 'test.test-app.audit']);
        }

        async call(_event: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
          // Test implementation
        }
      }

      const subscriber = new TestSubscriber();
      expect(subscriber.subjects).toEqual(['test.test-app.notifications', 'test.test-app.audit']);
    });

    it('should extract topic from subject', () => {
      class TestSubscriber extends BaseTopicSubscriber {
        constructor() {
          super('test.test-app.notifications.email');
        }

        async call(_event: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
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
      class TestSubscriber extends BaseTopicSubscriber {
        constructor() {
          super('test.test-app.notifications');
        }

        async call(_event: Record<string, unknown>, _metadata: TopicMetadata): Promise<void> {
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
        async call(message: Record<string, unknown>, metadata: TopicMetadata) {
          return { message, metadata };
        }
      }

      const subscriber = new ProdSubscriber() as unknown as Subscriber;
      expect(subscriber.subjects).toEqual(['production.prod-app.notifications']);
    });

    it('should create wildcard subscribers in different environments', () => {
      config.configure({
        env: 'staging',
        appName: 'staging-app',
      });

      @topicSubscriberWildcard('notifications')
      class StagingSubscriber {
        async call(message: Record<string, unknown>, metadata: TopicMetadata) {
          return { message, metadata };
        }
      }

      const subscriber = new StagingSubscriber() as unknown as Subscriber;
      expect(subscriber.subjects).toEqual(['staging.staging-app.notifications.>']);
    });
  });
});
