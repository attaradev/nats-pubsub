# Topic Naming and Patterns Guide

Comprehensive guide to designing effective topic hierarchies, naming conventions, and wildcard patterns for NatsPubsub applications.

## Table of Contents

- [Overview](#overview)
- [Topic Structure](#topic-structure)
- [Naming Conventions](#naming-conventions)
- [Hierarchical Patterns](#hierarchical-patterns)
- [Wildcard Usage](#wildcard-usage)
- [Versioning Strategies](#versioning-strategies)
- [Best Practices](#best-practices)
- [Anti-Patterns](#anti-patterns)
- [Examples](#examples)
- [Related Resources](#related-resources)

---

## Overview

Topics (also called subjects in NATS) are the foundation of message routing in NatsPubsub. Well-designed topics make your system:

- **Flexible**: Easy to add new consumers
- **Scalable**: Efficient message routing
- **Maintainable**: Clear organization and intent
- **Observable**: Easy to monitor and debug

### Topic Basics

In NatsPubsub, topics are automatically prefixed with environment and app name:

```
{env}.{appName}.{topic}
```

**Example**:

```typescript
// You publish to:
NatsPubsub.publish("order.created", orderData);

// NATS receives:
("production.order-service.order.created");
```

---

## Topic Structure

### Recommended Structure

Use dot notation with hierarchical levels:

```
resource.action
domain.resource.action
service.domain.resource.action
```

### Examples by Complexity

#### Simple (2 levels)

```
order.created
order.updated
order.cancelled

user.registered
user.updated
user.deleted
```

#### Medium (3 levels)

```
ecommerce.order.created
ecommerce.order.shipped
ecommerce.payment.completed

auth.user.registered
auth.user.verified
auth.session.created
```

#### Complex (4+ levels)

```
platform.ecommerce.order.payment.completed
platform.ecommerce.inventory.item.reserved
platform.notification.email.sent
platform.notification.sms.delivered
```

### Level Guidelines

| Levels | Use Case                         | Example                            |
| ------ | -------------------------------- | ---------------------------------- |
| 2      | Single service, simple domain    | `order.created`                    |
| 3      | Multiple services, clear domains | `ecommerce.order.created`          |
| 4+     | Large microservices architecture | `platform.ecommerce.order.created` |

---

## Naming Conventions

### General Rules

1. **Use lowercase**: `order.created` not `Order.Created`
2. **Use dots for hierarchy**: `order.payment.completed`
3. **Use past tense for events**: `created`, `updated`, `completed`
4. **Use present tense for commands**: `create`, `update`, `process`
5. **Be consistent**: Pick a convention and stick to it

### Resource Naming

```typescript
// Good: Singular nouns
"order.created";
"user.registered";
"payment.completed";

// Bad: Plural or mixed
"orders.created";
"user.registration";
"payments.complete";
```

### Action Naming

```typescript
// Good: Clear, consistent actions
"order.created"; // New order
"order.updated"; // Order modified
"order.cancelled"; // Order cancelled
"order.shipped"; // Order shipped
"order.delivered"; // Order delivered

// Bad: Unclear or inconsistent
"order.new";
"order.change";
"order.cancel";
"order.ship";
```

### Context-Specific Naming

```typescript
// E-commerce
"order.created";
"order.payment.authorized";
"order.payment.captured";
"order.fulfillment.started";
"order.fulfillment.completed";

// Authentication
"user.registered";
"user.email.verified";
"user.password.reset";
"session.created";
"session.expired";

// Notifications
"notification.email.queued";
"notification.email.sent";
"notification.email.delivered";
"notification.email.bounced";
```

---

## Hierarchical Patterns

### By Domain

```
// Organize by business domain
ecommerce.order.created
ecommerce.product.updated
ecommerce.inventory.reserved

payments.transaction.completed
payments.refund.processed
payments.dispute.opened

notifications.email.sent
notifications.sms.sent
notifications.push.sent
```

### By Service

```
// Organize by service ownership
order-service.order.created
order-service.order.updated

inventory-service.stock.reserved
inventory-service.stock.released

notification-service.email.sent
notification-service.sms.sent
```

### By Event Type

```
// Organize by event characteristics
events.lifecycle.order.created
events.lifecycle.order.completed

events.integration.payment.received
events.integration.shipment.tracking

events.analytics.user.action
events.analytics.conversion.completed
```

---

## Wildcard Usage

NATS supports two wildcards:

- `*` - Matches exactly one token
- `>` - Matches one or more tokens

### Single-Level Wildcard (\*)

```typescript
// Subscribe to all order events
"production.order-service.order.*";

// Matches:
// - order.created
// - order.updated
// - order.cancelled

// Does NOT match:
// - order.payment.completed (too many levels)
// - user.created (different resource)
```

#### JavaScript Example

```typescript
class OrderEventsSubscriber extends Subscriber {
  constructor() {
    super("production.order-service.order.*"); // Wildcard
  }

  async handle(message: any, metadata: TopicMetadata) {
    const action = metadata.topic.split(".").pop();

    switch (action) {
      case "created":
        await this.handleOrderCreated(message);
        break;
      case "updated":
        await this.handleOrderUpdated(message);
        break;
      case "cancelled":
        await this.handleOrderCancelled(message);
        break;
    }
  }
}
```

#### Ruby Example

```ruby
class OrderEventsSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.*'

  def handle(message, context)
    action = context.topic.split('.').last

    case action
    when 'created'
      handle_order_created(message)
    when 'updated'
      handle_order_updated(message)
    when 'cancelled'
      handle_order_cancelled(message)
    end
  end
end
```

### Multi-Level Wildcard (>)

```typescript
// Subscribe to ALL events from order-service
"production.order-service.>";

// Matches:
// - order.created
// - order.updated
// - order.payment.completed
// - order.fulfillment.shipped
// - user.created (if published by order-service)
```

#### Use Cases

```typescript
// 1. Audit logging (capture everything)
class AuditSubscriber extends Subscriber {
  constructor() {
    super("production.*.>"); // All events from all services
  }

  async handle(message: any, metadata: TopicMetadata) {
    await AuditLog.create({
      topic: metadata.topic,
      data: message,
      timestamp: new Date(),
    });
  }
}

// 2. Analytics (specific domain, all events)
class EcommerceAnalyticsSubscriber extends Subscriber {
  constructor() {
    super("production.order-service.ecommerce.>");
  }

  async handle(message: any, metadata: TopicMetadata) {
    await Analytics.track(metadata.topic, message);
  }
}

// 3. Cross-service monitoring
class MonitoringSubscriber extends Subscriber {
  constructor() {
    super("production.*.order.>"); // All order events across services
  }

  async handle(message: any, metadata: TopicMetadata) {
    await updateMetrics(metadata.topic, message);
  }
}
```

### Wildcard Best Practices

```typescript
// Good: Specific wildcards
"order.*"; // Only order actions
"ecommerce.*.created"; // Only created events in ecommerce
"notification.email.>"; // All email notification events

// Bad: Too broad
"*"; // Matches everything (don't do this)
"*.>"; // Also matches everything
"production.*.*.>"; // Too generic, hard to debug
```

---

## Versioning Strategies

### Strategy 1: Version in Topic Name

```typescript
// V1
"order.v1.created";
"order.v1.updated";

// V2 (breaking changes)
"order.v2.created";
"order.v2.updated";

// Subscribers choose version
class OrderV1Subscriber extends Subscriber {
  constructor() {
    super("production.order-service.order.v1.*");
  }
}

class OrderV2Subscriber extends Subscriber {
  constructor() {
    super("production.order-service.order.v2.*");
  }
}
```

### Strategy 2: Version in Metadata

```typescript
// Publishing
await NatsPubsub.publish("order.created", orderData, {
  version: "2.0",
  schema_version: "v2",
});

// Subscribing
class OrderSubscriber extends Subscriber {
  async handle(message: any, metadata: TopicMetadata) {
    const version = metadata.version || "1.0";

    if (version === "1.0") {
      await this.handleV1(message);
    } else if (version === "2.0") {
      await this.handleV2(message);
    }
  }
}
```

### Strategy 3: Separate Streams

```typescript
// V1 stream: order-events-v1
NatsPubsub.publish("v1.order.created", orderData);

// V2 stream: order-events-v2
NatsPubsub.publish("v2.order.created", orderData);

// Consumers subscribe to appropriate stream
```

### Recommendation

For most cases, use **Strategy 2 (metadata)** because:

- Clean topic names
- Flexible version handling
- Easy migration path
- No topic explosion

---

## Best Practices

### 1. Keep Topics Short but Descriptive

```typescript
// Good
"order.created";
"payment.completed";
"user.registered";

// Bad
"order-created-in-system";
"payment-processing-completed-successfully";
"new-user-registration-event";
```

### 2. Use Consistent Verb Tenses

```typescript
// Good: All past tense
"order.created";
"order.updated";
"order.shipped";

// Bad: Mixed tenses
"order.create";
"order.updated";
"order.shipping";
```

### 3. Avoid Deep Nesting

```typescript
// Good: 3-4 levels max
"ecommerce.order.payment.completed";

// Bad: Too deep
"platform.region.service.domain.resource.action.status";
```

### 4. Make Topics Self-Documenting

```typescript
// Good: Clear intent
"order.payment.authorized";
"order.payment.captured";
"order.payment.failed";

// Bad: Unclear
"order.payment.state1";
"order.payment.state2";
"order.payment.state3";
```

### 5. Plan for Wildcards

```typescript
// Good: Wildcard-friendly structure
"notification.email.sent";
"notification.email.delivered";
"notification.email.bounced";
// Subscribe with: 'notification.email.*'

// Bad: Inconsistent structure
"notification.sent.email";
"email.delivered";
"notification.bounced";
// Can't use wildcards effectively
```

---

## Anti-Patterns

### 1. Using Dots in Action Names

```typescript
// Bad
"order.status.updated"; // Looks like 3 levels but is 2

// Good
"order.status_updated"; // Clear 2 levels
"order.status-updated"; // Clear 2 levels
```

### 2. Mixing Domains

```typescript
// Bad: Mixed concerns in one topic
"order-and-payment.completed";

// Good: Separate topics
"order.completed";
"payment.completed";
```

### 3. Using Dynamic Values in Topics

```typescript
// Bad: Topic includes data
await NatsPubsub.publish(`order.${orderId}.created`, data);

// Good: Data in message body
await NatsPubsub.publish("order.created", {
  order_id: orderId,
  ...data,
});
```

### 4. Too Many Levels

```typescript
// Bad: 6+ levels
"platform.region.us-east.service.ecommerce.order.payment.credit-card.completed";

// Good: 4 levels max
"ecommerce.order.payment.completed";
```

### 5. Inconsistent Naming

```typescript
// Bad: Inconsistent across service
"order.created";
"order-updated";
"orderCancelled";

// Good: Consistent
"order.created";
"order.updated";
"order.cancelled";
```

---

## Examples

### E-Commerce System

```typescript
// Orders
"order.created";
"order.updated";
"order.cancelled";
"order.payment.pending";
"order.payment.completed";
"order.payment.failed";
"order.fulfillment.picking";
"order.fulfillment.packed";
"order.fulfillment.shipped";
"order.delivered";

// Products
"product.created";
"product.updated";
"product.deleted";
"product.price.changed";
"product.inventory.low";
"product.inventory.out";

// Customers
"customer.registered";
"customer.updated";
"customer.order.placed";
"customer.subscription.created";
"customer.subscription.cancelled";
```

### SaaS Platform

```typescript
// Users
"user.registered";
"user.email.verified";
"user.profile.updated";
"user.subscription.upgraded";
"user.subscription.downgraded";
"user.subscription.cancelled";

// Organizations
"org.created";
"org.member.added";
"org.member.removed";
"org.billing.payment.succeeded";
"org.billing.payment.failed";
"org.usage.limit.reached";

// Features
"feature.flag.updated";
"feature.access.granted";
"feature.access.revoked";
```

### Multi-Service Architecture

```typescript
// Service A: Order Service
"order-service.order.created";
"order-service.order.updated";

// Service B: Payment Service
"payment-service.payment.authorized";
"payment-service.payment.captured";

// Service C: Notification Service
"notification-service.email.sent";
"notification-service.sms.sent";

// Cross-service subscriber
class OrderPaymentSyncSubscriber extends Subscriber {
  constructor() {
    // Listen to payment events
    super("production.payment-service.payment.*");
  }

  async handle(message: any, metadata: TopicMetadata) {
    // Update order based on payment events
    await syncOrderPaymentStatus(message);
  }
}
```

---

## Related Resources

- [Publishing Guide](./publishing.md) - How to publish messages
- [Subscribing Guide](./subscribing.md) - How to subscribe to topics
- [JavaScript API](../reference/javascript-api.md) - API reference
- [Ruby API](../reference/ruby-api.md) - API reference

---

**Navigation:**

- [Previous: Middleware System](./middleware.md)
- [Next: Testing Strategies](./testing.md)
- [Documentation Home](../index.md)
