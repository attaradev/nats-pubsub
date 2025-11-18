# Comprehensive Multi-Application Architecture with Independent Acknowledgment

## Executive Summary

This document proposes a comprehensive architecture enabling:

1. **Multi-Stream Cross-Application Messaging**: Each application publishes to its own dedicated stream, and other applications can subscribe to multiple streams from different publishers
2. **Independent Subscriber Acknowledgment**: Each subscriber within each application processes and acknowledges messages independently

### The Complete Use Case

```
Order Service (App A):
  ├─ Publishes to: ORDERS stream
  │    └─ Topics: order.created, order.confirmed, order.cancelled
  └─ Subscribes from: PAYMENTS stream, INVENTORY stream

Email Service (App B):
  ├─ Publishes to: NOTIFICATIONS stream
  │    └─ Topics: email.sent, email.failed
  └─ Subscribes from: ORDERS stream
       ├─ EmailNotificationSubscriber  ─┐
       └─ EmailAnalyticsSubscriber      ├─ Independent ACK per subscriber
                                        ─┘
Inventory Service (App C):
  ├─ Publishes to: INVENTORY stream
  │    └─ Topics: inventory.reserved, inventory.released
  └─ Subscribes from: ORDERS stream
       ├─ InventoryReservationSubscriber ─┐
       ├─ InventoryAnalyticsSubscriber    ├─ Independent ACK per subscriber
       └─ InventoryAuditSubscriber        ─┘
                                           ─┘
Payment Service (App D):
  ├─ Publishes to: PAYMENTS stream
  │    └─ Topics: payment.processed, payment.failed
  └─ Subscribes from: ORDERS stream
       └─ PaymentProcessingSubscriber

```

**Requirements**:

- ✅ Each app publishes to its own dedicated stream
- ✅ Apps can subscribe to multiple streams from different publishers
- ✅ Each app has independent delivery tracking
- ✅ Each subscriber within an app acknowledges independently
- ✅ Failure in one subscriber doesn't affect others (even within same app)
- ✅ Many-to-many messaging pattern supported

---

## Problem Analysis

### Current Architecture Limitations

#### Issue 1: Single Stream Per Environment (Multi-Stream Problem)

**Current Stream Pattern**: One shared stream for all apps

```typescript
// Current: All apps publish/subscribe to single stream
Stream: EVENTS
  ├─ production.app-a.order.created
  ├─ production.app-b.email.sent
  └─ production.app-c.inventory.reserved

Problem: No clear ownership boundaries per application
```

**Desired Multi-Stream Pattern**: Each app owns its stream

```typescript
// Order Service owns ORDERS stream
Stream: ORDERS
  Subject: production.order-service.order.created

// Email Service owns NOTIFICATIONS stream
Stream: NOTIFICATIONS
  Subject: production.email-service.email.sent

// Inventory Service owns INVENTORY stream
Stream: INVENTORY
  Subject: production.inventory-service.inventory.reserved
```

**Impact**:
- No clear stream ownership per application
- Difficult to apply stream-level policies per app
- All apps tightly coupled to single stream configuration

#### Issue 2: Shared Acknowledgment (Within-App Problem)

**Current Behavior**: One consumer per subject per app, all subscribers share acknowledgment.

```typescript
// App B has 2 subscribers for order.created
EmailNotificationSubscriber    ✓ Success
EmailAnalyticsSubscriber       ✗ Failure

// Result: BOTH subscribers reprocess on retry
EmailNotificationSubscriber    ✓ Success (redundant)
EmailAnalyticsSubscriber       ✗ Failure
```

**Impact**: Successful subscribers waste resources reprocessing.

---

## Proposed Architecture

### Multi-Stream with Independent Consumer Model

**Stream Architecture**:

```
Stream: ORDERS (owned by Order Service)
  Subject: production.order-service.order.created
    │
    ├─── Consumer: email-service_production_order-service_order_created_EmailNotificationSubscriber
    │         └─ Email Service subscribes to ORDERS stream
    │
    ├─── Consumer: email-service_production_order-service_order_created_EmailAnalyticsSubscriber
    │         └─ Email Service subscribes to ORDERS stream
    │
    ├─── Consumer: inventory-service_production_order-service_order_created_InventoryReservationSubscriber
    │         └─ Inventory Service subscribes to ORDERS stream
    │
    ├─── Consumer: inventory-service_production_order-service_order_created_InventoryAnalyticsSubscriber
    │         └─ Inventory Service subscribes to ORDERS stream
    │
    └─── Consumer: inventory-service_production_order-service_order_created_InventoryAuditSubscriber
              └─ Inventory Service subscribes to ORDERS stream

Stream: PAYMENTS (owned by Payment Service)
  Subject: production.payment-service.payment.processed
    │
    └─── Consumer: order-service_production_payment-service_payment_processed_PaymentProcessedSubscriber
              └─ Order Service subscribes to PAYMENTS stream

Stream: INVENTORY (owned by Inventory Service)
  Subject: production.inventory-service.inventory.reserved
    │
    └─── Consumer: order-service_production_inventory-service_inventory_reserved_InventoryReservedSubscriber
              └─ Order Service subscribes to INVENTORY stream
```

### Key Principles

1. **Stream Per Application**: Each app publishes to its own dedicated stream
2. **App-Specific Subject Namespace**: Each app publishes to `{env}.{appName}.{topic}`
3. **Cross-Stream Subscription**: Apps can subscribe to topics from multiple streams (from other apps)
4. **Subscriber-Specific Consumers**: Each subscriber gets its own consumer
5. **Independent Acknowledgment**: Each consumer ACKs independently
6. **Many-to-Many Pattern**: Any app can subscribe to any other app's stream

### Consumer Naming Convention

```
{subscriberAppName}_{env}_{publisherAppName}_{topic}_{subscriberName}
```

**Examples**:

```
# Email Service subscribing to Order Service's stream
email-service_production_order-service_order_created_EmailNotificationSubscriber
email-service_production_order-service_order_created_EmailAnalyticsSubscriber

# Inventory Service subscribing to Order Service's stream
inventory-service_production_order-service_order_created_InventoryReservationSubscriber
inventory-service_production_order-service_order_created_InventoryAnalyticsSubscriber
inventory-service_production_order-service_order_created_InventoryAuditSubscriber

# Order Service subscribing to Payment Service's stream
order-service_production_payment-service_payment_processed_PaymentProcessedSubscriber

# Order Service subscribing to Inventory Service's stream
order-service_production_inventory-service_inventory_reserved_InventoryReservedSubscriber
```

---

## Implementation Design

### Configuration

#### Global Configuration (Per Application)

**JavaScript**:

```typescript
// Order Service: Publishes to ORDERS stream, subscribes from PAYMENTS & INVENTORY streams
NatsPubsub.configure({
  env: 'production',
  appName: 'order-service',
  streamName: 'ORDERS',           // Own stream for publishing
  independentAck: true,           // Enable per-subscriber consumers
  // Subscribes to:
  // - payment-service's PAYMENTS stream (payment.processed)
  // - inventory-service's INVENTORY stream (inventory.reserved)
});

// Email Service: Publishes to NOTIFICATIONS stream, subscribes from ORDERS stream
NatsPubsub.configure({
  env: 'production',
  appName: 'email-service',
  streamName: 'NOTIFICATIONS',    // Own stream for publishing
  independentAck: true,           // Each subscriber gets own consumer
  // Subscribes to:
  // - order-service's ORDERS stream (order.created, order.confirmed)
});

// Inventory Service: Publishes to INVENTORY stream, subscribes from ORDERS stream
NatsPubsub.configure({
  env: 'production',
  appName: 'inventory-service',
  streamName: 'INVENTORY',        // Own stream for publishing
  independentAck: true,
  // Subscribes to:
  // - order-service's ORDERS stream (order.created)
});

// Payment Service: Publishes to PAYMENTS stream, subscribes from ORDERS stream
NatsPubsub.configure({
  env: 'production',
  appName: 'payment-service',
  streamName: 'PAYMENTS',         // Own stream for publishing
  independentAck: true,
  // Subscribes to:
  // - order-service's ORDERS stream (order.inventory_reserved)
});
```

**Ruby**:

```ruby
# Order Service: Publishes to ORDERS stream, subscribes from PAYMENTS & INVENTORY streams
NatsPubsub.configure do |config|
  config.env = 'production'
  config.app_name = 'order-service'
  config.stream_name = 'ORDERS'
  config.independent_ack = true
end

# Email Service: Publishes to NOTIFICATIONS stream, subscribes from ORDERS stream
NatsPubsub.configure do |config|
  config.env = 'production'
  config.app_name = 'email-service'
  config.stream_name = 'NOTIFICATIONS'
  config.independent_ack = true
end

# Inventory Service: Publishes to INVENTORY stream, subscribes from ORDERS stream
NatsPubsub.configure do |config|
  config.env = 'production'
  config.app_name = 'inventory-service'
  config.stream_name = 'INVENTORY'
  config.independent_ack = true
end

# Payment Service: Publishes to PAYMENTS stream, subscribes from ORDERS stream
NatsPubsub.configure do |config|
  config.env = 'production'
  config.app_name = 'payment-service'
  config.stream_name = 'PAYMENTS'
  config.independent_ack = true
end
```

### Subject Building

**Subjects are always app-scoped** to support the multi-stream architecture where each app owns its stream.

**JavaScript** (`packages/javascript/src/core/subject.ts`):

```typescript
export class Subject {
  static forTopic(env: string, appName: string, topic: string): string {
    const normalizedTopic = this.normalizeName(topic);
    // Always use app-specific namespace
    // This allows each app to own its stream
    return `${env}.${appName}.${normalizedTopic}`;
  }

  // When subscribing to another app's topics, specify the publisher's appName
  static forRemoteTopic(env: string, publisherAppName: string, topic: string): string {
    const normalizedTopic = this.normalizeName(topic);
    return `${env}.${publisherAppName}.${normalizedTopic}`;
  }
}
```

**Ruby** (`packages/ruby/lib/nats_pubsub/core/subject.rb`):

```ruby
def self.from_topic(env:, app_name:, topic:)
  normalized_topic = normalize_topic(topic)
  # Always use app-specific namespace
  new("#{env}.#{app_name}.#{normalized_topic}")
end

# When subscribing to another app's topics
def self.from_remote_topic(env:, publisher_app_name:, topic:)
  normalized_topic = normalize_topic(topic)
  new("#{env}.#{publisher_app_name}.#{normalized_topic}")
end
```

### Subscribing to Remote Streams

When an app wants to subscribe to topics from **another app's stream**, it needs to specify the publisher's stream configuration.

**JavaScript**:

```typescript
// Email Service subscribing to Order Service's topics
import { remoteTopicSubscriber } from 'nats-pubsub';

@remoteTopicSubscriber({
  publisherAppName: 'order-service',   // The app that publishes this topic
  publisherStreamName: 'ORDERS',       // The stream where topic is published
  topic: 'order.created',              // The topic to subscribe to
  maxDeliver: 5,
  ackWait: 30000,
})
export class EmailNotificationSubscriber {
  async handle(message: any, context: any): Promise<void> {
    // Handle order.created from order-service's ORDERS stream
  }
}
```

**Alternative: Explicit Configuration**:

```typescript
// Order Service subscribing to multiple remote streams
import { topicSubscriber } from 'nats-pubsub';

// Subscribe to payment-service's PAYMENTS stream
@topicSubscriber('payment-service.payment.processed', {
  streamName: 'PAYMENTS',  // Specify the publisher's stream
  maxDeliver: 5,
})
export class PaymentProcessedSubscriber {
  async handle(message: any, context: any): Promise<void> {
    // Handle payment.processed from payment-service's PAYMENTS stream
  }
}

// Subscribe to inventory-service's INVENTORY stream
@topicSubscriber('inventory-service.inventory.reserved', {
  streamName: 'INVENTORY',  // Specify the publisher's stream
  maxDeliver: 5,
})
export class InventoryReservedSubscriber {
  async handle(message: any, context: any): Promise<void> {
    // Handle inventory.reserved from inventory-service's INVENTORY stream
  }
}
```

**Ruby**:

```ruby
# Email Service subscribing to Order Service's topics
class EmailNotificationSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.created',
    publisher_app: 'order-service',
    publisher_stream: 'ORDERS'

  def handle(message, context)
    # Handle order.created from order-service's ORDERS stream
  end
end

# Order Service subscribing to multiple remote streams
class PaymentProcessedSubscriber < NatsPubsub::Subscriber
  subscribe_to 'payment.processed',
    publisher_app: 'payment-service',
    publisher_stream: 'PAYMENTS'

  def handle(message, context)
    # Handle payment.processed
  end
end

class InventoryReservedSubscriber < NatsPubsub::Subscriber
  subscribe_to 'inventory.reserved',
    publisher_app: 'inventory-service',
    publisher_stream: 'INVENTORY'

  def handle(message, context)
    # Handle inventory.reserved
  end
end
```

### Consumer Creation

**JavaScript** (`packages/javascript/src/subscribers/consumer.ts`):

```typescript
export class Consumer {
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Consumer already running');
    }

    await connection.ensureConnection();
    const logger = config.logger;
    const cfg = config.get();

    this.running = true;
    logger.info('Starting consumer...');

    const jsm = await connection.getConnection().jetstreamManager();
    await this.topologyManager.ensureTopology(jsm);

    if (cfg.independentAck) {
      // New: Independent ACK mode - one consumer per subscriber
      await this.startIndependentMode();
    } else {
      // Legacy: Shared ACK mode - one consumer per subject
      await this.startLegacyMode();
    }

    logger.info('Consumer started');
  }

  private async startIndependentMode(): Promise<void> {
    const logger = config.logger;
    const subjects = this.registry.getAllSubjects();

    for (const subject of subjects) {
      const subscribers = this.registry.getSubscribers(subject);
      
      // Create separate consumer for each subscriber
      for (const subscriber of subscribers) {
        await this.subscribeIndependent(subject, subscriber);
        logger.info('Created independent consumer', {
          subject,
          subscriber: subscriber.constructor.name,
        });
      }
    }
  }

  private async startLegacyMode(): Promise<void> {
    const subjects = this.registry.getAllSubjects();
    
    for (const subject of subjects) {
      await this.subscribeLegacy(subject);
    }
  }

  private async subscribeIndependent(subject: string, subscriber: Subscriber): Promise<void> {
    const js = connection.getJetStream();
    const cfg = config.get();
    const streamName = config.streamName;
    const logger = config.logger;

    // Build consumer name with subscriber identity
    const durableName = this.buildDurableNameForSubscriber(subject, subscriber);

    const consumerConfig: Partial<ConsumerConfig> = {
      durable_name: durableName,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant,
      filter_subject: subject,
      max_deliver: subscriber.options?.maxDeliver || cfg.maxDeliver || 5,
      ack_wait: toNanos(subscriber.options?.ackWait || cfg.ackWait || 30000),
      max_ack_pending: 1, // Process one at a time per subscriber
    };

    if (subscriber.options?.backoff || cfg.backoff) {
      const backoff = subscriber.options?.backoff || cfg.backoff || [];
      consumerConfig.backoff = backoff.map((ms) => toNanos(ms));
    }

    try {
      logger.info('Creating independent consumer', {
        subject,
        durable: durableName,
        subscriber: subscriber.constructor.name,
      });

      const consumer = await js.consumers.get(streamName, durableName);
      const messages = await consumer.consume({
        max_messages: 1, // One at a time for independent processing
      });

      logger.info('Independent consumer created', {
        subject,
        durable: durableName,
        subscriber: subscriber.constructor.name,
      });

      // Process messages for this specific subscriber only
      (async () => {
        for await (const msg of messages) {
          if (!this.running) break;
          await this.processMessageForSubscriber(msg, subscriber);
        }
      })();
    } catch (error) {
      logger.error('Failed to create independent consumer', {
        subject,
        subscriber: subscriber.constructor.name,
        error,
      });
      throw error;
    }
  }

  private async subscribeLegacy(subject: string): Promise<void> {
    // Existing implementation - one consumer per subject
    const js = connection.getJetStream();
    const cfg = config.get();
    const streamName = config.streamName;
    const logger = config.logger;

    const durableName = this.buildDurableName(subject);

    const consumerConfig: Partial<ConsumerConfig> = {
      durable_name: durableName,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant,
      filter_subject: subject,
      max_deliver: cfg.maxDeliver || 5,
      ack_wait: toNanos(cfg.ackWait || 30000),
      max_ack_pending: cfg.concurrency || 10,
    };

    if (cfg.backoff && cfg.backoff.length > 0) {
      consumerConfig.backoff = cfg.backoff.map((ms) => toNanos(ms));
    }

    try {
      const consumer = await js.consumers.get(streamName, durableName);
      const messages = await consumer.consume({
        max_messages: cfg.concurrency || 10,
      });

      // Process messages with all subscribers
      (async () => {
        for await (const msg of messages) {
          if (!this.running) break;
          const subscribers = this.registry.getSubscribers(subject);
          await this.messageProcessor.processMessage(msg, subscribers);
        }
      })();
    } catch (error) {
      logger.error('Failed to create consumer', { subject, error });
      throw error;
    }
  }

  private async processMessageForSubscriber(msg: JsMsg, subscriber: Subscriber): Promise<void> {
    const logger = config.logger;

    try {
      const data = JSON.parse(msg.data.toString());
      const envelope = data;

      const metadata: EventMetadata = {
        event_id: envelope.event_id,
        subject: msg.subject,
        domain: this.extractDomain(msg.subject),
        resource: envelope.resource_type,
        action: envelope.event_type,
        stream: msg.info?.stream,
        stream_seq: msg.seq,
        deliveries: msg.info?.deliveryCount,
        trace_id: envelope.trace_id,
      };

      logger.debug('Processing message with independent subscriber', {
        subject: msg.subject,
        event_id: metadata.event_id,
        subscriber: subscriber.constructor.name,
        deliveries: metadata.deliveries,
      });

      // Execute middleware and subscriber
      await this.middlewareChain.execute(envelope.payload, metadata, async () => {
        await this.executeSubscriberWithTimeout(subscriber, envelope.payload, metadata);
      });

      // Independent ACK - only this subscriber acknowledges
      msg.ack();
      
      logger.debug('Message processed and acknowledged independently', {
        subject: msg.subject,
        event_id: metadata.event_id,
        subscriber: subscriber.constructor.name,
      });

    } catch (error) {
      logger.error('Failed to process message for subscriber', {
        subject: msg.subject,
        subscriber: subscriber.constructor.name,
        error,
      });

      // Independent error handling - only this subscriber retries/DLQ
      await this.dlqHandler.handleFailure(msg, error, {
        subscriber: subscriber.constructor.name,
      });
    }
  }

  private async executeSubscriberWithTimeout(
    subscriber: Subscriber,
    payload: Record<string, unknown>,
    metadata: EventMetadata
  ): Promise<void> {
    const cfg = config.get();

    if (!subscriber.handle) {
      throw new Error(
        `Subscriber ${subscriber.constructor?.name || 'unknown'} missing handle() method`
      );
    }

    if (cfg.subscriberTimeoutMs && cfg.subscriberTimeoutMs > 0) {
      let timeoutId: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          subscriber.handle(payload, metadata),
          new Promise((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error('subscriber_timeout')),
              cfg.subscriberTimeoutMs
            );
            timeoutId?.unref();
          }),
        ]);
      } finally {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      }
    } else {
      await subscriber.handle(payload, metadata);
    }
  }

  private buildDurableNameForSubscriber(subject: string, subscriber: Subscriber): string {
    const cfg = config.get();
    const sanitized = subject.replace(/[.*>]/g, '_');
    const subscriberName = subscriber.constructor.name;
    return `${cfg.appName}_${sanitized}_${subscriberName}`;
  }

  private buildDurableName(subject: string): string {
    // Legacy consumer naming
    const cfg = config.get();
    const sanitized = subject.replace(/[.*>]/g, '_');
    return `${cfg.appName}_${sanitized}`;
  }

  private extractDomain(subject: string): string {
    const eventParsed = Subject.parseEvent(subject);
    if (eventParsed) {
      return eventParsed.domain;
    }

    const topicParsed = Subject.parseTopic(subject);
    if (topicParsed) {
      return topicParsed.namespace || topicParsed.appName;
    }

    const parts = subject.split('.');
    return parts.length >= 3 ? parts[2] : '';
  }
}
```

**Ruby** (`packages/ruby/lib/nats_pubsub/subscribers/pool.rb`):

```ruby
module NatsPubsub
  module Subscribers
    class Pool
      def start!
        @running = true
        
        if NatsPubsub.config.independent_ack
          start_independent_mode!
        else
          start_legacy_mode!
        end
      end
      
      private
      
      def start_independent_mode!
        # Create one worker per subscriber instance
        @subscriber_instances.each do |subscriber_instance|
          subscriber_class = subscriber_instance.class
          subscriptions = subscriber_class.all_subscriptions
          
          subscriptions.each do |subscription|
            filter_subject = subscription[:pattern]
            
            # Build durable name with subscriber identity
            durable = build_durable_for_subscriber(filter_subject, subscriber_class)
            
            worker = Worker.new(
              durable_name: durable,
              filter_subject: filter_subject,
              subscriber: subscriber_instance
            ) do |event, subject, deliveries|
              context = build_context(event, subject, deliveries)
              subscriber_instance.handle(event, context)
            end
            
            @workers << worker
            
            Thread.new do
              begin
                worker.run!
              rescue StandardError => e
                Logging.error(
                  "Worker crashed for #{subscriber_class.name}: #{e.class} #{e.message}",
                  tag: 'NatsPubsub::Subscribers::Pool'
                )
              end
            end
          end
        end
        
        Logging.info(
          "Started #{@workers.size} independent workers",
          tag: 'NatsPubsub::Subscribers::Pool'
        )
      end
      
      def start_legacy_mode!
        # Existing implementation - one worker per subject pattern
        # Groups all subscribers by subject
        # ... (existing code)
      end
      
      def build_durable_for_subscriber(subject, subscriber_class)
        app_name = NatsPubsub.config.app_name
        sanitized = subject.gsub(/[.*>]/, '_')
        subscriber_name = subscriber_class.name.gsub('::', '_')
        "#{app_name}-#{sanitized}-#{subscriber_name}"
      end
    end
  end
end
```

---

## Complete Example

### Order Service: Publishes to ORDERS, Subscribes from PAYMENTS & INVENTORY

**JavaScript**:

```typescript
// order-service/config.ts
import NatsPubsub from 'nats-pubsub';

NatsPubsub.configure({
  env: 'production',
  appName: 'order-service',
  streamName: 'ORDERS',          // Own stream for publishing
  independentAck: true,           // Enable independent ACK for subscribers
});

// order-service/services/order-service.ts
import NatsPubsub from 'nats-pubsub';

export class OrderService {
  async createOrder(orderData: OrderData): Promise<Order> {
    const order = await this.saveOrder(orderData);

    // Publish to own ORDERS stream
    await NatsPubsub.publish('order.created', {
      orderId: order.id,
      customerId: order.customerId,
      items: order.items,
      total: order.total,
    });
    // Published to: production.order-service.order.created (in ORDERS stream)

    return order;
  }
}

// order-service/subscribers/payment-processed-subscriber.ts
import { topicSubscriber } from 'nats-pubsub';

// Subscribe to payment-service's PAYMENTS stream
@topicSubscriber('payment-service.payment.processed', {
  streamName: 'PAYMENTS',  // Subscribe from PAYMENTS stream
  maxDeliver: 5,
  ackWait: 30000,
})
export class PaymentProcessedSubscriber {
  async handle(message: any, context: any): Promise<void> {
    console.log(`[Order] Processing payment for order ${message.orderId}`);
    await orderService.handlePaymentProcessed(message.orderId, message.transactionId);
  }
}

// order-service/subscribers/inventory-reserved-subscriber.ts
@topicSubscriber('inventory-service.inventory.reserved', {
  streamName: 'INVENTORY',  // Subscribe from INVENTORY stream
  maxDeliver: 5,
  ackWait: 30000,
})
export class InventoryReservedSubscriber {
  async handle(message: any, context: any): Promise<void> {
    console.log(`[Order] Inventory reserved for order ${message.orderId}`);
    await orderService.handleInventoryReserved(message.orderId, message.reservationId);
  }
}
```

**Ruby**:

```ruby
# order-service/config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.env = 'production'
  config.app_name = 'order-service'
  config.stream_name = 'ORDERS'
  config.independent_ack = true
end

# order-service/app/services/order_service.rb
class OrderService
  def create_order(order_data)
    order = save_order(order_data)

    # Publish to own ORDERS stream
    NatsPubsub.publish('order.created',
      order_id: order.id,
      customer_id: order.customer_id,
      items: order.items,
      total: order.total
    )
    # Published to: production.order-service.order.created (in ORDERS stream)

    order
  end
end

# order-service/app/subscribers/payment_processed_subscriber.rb
class PaymentProcessedSubscriber < NatsPubsub::Subscriber
  subscribe_to 'payment.processed',
    publisher_app: 'payment-service',
    publisher_stream: 'PAYMENTS'

  def handle(message, context)
    puts "[Order] Processing payment for order #{message['order_id']}"
    OrderService.handle_payment_processed(message['order_id'], message['transaction_id'])
  end
end

# order-service/app/subscribers/inventory_reserved_subscriber.rb
class InventoryReservedSubscriber < NatsPubsub::Subscriber
  subscribe_to 'inventory.reserved',
    publisher_app: 'inventory-service',
    publisher_stream: 'INVENTORY'

  def handle(message, context)
    puts "[Order] Inventory reserved for order #{message['order_id']}"
    OrderService.handle_inventory_reserved(message['order_id'], message['reservation_id'])
  end
end
```

---

### Email Service: Publishes to NOTIFICATIONS, Subscribes from ORDERS

**JavaScript**:

```typescript
// email-service/config.ts
import NatsPubsub from 'nats-pubsub';

NatsPubsub.configure({
  env: 'production',
  appName: 'email-service',
  streamName: 'NOTIFICATIONS',    // Own stream for publishing
  independentAck: true,            // Each subscriber gets own consumer
});

// email-service/subscribers/email-notification-subscriber.ts
import { topicSubscriber } from 'nats-pubsub';

// Subscribe to order-service's ORDERS stream
@topicSubscriber('order-service.order.confirmed', {
  streamName: 'ORDERS',  // Subscribe from ORDERS stream
  maxDeliver: 5,
  ackWait: 30000,
})
export class EmailNotificationSubscriber {
  async handle(message: any, context: any): Promise<void> {
    console.log(`[EmailNotification] Processing order ${message.orderId}`);

    await sendEmail({
      to: message.customerEmail,
      subject: 'Order Confirmation',
      body: `Your order ${message.orderId} has been confirmed.`,
    });

    // Publish email.sent event to own NOTIFICATIONS stream
    await NatsPubsub.publish('email.sent', {
      orderId: message.orderId,
      emailType: 'order_confirmation',
    });

    console.log(`[EmailNotification] Email sent for order ${message.orderId}`);
  }
}
// Consumer: email-service_production_order-service_order_confirmed_EmailNotificationSubscriber

// email-service/subscribers/email-analytics-subscriber.ts
@topicSubscriber('order-service.order.created', {
  streamName: 'ORDERS',   // Subscribe from ORDERS stream
  maxDeliver: 3,          // Different retry policy
  ackWait: 60000,
})
export class EmailAnalyticsSubscriber {
  async handle(message: any, context: any): Promise<void> {
    console.log(`[EmailAnalytics] Tracking order ${message.orderId}`);

    await analytics.track('order_created', {
      orderId: message.orderId,
      total: message.total,
    });

    console.log(`[EmailAnalytics] Tracked order ${message.orderId}`);
  }
}
// Consumer: email-service_production_order-service_order_created_EmailAnalyticsSubscriber

// email-service/index.ts
import NatsPubsub from 'nats-pubsub';
import { EmailNotificationSubscriber } from './subscribers/email-notification-subscriber';
import { EmailAnalyticsSubscriber } from './subscribers/email-analytics-subscriber';

NatsPubsub.registerSubscriber(new EmailNotificationSubscriber());
NatsPubsub.registerSubscriber(new EmailAnalyticsSubscriber());

await NatsPubsub.start();
console.log('Email service subscribers started');
```

**Ruby**:

```ruby
# email-service/config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.env = 'production'
  config.app_name = 'email-service'
  config.stream_name = 'NOTIFICATIONS'
  config.independent_ack = true
end

# email-service/app/subscribers/email_notification_subscriber.rb
class EmailNotificationSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.confirmed',
    publisher_app: 'order-service',
    publisher_stream: 'ORDERS'

  jetstream_options(
    max_deliver: 5,
    ack_wait: 30
  )

  def handle(message, context)
    puts "[EmailNotification] Processing order #{message['order_id']}"

    send_email(
      to: message['customer_email'],
      subject: 'Order Confirmation',
      body: "Your order #{message['order_id']} has been confirmed."
    )

    # Publish email.sent event to own NOTIFICATIONS stream
    NatsPubsub.publish('email.sent',
      order_id: message['order_id'],
      email_type: 'order_confirmation'
    )

    puts "[EmailNotification] Email sent for order #{message['order_id']}"
  end
end
# Consumer: email-service-production-order-service-order_confirmed-EmailNotificationSubscriber

# email-service/app/subscribers/email_analytics_subscriber.rb
class EmailAnalyticsSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.created',
    publisher_app: 'order-service',
    publisher_stream: 'ORDERS'

  jetstream_options(
    max_deliver: 3,
    ack_wait: 60
  )

  def handle(message, context)
    puts "[EmailAnalytics] Tracking order #{message['order_id']}"

    Analytics.track('order_created',
      order_id: message['order_id'],
      total: message['total']
    )

    puts "[EmailAnalytics] Tracked order #{message['order_id']}"
  end
end
# Consumer: email-service-production-order-service-order_created-EmailAnalyticsSubscriber
```

---

### Inventory Service: Publishes to INVENTORY, Subscribes from ORDERS

**JavaScript**:

```typescript
// inventory-service/config.ts
import NatsPubsub from 'nats-pubsub';

NatsPubsub.configure({
  env: 'production',
  appName: 'inventory-service',
  streamName: 'INVENTORY',       // Own stream for publishing
  independentAck: true,
});

// inventory-service/subscribers/inventory-reservation-subscriber.ts
@topicSubscriber('order-service.order.created', {
  streamName: 'ORDERS',   // Subscribe from ORDERS stream
  maxDeliver: 10,         // Critical - retry more
  ackWait: 120000,        // 2 minutes
})
export class InventoryReservationSubscriber {
  async handle(message: any, context: any): Promise<void> {
    console.log(`[InventoryReservation] Processing order ${message.orderId}`);

    const reserved = await inventoryService.reserveItems(message.items);

    // Publish inventory.reserved event to own INVENTORY stream
    await NatsPubsub.publish('inventory.reserved', {
      orderId: message.orderId,
      reservationId: reserved.id,
      success: reserved.success,
    });

    console.log(`[InventoryReservation] Reserved items for order ${message.orderId}`);
  }
}
// Consumer: inventory-service_production_order-service_order_created_InventoryReservationSubscriber

// inventory-service/subscribers/inventory-analytics-subscriber.ts
@topicSubscriber('order-service.order.created', {
  streamName: 'ORDERS',   // Subscribe from ORDERS stream
  maxDeliver: 3,          // Best-effort
  ackWait: 30000,
})
export class InventoryAnalyticsSubscriber {
  async handle(message: any, context: any): Promise<void> {
    console.log(`[InventoryAnalytics] Analyzing order ${message.orderId}`);

    await analytics.trackInventoryDemand(message.items);

    console.log(`[InventoryAnalytics] Analyzed order ${message.orderId}`);
  }
}
// Consumer: inventory-service_production_order-service_order_created_InventoryAnalyticsSubscriber

// inventory-service/subscribers/inventory-audit-subscriber.ts
@topicSubscriber('order-service.order.created', {
  streamName: 'ORDERS',   // Subscribe from ORDERS stream
})
export class InventoryAuditSubscriber {
  async handle(message: any, context: any): Promise<void> {
    console.log(`[InventoryAudit] Auditing order ${message.orderId}`);

    await auditLog.record({
      event: 'order.created',
      orderId: message.orderId,
      items: message.items,
    });

    console.log(`[InventoryAudit] Audited order ${message.orderId}`);
  }
}
// Consumer: inventory-service_production_order-service_order_created_InventoryAuditSubscriber

// inventory-service/index.ts
import NatsPubsub from 'nats-pubsub';
import { InventoryReservationSubscriber } from './subscribers/inventory-reservation-subscriber';
import { InventoryAnalyticsSubscriber } from './subscribers/inventory-analytics-subscriber';
import { InventoryAuditSubscriber } from './subscribers/inventory-audit-subscriber';

NatsPubsub.registerSubscriber(new InventoryReservationSubscriber());
NatsPubsub.registerSubscriber(new InventoryAnalyticsSubscriber());
NatsPubsub.registerSubscriber(new InventoryAuditSubscriber());

await NatsPubsub.start();
console.log('Inventory service subscribers started');
```

---

## Execution Flow

### Scenario: Complete Order Flow Across Multiple Streams

**1. Order Service publishes order.created to ORDERS stream**:

```
Stream: ORDERS
Subject: production.order-service.order.created
Message: { orderId: 'ORD-123', customerId: 'CUST-456', items: [...], total: 99.99 }
```

**2. Multiple apps subscribe to ORDERS stream independently**:

```
┌─────────────────────────────────────────────────────────────────┐
│ Email Service (subscribing from ORDERS stream)                 │
├─────────────────────────────────────────────────────────────────┤
│ Consumer: email-service_..._EmailAnalyticsSubscriber           │
│   Status: ✓ Success (ACK) - Analytics tracked                 │
│   Next: DONE                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Inventory Service (subscribing from ORDERS stream)             │
├─────────────────────────────────────────────────────────────────┤
│ Consumer: inventory-service_..._InventoryReservationSubscriber │
│   Status: ✓ Success (ACK) - Items reserved                    │
│   Action: Publishes inventory.reserved to INVENTORY stream     │
│   Next: DONE                                                   │
├─────────────────────────────────────────────────────────────────┤
│ Consumer: inventory-service_..._InventoryAnalyticsSubscriber   │
│   Status: ✗ Failure (NAK) - Database connection timeout       │
│   Next: Retry after 5s                                         │
├─────────────────────────────────────────────────────────────────┤
│ Consumer: inventory-service_..._InventoryAuditSubscriber       │
│   Status: ✓ Success (ACK) - Audit logged                      │
│   Next: DONE                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**3. Inventory Service publishes inventory.reserved to INVENTORY stream**:

```
Stream: INVENTORY
Subject: production.inventory-service.inventory.reserved
Message: { orderId: 'ORD-123', reservationId: 'RES-789', success: true }
```

**4. Order Service subscribes to INVENTORY stream**:

```
┌─────────────────────────────────────────────────────────────────┐
│ Order Service (subscribing from INVENTORY stream)              │
├─────────────────────────────────────────────────────────────────┤
│ Consumer: order-service_..._InventoryReservedSubscriber        │
│   Status: ✓ Success (ACK) - Order updated                     │
│   Action: Publishes order.inventory_reserved to ORDERS stream  │
│   Next: DONE                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**5. Payment Service subscribes to ORDERS stream and processes payment**:

```
Stream: ORDERS
Subject: production.order-service.order.inventory_reserved

┌─────────────────────────────────────────────────────────────────┐
│ Payment Service (subscribing from ORDERS stream)               │
├─────────────────────────────────────────────────────────────────┤
│ Consumer: payment-service_..._PaymentProcessingSubscriber      │
│   Status: ✓ Success (ACK) - Payment processed                 │
│   Action: Publishes payment.processed to PAYMENTS stream       │
│   Next: DONE                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**6. Order Service receives payment confirmation from PAYMENTS stream**:

```
Stream: PAYMENTS
Subject: production.payment-service.payment.processed

┌─────────────────────────────────────────────────────────────────┐
│ Order Service (subscribing from PAYMENTS stream)               │
├─────────────────────────────────────────────────────────────────┤
│ Consumer: order-service_..._PaymentProcessedSubscriber         │
│   Status: ✓ Success (ACK) - Order confirmed                   │
│   Action: Publishes order.confirmed to ORDERS stream           │
│   Next: DONE                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**7. Email Service sends confirmation email**:

```
Stream: ORDERS
Subject: production.order-service.order.confirmed

┌─────────────────────────────────────────────────────────────────┐
│ Email Service (subscribing from ORDERS stream)                 │
├─────────────────────────────────────────────────────────────────┤
│ Consumer: email-service_..._EmailNotificationSubscriber        │
│   Status: ✓ Success (ACK) - Confirmation email sent           │
│   Action: Publishes email.sent to NOTIFICATIONS stream         │
│   Next: DONE                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points**:

- ✅ Each service publishes to its **own stream**
- ✅ Each service can subscribe to **multiple streams** from different services
- ✅ Failed subscribers (like InventoryAnalyticsSubscriber) retry **independently**
- ✅ Successful subscribers never reprocess messages
- ✅ Clear stream ownership and message flow across services

---

## Benefits

### 1. Stream Ownership and Isolation

✅ Each application owns its dedicated stream
✅ Clear boundaries and ownership per application
✅ Stream-level policies (retention, limits) per application
✅ Independent stream management and monitoring

### 2. True Multi-Stream Cross-Application Pub/Sub

✅ Applications can subscribe to multiple streams from different publishers
✅ Many-to-many messaging pattern supported
✅ No coupling between publisher and subscriber implementations
✅ Add new consumer applications without publisher changes
✅ Scales to N applications and N streams

### 3. Failure Isolation

✅ Failure in one stream doesn't affect other streams
✅ Failure in one app doesn't affect other apps
✅ Failure in one subscriber doesn't affect other subscribers
✅ Each subscriber has independent retry/DLQ logic
✅ No cascading failures across streams or services

### 4. Independent Progress Tracking

✅ Each application tracks its own delivery progress
✅ Each subscriber within an app tracks independently
✅ Granular monitoring per subscriber per app
✅ Clear visibility into which subscriber is struggling

### 4. Flexible Retry Policies

✅ Critical subscribers: more retries, longer timeouts
✅ Best-effort subscribers: fewer retries
✅ Per-subscriber backoff strategies
✅ Optimized resource usage

### 5. No Redundant Processing

✅ Successful subscribers never reprocess
✅ Only failed subscribers retry
✅ Reduced compute waste
✅ Lower infrastructure costs

---

## Resource Implications

### NATS Server

**Consumer Count**:

```
Formula: Σ(apps × subscribers_per_subject)

Example with order.created:
- App B: 2 subscribers
- App C: 3 subscribers
Total: 5 consumers for this subject
```

**Memory**: ~1-2 MB per consumer (minimal)

**Typical System**:

```
10 shared topics
5 consuming apps
3 subscribers per app on average
= 150 consumers total
= ~150-300 MB additional memory
```

### Application

**Per Application**:

- Threads/Goroutines: 1 per consumer (= number of subscribers)
- Memory: Minimal (message batches stay same size)
- Network: No increase (same messages, just independent delivery)

---

## Migration Strategy

### Phase 1: Enable on New Services

Deploy new services with both features enabled:

```typescript
NatsPubsub.configure({
  sharedTopics: true,
  independentAck: true,
});
```

### Phase 2: Migrate Existing Publishers

Update publishers to use shared namespace:

```typescript
// Before
NatsPubsub.configure({
  appName: 'order-service',
  // sharedTopics: false (default)
});

// After
NatsPubsub.configure({
  appName: 'order-service',
  sharedTopics: true,  // ← Enable
});
```

### Phase 3: Migrate Existing Subscribers

Update subscribers to use shared namespace and independent ACK:

```typescript
// Before
NatsPubsub.configure({
  appName: 'email-service',
  // sharedTopics: false (default)
  // independentAck: false (default)
});

// After
NatsPubsub.configure({
  appName: 'email-service',
  sharedTopics: true,       // ← Enable
  independentAck: true,      // ← Enable
});
```

### Phase 4: Cleanup

Remove old consumers:

```bash
# List old consumers
nats consumer ls STREAM_NAME

# Remove legacy consumers
nats consumer rm STREAM_NAME old-consumer-name
```

---

## Configuration Reference

### Full Configuration Options

**JavaScript**:

```typescript
interface NatsPubsubConfig {
  // Connection
  natsUrls: string | string[];
  
  // Identity
  env: string;
  appName: string;
  
  // Cross-app messaging (NEW)
  sharedTopics?: boolean;      // Use shared namespace (default: false)
  subjectPrefix?: string;      // Custom prefix (default: appName)
  
  // Independent acknowledgment (NEW)
  independentAck?: boolean;    // Per-subscriber consumers (default: false)
  
  // Consumer options
  concurrency?: number;
  maxDeliver?: number;
  ackWait?: number;
  backoff?: number[];
  
  // Features
  useOutbox?: boolean;
  useInbox?: boolean;
  useDlq?: boolean;
  
  // Advanced
  streamName?: string;
  dlqSubject?: string;
  perMessageConcurrency?: number;
  subscriberTimeoutMs?: number;
  dlqMaxAttempts?: number;
  logger?: Logger;
}
```

**Ruby**:

```ruby
NatsPubsub.configure do |config|
  # Connection
  config.nats_urls = 'nats://localhost:4222'
  
  # Identity
  config.env = 'production'
  config.app_name = 'my-service'
  
  # Cross-app messaging (NEW)
  config.shared_topics = false      # Use shared namespace
  config.subject_prefix = nil       # Custom prefix (default: app_name)
  
  # Independent acknowledgment (NEW)
  config.independent_ack = false    # Per-subscriber consumers
  
  # Consumer options
  config.concurrency = 10
  config.max_deliver = 5
  config.ack_wait = 30
  config.backoff = [1, 5, 15]
  
  # Features
  config.use_outbox = false
  config.use_inbox = false
  config.use_dlq = true
  
  # Advanced
  config.stream_name = 'EVENTS'
  config.dlq_subject = nil
  config.dlq_max_attempts = 5
end
```

---

## Monitoring

### Health Check Output

```json
{
  "stream": "production_events",
  "status": "healthy",
  "subjects": [
    {
      "subject": "production.events.order.created",
      "apps": [
        {
          "app": "email-service",
          "subscribers": [
            {
              "name": "EmailNotificationSubscriber",
              "consumer": "email-service_production_events_order_created_EmailNotificationSubscriber",
              "pending": 0,
              "delivered": 1500,
              "redelivered": 3,
              "status": "healthy"
            },
            {
              "name": "EmailAnalyticsSubscriber",
              "consumer": "email-service_production_events_order_created_EmailAnalyticsSubscriber",
              "pending": 10,
              "delivered": 1490,
              "redelivered": 45,
              "status": "degraded"
            }
          ]
        },
        {
          "app": "inventory-service",
          "subscribers": [
            {
              "name": "InventoryReservationSubscriber",
              "consumer": "inventory-service_production_events_order_created_InventoryReservationSubscriber",
              "pending": 0,
              "delivered": 1500,
              "redelivered": 5,
              "status": "healthy"
            },
            {
              "name": "InventoryAnalyticsSubscriber",
              "consumer": "inventory-service_production_events_order_created_InventoryAnalyticsSubscriber",
              "pending": 0,
              "delivered": 1500,
              "redelivered": 2,
              "status": "healthy"
            },
            {
              "name": "InventoryAuditSubscriber",
              "consumer": "inventory-service_production_events_order_created_InventoryAuditSubscriber",
              "pending": 0,
              "delivered": 1500,
              "redelivered": 0,
              "status": "healthy"
            }
          ]
        }
      ]
    }
  ]
}
```

### Prometheus Metrics

```
# Per-app, per-subscriber metrics
nats_consumer_messages_delivered{app="email-service", subscriber="EmailNotificationSubscriber"} 1500
nats_consumer_messages_pending{app="email-service", subscriber="EmailAnalyticsSubscriber"} 10
nats_consumer_redelivered{app="inventory-service", subscriber="InventoryReservationSubscriber"} 5
nats_consumer_lag_seconds{app="email-service", subscriber="EmailAnalyticsSubscriber"} 15.2
```

---

## Testing

### Integration Test: Full Flow

```typescript
describe('Multi-App Independent Acknowledgment', () => {
  it('allows multiple apps with multiple subscribers to process independently', async () => {
    // Setup publisher (App A)
    const publisher = new TestPublisher({
      env: 'test',
      appName: 'publisher-app',
      sharedTopics: true,
    });

    // Setup App B (2 subscribers)
    const appB_sub1 = new TestSubscriber('AppB_Sub1', {
      env: 'test',
      appName: 'app-b',
      sharedTopics: true,
      independentAck: true,
    });
    
    const appB_sub2 = new FailingTestSubscriber('AppB_Sub2', {
      env: 'test',
      appName: 'app-b',
      sharedTopics: true,
      independentAck: true,
    });

    // Setup App C (3 subscribers)
    const appC_sub1 = new TestSubscriber('AppC_Sub1', {
      env: 'test',
      appName: 'app-c',
      sharedTopics: true,
      independentAck: true,
    });
    
    const appC_sub2 = new TestSubscriber('AppC_Sub2', {
      env: 'test',
      appName: 'app-c',
      sharedTopics: true,
      independentAck: true,
    });
    
    const appC_sub3 = new TestSubscriber('AppC_Sub3', {
      env: 'test',
      appName: 'app-c',
      sharedTopics: true,
      independentAck: true,
    });

    // Start all subscribers
    await Promise.all([
      appB_sub1.start(),
      appB_sub2.start(),
      appC_sub1.start(),
      appC_sub2.start(),
      appC_sub3.start(),
    ]);

    // Publish message
    await publisher.publish('test.topic', { id: 1 });

    // Wait for processing
    await delay(2000);

    // Assertions
    // App B - Sub 1: Success
    expect(appB_sub1.receivedMessages).toHaveLength(1);
    expect(appB_sub1.processCount).toBe(1);

    // App B - Sub 2: Failing (retrying)
    expect(appB_sub2.processCount).toBeGreaterThan(1); // Multiple attempts
    expect(appB_sub2.errorCount).toBeGreaterThan(0);

    // App C - Sub 1: Success
    expect(appC_sub1.receivedMessages).toHaveLength(1);
    expect(appC_sub1.processCount).toBe(1);

    // App C - Sub 2: Success
    expect(appC_sub2.receivedMessages).toHaveLength(1);
    expect(appC_sub2.processCount).toBe(1);

    // App C - Sub 3: Success
    expect(appC_sub3.receivedMessages).toHaveLength(1);
    expect(appC_sub3.processCount).toBe(1);

    // Verify independent consumers
    const consumers = await getConsumers();
    expect(consumers).toHaveLength(5);
    expect(consumers.map(c => c.name)).toContain('app-b_test_events_test_topic_AppB_Sub1');
    expect(consumers.map(c => c.name)).toContain('app-b_test_events_test_topic_AppB_Sub2');
    expect(consumers.map(c => c.name)).toContain('app-c_test_events_test_topic_AppC_Sub1');
    expect(consumers.map(c => c.name)).toContain('app-c_test_events_test_topic_AppC_Sub2');
    expect(consumers.map(c => c.name)).toContain('app-c_test_events_test_topic_AppC_Sub3');
  });
});
```

---

## Conclusion

This comprehensive architecture enables:

✅ **Cross-Application Messaging**: Apps B and C consume from App A
✅ **Independent Acknowledgment**: Each subscriber processes independently
✅ **Failure Isolation**: Failures don't cascade
✅ **Flexible Policies**: Per-subscriber retry configuration
✅ **Scalability**: Add apps and subscribers without limits
✅ **Backward Compatible**: Opt-in via configuration flags

### Recommended Timeline

**Phase 1 (4 weeks)**: Implement `sharedTopics` configuration
**Phase 2 (6 weeks)**: Implement `independentAck` configuration
**Phase 3 (2 weeks)**: Integration testing
**Phase 4 (2 weeks)**: Documentation and examples
**Phase 5 (2 weeks)**: Beta release and feedback

**Total**: ~16 weeks to production-ready

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-18  
**Author**: GitHub Copilot  
**Status**: Comprehensive Proposal
