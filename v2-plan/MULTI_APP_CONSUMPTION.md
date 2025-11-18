# Multi-Application Stream Consumption Examples

This document provides practical examples of how applications consume from multiple streams in the NATS Pub/Sub architecture.

## Architecture Overview

In this architecture:

- **Each app publishes to its own dedicated stream**
- **Apps subscribe to topics from other apps' streams**
- **Each subscriber has independent acknowledgment**

## Stream Topology

```
┌─────────────────────┐
│   ORDERS Stream     │  ← Order Service owns this
│   (order-service)   │
└─────────────────────┘
         ↓ subscribes
    ┌────────────────────────┐
    │                        │
    ▼                        ▼
Email Service        Inventory Service
Payment Service      Analytics Service

┌─────────────────────┐
│  INVENTORY Stream   │  ← Inventory Service owns this
│ (inventory-service) │
└─────────────────────┘
         ↓ subscribes
    ┌────────────────┐
    │                │
    ▼                ▼
Order Service    Analytics Service

┌─────────────────────┐
│  PAYMENTS Stream    │  ← Payment Service owns this
│ (payment-service)   │
└─────────────────────┘
         ↓ subscribes
    ┌────────────────┐
    │                │
    ▼                ▼
Order Service    Analytics Service

┌─────────────────────┐
│ NOTIFICATIONS Stream│  ← Email Service owns this
│  (email-service)    │
└─────────────────────┘
         ↓ subscribes
         ▼
Analytics Service
```

## Example 1: Order Service (Multi-Stream Consumer)

Order Service **publishes** to the ORDERS stream and **subscribes** from INVENTORY and PAYMENTS streams.

### JavaScript/TypeScript

```typescript
// order-service/src/config.ts
import NatsPubsub from 'nats-pubsub';

NatsPubsub.configure({
  env: 'production',
  appName: 'order-service',
  streamName: 'ORDERS',           // Own stream for publishing
  independentAck: true,
});

// order-service/src/services/order-service.ts
import NatsPubsub from 'nats-pubsub';

export class OrderService {
  // Publishing to own ORDERS stream
  async createOrder(orderData: CreateOrderData): Promise<Order> {
    const order = await this.orderRepo.create(orderData);

    // Publishes to: production.order-service.order.created (ORDERS stream)
    await NatsPubsub.publish('order.created', {
      orderId: order.id,
      customerId: order.customerId,
      items: order.items,
      totalAmount: order.totalAmount,
    });

    return order;
  }

  async confirmOrder(orderId: string, transactionId: string): Promise<void> {
    await this.orderRepo.updateStatus(orderId, 'CONFIRMED');

    // Publishes to: production.order-service.order.confirmed (ORDERS stream)
    await NatsPubsub.publish('order.confirmed', {
      orderId,
      transactionId,
    });
  }
}

// order-service/src/subscribers/inventory-reserved-subscriber.ts
import { topicSubscriber } from 'nats-pubsub';

// Subscribe to inventory-service's INVENTORY stream
@topicSubscriber('inventory-service.inventory.reserved', {
  streamName: 'INVENTORY',        // Subscribing from INVENTORY stream
  maxDeliver: 5,
  ackWait: 30000,
})
export class InventoryReservedSubscriber {
  constructor(private orderService: OrderService) {}

  async handle(message: InventoryReservedEvent, context: MessageContext): Promise<void> {
    console.log(`[Order] Inventory reserved for order ${message.orderId}`);

    if (message.success) {
      // Update order status and publish next event to own ORDERS stream
      await this.orderService.updateInventoryReserved(message.orderId, message.reservationId);

      await NatsPubsub.publish('order.inventory_reserved', {
        orderId: message.orderId,
        reservationId: message.reservationId,
      });
    } else {
      await this.orderService.cancelOrder(message.orderId, 'Inventory reservation failed');
    }
  }
}

// order-service/src/subscribers/payment-processed-subscriber.ts
import { topicSubscriber } from 'nats-pubsub';

// Subscribe to payment-service's PAYMENTS stream
@topicSubscriber('payment-service.payment.processed', {
  streamName: 'PAYMENTS',         // Subscribing from PAYMENTS stream
  maxDeliver: 5,
  ackWait: 30000,
})
export class PaymentProcessedSubscriber {
  constructor(private orderService: OrderService) {}

  async handle(message: PaymentProcessedEvent, context: MessageContext): Promise<void> {
    console.log(`[Order] Payment processed for order ${message.orderId}`);

    if (message.success) {
      // Confirm order and publish to own ORDERS stream
      await this.orderService.confirmOrder(message.orderId, message.transactionId);
    } else {
      await this.orderService.cancelOrder(message.orderId, 'Payment failed');
    }
  }
}

// order-service/src/index.ts
import NatsPubsub from 'nats-pubsub';
import { InventoryReservedSubscriber } from './subscribers/inventory-reserved-subscriber';
import { PaymentProcessedSubscriber } from './subscribers/payment-processed-subscriber';
import { OrderService } from './services/order-service';

async function main() {
  const orderService = new OrderService();

  // Register subscribers (subscribing from other apps' streams)
  NatsPubsub.registerSubscriber(new InventoryReservedSubscriber(orderService));
  NatsPubsub.registerSubscriber(new PaymentProcessedSubscriber(orderService));

  await NatsPubsub.start();
  console.log('Order Service started - subscribing from INVENTORY and PAYMENTS streams');
}

main();
```

### Ruby

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
    order = Order.create!(order_data)

    # Publish to own ORDERS stream
    NatsPubsub.publish('order.created',
      order_id: order.id,
      customer_id: order.customer_id,
      items: order.items,
      total_amount: order.total_amount
    )

    order
  end

  def confirm_order(order_id, transaction_id)
    order = Order.find(order_id)
    order.update!(status: 'CONFIRMED')

    NatsPubsub.publish('order.confirmed',
      order_id: order_id,
      transaction_id: transaction_id
    )
  end
end

# order-service/app/subscribers/inventory_reserved_subscriber.rb
class InventoryReservedSubscriber < NatsPubsub::Subscriber
  subscribe_to 'inventory.reserved',
    publisher_app: 'inventory-service',
    publisher_stream: 'INVENTORY'

  jetstream_options(max_deliver: 5, ack_wait: 30)

  def handle(message, context)
    puts "[Order] Inventory reserved for order #{message['order_id']}"

    if message['success']
      order_service.update_inventory_reserved(message['order_id'], message['reservation_id'])

      NatsPubsub.publish('order.inventory_reserved',
        order_id: message['order_id'],
        reservation_id: message['reservation_id']
      )
    else
      order_service.cancel_order(message['order_id'], 'Inventory reservation failed')
    end
  end
end

# order-service/app/subscribers/payment_processed_subscriber.rb
class PaymentProcessedSubscriber < NatsPubsub::Subscriber
  subscribe_to 'payment.processed',
    publisher_app: 'payment-service',
    publisher_stream: 'PAYMENTS'

  jetstream_options(max_deliver: 5, ack_wait: 30)

  def handle(message, context)
    puts "[Order] Payment processed for order #{message['order_id']}"

    if message['success']
      order_service.confirm_order(message['order_id'], message['transaction_id'])
    else
      order_service.cancel_order(message['order_id'], 'Payment failed')
    end
  end
end
```

## Example 2: Analytics Service (Multi-Stream Consumer)

Analytics Service subscribes to **multiple streams** from different services to aggregate analytics data.

### JavaScript/TypeScript

```typescript
// analytics-service/src/config.ts
import NatsPubsub from 'nats-pubsub';

NatsPubsub.configure({
  env: 'production',
  appName: 'analytics-service',
  streamName: 'ANALYTICS',        // Own stream for publishing analytics results
  independentAck: true,
});

// analytics-service/src/subscribers/order-analytics-subscriber.ts
import { topicSubscriber } from 'nats-pubsub';

// Subscribe to ORDERS stream
@topicSubscriber('order-service.order.created', {
  streamName: 'ORDERS',
  maxDeliver: 3,
  ackWait: 60000,
})
export class OrderAnalyticsSubscriber {
  async handle(message: OrderCreatedEvent, context: MessageContext): Promise<void> {
    console.log(`[Analytics] Processing order ${message.orderId}`);

    await analytics.track('order_created', {
      orderId: message.orderId,
      totalAmount: message.totalAmount,
      itemCount: message.items.length,
      timestamp: new Date(),
    });
  }
}

// analytics-service/src/subscribers/inventory-analytics-subscriber.ts
// Subscribe to INVENTORY stream
@topicSubscriber('inventory-service.inventory.reserved', {
  streamName: 'INVENTORY',
  maxDeliver: 3,
  ackWait: 60000,
})
export class InventoryAnalyticsSubscriber {
  async handle(message: InventoryReservedEvent, context: MessageContext): Promise<void> {
    console.log(`[Analytics] Processing inventory reservation ${message.reservationId}`);

    await analytics.track('inventory_reserved', {
      orderId: message.orderId,
      reservationId: message.reservationId,
      success: message.success,
      timestamp: new Date(),
    });
  }
}

// analytics-service/src/subscribers/payment-analytics-subscriber.ts
// Subscribe to PAYMENTS stream
@topicSubscriber('payment-service.payment.processed', {
  streamName: 'PAYMENTS',
  maxDeliver: 3,
  ackWait: 60000,
})
export class PaymentAnalyticsSubscriber {
  async handle(message: PaymentProcessedEvent, context: MessageContext): Promise<void> {
    console.log(`[Analytics] Processing payment ${message.transactionId}`);

    await analytics.track('payment_processed', {
      orderId: message.orderId,
      transactionId: message.transactionId,
      amount: message.amount,
      success: message.success,
      timestamp: new Date(),
    });
  }
}

// analytics-service/src/subscribers/email-analytics-subscriber.ts
// Subscribe to NOTIFICATIONS stream
@topicSubscriber('email-service.email.sent', {
  streamName: 'NOTIFICATIONS',
  maxDeliver: 3,
  ackWait: 60000,
})
export class EmailAnalyticsSubscriber {
  async handle(message: EmailSentEvent, context: MessageContext): Promise<void> {
    console.log(`[Analytics] Processing email event for order ${message.orderId}`);

    await analytics.track('email_sent', {
      orderId: message.orderId,
      emailType: message.emailType,
      timestamp: new Date(),
    });
  }
}

// analytics-service/src/index.ts
import NatsPubsub from 'nats-pubsub';
import { OrderAnalyticsSubscriber } from './subscribers/order-analytics-subscriber';
import { InventoryAnalyticsSubscriber } from './subscribers/inventory-analytics-subscriber';
import { PaymentAnalyticsSubscriber } from './subscribers/payment-analytics-subscriber';
import { EmailAnalyticsSubscriber } from './subscribers/email-analytics-subscriber';

async function main() {
  // Register subscribers from multiple streams
  NatsPubsub.registerSubscriber(new OrderAnalyticsSubscriber());
  NatsPubsub.registerSubscriber(new InventoryAnalyticsSubscriber());
  NatsPubsub.registerSubscriber(new PaymentAnalyticsSubscriber());
  NatsPubsub.registerSubscriber(new EmailAnalyticsSubscriber());

  await NatsPubsub.start();
  console.log('Analytics Service started - subscribing from 4 different streams');
}

main();
```

### Ruby

```ruby
# analytics-service/config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.env = 'production'
  config.app_name = 'analytics-service'
  config.stream_name = 'ANALYTICS'
  config.independent_ack = true
end

# analytics-service/app/subscribers/order_analytics_subscriber.rb
class OrderAnalyticsSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.created',
    publisher_app: 'order-service',
    publisher_stream: 'ORDERS'

  jetstream_options(max_deliver: 3, ack_wait: 60)

  def handle(message, context)
    puts "[Analytics] Processing order #{message['order_id']}"

    Analytics.track('order_created',
      order_id: message['order_id'],
      total_amount: message['total_amount'],
      item_count: message['items'].length,
      timestamp: Time.now
    )
  end
end

# analytics-service/app/subscribers/inventory_analytics_subscriber.rb
class InventoryAnalyticsSubscriber < NatsPubsub::Subscriber
  subscribe_to 'inventory.reserved',
    publisher_app: 'inventory-service',
    publisher_stream: 'INVENTORY'

  jetstream_options(max_deliver: 3, ack_wait: 60)

  def handle(message, context)
    puts "[Analytics] Processing inventory reservation #{message['reservation_id']}"

    Analytics.track('inventory_reserved',
      order_id: message['order_id'],
      reservation_id: message['reservation_id'],
      success: message['success'],
      timestamp: Time.now
    )
  end
end

# analytics-service/app/subscribers/payment_analytics_subscriber.rb
class PaymentAnalyticsSubscriber < NatsPubsub::Subscriber
  subscribe_to 'payment.processed',
    publisher_app: 'payment-service',
    publisher_stream: 'PAYMENTS'

  jetstream_options(max_deliver: 3, ack_wait: 60)

  def handle(message, context)
    puts "[Analytics] Processing payment #{message['transaction_id']}"

    Analytics.track('payment_processed',
      order_id: message['order_id'],
      transaction_id: message['transaction_id'],
      amount: message['amount'],
      success: message['success'],
      timestamp: Time.now
    )
  end
end

# analytics-service/app/subscribers/email_analytics_subscriber.rb
class EmailAnalyticsSubscriber < NatsPubsub::Subscriber
  subscribe_to 'email.sent',
    publisher_app: 'email-service',
    publisher_stream: 'NOTIFICATIONS'

  jetstream_options(max_deliver: 3, ack_wait: 60)

  def handle(message, context)
    puts "[Analytics] Processing email event for order #{message['order_id']}"

    Analytics.track('email_sent',
      order_id: message['order_id'],
      email_type: message['email_type'],
      timestamp: Time.now
    )
  end
end
```

## Stream Configuration Matrix

| Service           | Publishes To      | Subscribes From                     |
|-------------------|-------------------|-------------------------------------|
| Order Service     | ORDERS            | INVENTORY, PAYMENTS                 |
| Inventory Service | INVENTORY         | ORDERS                              |
| Payment Service   | PAYMENTS          | ORDERS                              |
| Email Service     | NOTIFICATIONS     | ORDERS                              |
| Analytics Service | ANALYTICS         | ORDERS, INVENTORY, PAYMENTS, NOTIFICATIONS |

## Consumer Naming Examples

With the multi-stream architecture, consumer names clearly indicate which app is subscribing to which publisher's stream:

```
# Analytics Service subscribing to different streams:
analytics-service_production_order-service_order_created_OrderAnalyticsSubscriber
analytics-service_production_inventory-service_inventory_reserved_InventoryAnalyticsSubscriber
analytics-service_production_payment-service_payment_processed_PaymentAnalyticsSubscriber
analytics-service_production_email-service_email_sent_EmailAnalyticsSubscriber

# Order Service subscribing to different streams:
order-service_production_inventory-service_inventory_reserved_InventoryReservedSubscriber
order-service_production_payment-service_payment_processed_PaymentProcessedSubscriber

# Email Service subscribing to ORDERS stream:
email-service_production_order-service_order_created_EmailAnalyticsSubscriber
email-service_production_order-service_order_confirmed_EmailNotificationSubscriber
```

## Key Benefits

1. **Clear Stream Ownership**: Each service owns and manages its stream
2. **Multi-Stream Consumption**: Services can subscribe to any number of streams
3. **Independent Scaling**: Scale consumers independently per stream
4. **Failure Isolation**: Failures in one stream don't affect others
5. **Independent Acknowledgment**: Each subscriber ACKs independently
6. **Flexible Architecture**: Easy to add new publishers or consumers

## Next Steps

To implement this architecture:

1. Configure each service with its own `streamName`
2. Use `streamName` option when subscribing to specify which stream to consume from
3. Register all subscribers before calling `NatsPubsub.start()`
4. Monitor consumer lag per stream and per subscriber
