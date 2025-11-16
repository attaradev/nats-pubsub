import { BaseSubscriber } from '../subscriber';
import { EventMetadata } from '../types';

class TestSubscriber extends BaseSubscriber {
  public callHandler = jest.fn();

  constructor(subjects: string | string[]) {
    super(subjects);
  }

  async call(event: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
    this.callHandler(event, metadata);
  }
}

describe('BaseSubscriber', () => {
  describe('constructor', () => {
    it('should accept single subject string', () => {
      const subscriber = new TestSubscriber('test.events.users.user.created');
      expect(subscriber.subjects).toEqual(['test.events.users.user.created']);
    });

    it('should accept array of subjects', () => {
      const subjects = [
        'test.events.users.user.created',
        'test.events.users.user.updated',
      ];
      const subscriber = new TestSubscriber(subjects);
      expect(subscriber.subjects).toEqual(subjects);
    });

    it('should accept wildcard subjects', () => {
      const subscriber = new TestSubscriber('test.events.users.user.*');
      expect(subscriber.subjects).toEqual(['test.events.users.user.*']);
    });

    it('should accept catch-all subjects', () => {
      const subscriber = new TestSubscriber('test.events.>');
      expect(subscriber.subjects).toEqual(['test.events.>']);
    });
  });

  describe('subjects', () => {
    it('should return array of subjects', () => {
      const subscriber = new TestSubscriber([
        'test.events.orders.order.created',
        'test.events.orders.order.updated',
      ]);

      expect(subscriber.subjects).toHaveLength(2);
      expect(subscriber.subjects[0]).toBe('test.events.orders.order.created');
      expect(subscriber.subjects[1]).toBe('test.events.orders.order.updated');
    });

    it('should be read-only', () => {
      const subscriber = new TestSubscriber('test.events.users.user.created');
      const originalSubjects = subscriber.subjects;

      // Attempt to modify (should not affect internal state due to spread in getter)
      const subjects = subscriber.subjects;
      subjects.push('new.subject');

      expect(subscriber.subjects).toEqual(originalSubjects);
    });
  });

  describe('call', () => {
    it('should be implemented by subclass', async () => {
      const subscriber = new TestSubscriber('test.events.users.user.created');
      const event = { id: '123', name: 'Alice' };
      const metadata: EventMetadata = {
        event_id: 'evt-123',
        subject: 'test.events.users.user.created',
        action: 'created',
        domain: 'users',
        resource: 'user',
      };

      await subscriber.call(event, metadata);

      expect(subscriber.callHandler).toHaveBeenCalledWith(event, metadata);
    });

    it('should receive event payload', async () => {
      const subscriber = new TestSubscriber('test.events.orders.order.placed');
      const event = {
        order_id: 'order-123',
        user_id: 'user-456',
        total: 99.99,
        items: [{ sku: 'ITEM-1', quantity: 2 }],
      };
      const metadata: EventMetadata = {
        event_id: 'evt-789',
        subject: 'test.events.orders.order.placed',
        action: 'placed',
        domain: 'orders',
        resource: 'order',
      };

      await subscriber.call(event, metadata);

      expect(subscriber.callHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: 'order-123',
          user_id: 'user-456',
          total: 99.99,
        }),
        metadata
      );
    });

    it('should receive metadata with parsed subject components', async () => {
      const subscriber = new TestSubscriber('production.events.payments.payment.*');
      const event = { payment_id: 'pay-123', amount: 50.0 };
      const metadata: EventMetadata = {
        event_id: 'evt-999',
        subject: 'production.events.payments.payment.completed',
        action: 'completed',
        domain: 'payments',
        resource: 'payment',
      };

      await subscriber.call(event, metadata);

      const receivedMetadata = subscriber.callHandler.mock.calls[0][1];
      expect(receivedMetadata.domain).toBe('payments');
      expect(receivedMetadata.resource).toBe('payment');
      expect(receivedMetadata.action).toBe('completed');
    });

    it('should handle errors in call implementation', async () => {
      class ErrorSubscriber extends BaseSubscriber {
        async call(_event: Record<string, unknown>, _metadata: EventMetadata): Promise<void> {
          throw new Error('Processing error');
        }
      }

      const subscriber = new ErrorSubscriber('test.subject');
      const event = { id: '123' };
      const metadata: EventMetadata = {
        event_id: 'evt-123',
        subject: 'test.subject',
        action: 'created',
        domain: 'test',
        resource: 'test',
      };

      await expect(subscriber.call(event, metadata)).rejects.toThrow('Processing error');
    });

    it('should support async operations', async () => {
      class AsyncSubscriber extends BaseSubscriber {
        async call(event: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 10));
          event.processed = true;
        }
      }

      const subscriber = new AsyncSubscriber('test.subject');
      const event: any = { id: '123' };
      const metadata: EventMetadata = {
        event_id: 'evt-123',
        subject: 'test.subject',
        action: 'created',
        domain: 'test',
        resource: 'test',
      };

      await subscriber.call(event, metadata);

      expect(event.processed).toBe(true);
    });
  });

  describe('multiple subject patterns', () => {
    it('should handle multiple specific subjects', () => {
      const subscriber = new TestSubscriber([
        'test.events.users.user.created',
        'test.events.orders.order.placed',
        'test.events.payments.payment.completed',
      ]);

      expect(subscriber.subjects).toHaveLength(3);
    });

    it('should handle mix of wildcards and specific subjects', () => {
      const subscriber = new TestSubscriber([
        'test.events.users.user.*',
        'test.events.orders.order.placed',
      ]);

      expect(subscriber.subjects).toHaveLength(2);
      expect(subscriber.subjects[0]).toBe('test.events.users.user.*');
      expect(subscriber.subjects[1]).toBe('test.events.orders.order.placed');
    });
  });

  describe('inheritance', () => {
    it('should allow custom subscriber classes', () => {
      class UserCreatedSubscriber extends BaseSubscriber {
        constructor() {
          super('production.events.users.user.created');
        }

        async call(_event: Record<string, unknown>, _metadata: EventMetadata): Promise<void> {
          // Custom logic
        }
      }

      const subscriber = new UserCreatedSubscriber();
      expect(subscriber.subjects).toEqual(['production.events.users.user.created']);
    });

    it('should support subscriber with custom properties', () => {
      class CustomSubscriber extends BaseSubscriber {
        private retryCount: number = 0;

        constructor(subjects: string | string[]) {
          super(subjects);
        }

        async call(_event: Record<string, unknown>, _metadata: EventMetadata): Promise<void> {
          this.retryCount++;
        }

        getRetryCount(): number {
          return this.retryCount;
        }
      }

      const subscriber = new CustomSubscriber('test.subject');
      expect(subscriber.getRetryCount()).toBe(0);
    });
  });
});
