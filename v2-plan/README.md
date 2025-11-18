# NATS Pub/Sub v2 Architecture Plan

This directory contains the architecture plans and design documents for the v2 iteration of the NATS Pub/Sub library.

## Overview

The v2 architecture introduces a **multi-stream, multi-application consumption pattern** with **independent subscriber acknowledgment**. This enables true event-driven microservices architecture where:

- Each application owns and publishes to its **own dedicated stream**
- Applications can **subscribe to multiple streams** from different publishers
- Each **subscriber has independent acknowledgment**, preventing cascading failures
- Complete **isolation between streams, applications, and subscribers**

## Architecture Documents

### 1. [COMPREHENSIVE_MULTI_APP_ARCHITECTURE.md](./COMPREHENSIVE_MULTI_APP_ARCHITECTURE.md)

**The complete architecture specification** covering:

- Executive summary and use cases
- Problem analysis with current architecture limitations
- Proposed multi-stream architecture
- Stream ownership and isolation model
- Independent acknowledgment per subscriber
- Implementation design (configuration, subject building, consumer creation)
- Complete code examples (JavaScript/TypeScript and Ruby)
- Execution flow across multiple streams
- Benefits, resource implications, and migration strategy
- Monitoring and testing approaches

**Read this first** for a comprehensive understanding of the v2 architecture.

### 2. [MULTI_APP_CONSUMPTION.md](./MULTI_APP_CONSUMPTION.md)

**Practical implementation examples** showing:

- Stream topology diagrams
- Example 1: Order Service consuming from multiple streams (INVENTORY, PAYMENTS)
- Example 2: Analytics Service consuming from 4+ different streams
- Stream configuration matrix
- Consumer naming conventions
- Real-world code examples in TypeScript and Ruby

**Read this** for hands-on implementation patterns and code examples.

## Key Concepts

### Stream Ownership

```
Order Service     → ORDERS stream
Inventory Service → INVENTORY stream
Payment Service   → PAYMENTS stream
Email Service     → NOTIFICATIONS stream
Analytics Service → ANALYTICS stream
```

Each service **owns** its stream and publishes domain events to it.

### Multi-Stream Consumption

```
Order Service:
  Publishes to:     ORDERS
  Subscribes from:  PAYMENTS, INVENTORY

Analytics Service:
  Publishes to:     ANALYTICS
  Subscribes from:  ORDERS, INVENTORY, PAYMENTS, NOTIFICATIONS
```

Services can subscribe to **any number of streams** from other services.

### Independent Acknowledgment

Each subscriber gets its **own consumer** and acknowledges messages independently:

```
Email Service subscribing to ORDERS stream:
  ✓ EmailNotificationSubscriber    → Independent consumer
  ✓ EmailAnalyticsSubscriber        → Independent consumer

If EmailAnalyticsSubscriber fails:
  ✗ EmailAnalyticsSubscriber retries independently
  ✓ EmailNotificationSubscriber continues unaffected
```

## Architecture Principles

1. **Stream Per Application**: Each app owns its dedicated stream
2. **App-Specific Subject Namespace**: `{env}.{appName}.{topic}`
3. **Cross-Stream Subscription**: Apps subscribe to topics from other apps' streams
4. **Subscriber-Specific Consumers**: Each subscriber gets its own consumer
5. **Independent Acknowledgment**: Each consumer ACKs independently
6. **Many-to-Many Pattern**: Any app can subscribe to any other app's stream

## Configuration Example

### JavaScript/TypeScript

```typescript
// Order Service configuration
NatsPubsub.configure({
  env: 'production',
  appName: 'order-service',
  streamName: 'ORDERS',           // Own stream for publishing
  independentAck: true,           // Enable independent acknowledgment
});

// Subscribe to another app's stream
@topicSubscriber('payment-service.payment.processed', {
  streamName: 'PAYMENTS',         // Subscribe from PAYMENTS stream
  maxDeliver: 5,
  ackWait: 30000,
})
export class PaymentProcessedSubscriber {
  async handle(message: any, context: any): Promise<void> {
    // Handle payment event from payment-service's PAYMENTS stream
  }
}
```

### Ruby

```ruby
# Order Service configuration
NatsPubsub.configure do |config|
  config.env = 'production'
  config.app_name = 'order-service'
  config.stream_name = 'ORDERS'
  config.independent_ack = true
end

# Subscribe to another app's stream
class PaymentProcessedSubscriber < NatsPubsub::Subscriber
  subscribe_to 'payment.processed',
    publisher_app: 'payment-service',
    publisher_stream: 'PAYMENTS'

  def handle(message, context)
    # Handle payment event
  end
end
```

## Benefits

### 1. Stream Ownership and Isolation
- Clear boundaries per application
- Stream-level policies (retention, limits) per app
- Independent stream management

### 2. Multi-Stream Cross-Application Pub/Sub
- Subscribe to multiple streams from different publishers
- Many-to-many messaging pattern
- No coupling between implementations

### 3. Failure Isolation
- Failures don't cascade across streams or services
- Each subscriber has independent retry/DLQ logic
- Stream failures are isolated

### 4. Independent Progress Tracking
- Granular monitoring per subscriber per app
- Clear visibility into which subscriber is struggling
- Independent acknowledgment prevents redundant processing

### 5. Flexible Retry Policies
- Per-subscriber retry configuration
- Critical subscribers: more retries, longer timeouts
- Best-effort subscribers: fewer retries

## Implementation Status

This is a **planning document** for v2. The current implementation (v1) uses:
- Single shared stream per environment
- App-scoped subjects: `{env}.{appName}.{topic}`
- Shared acknowledgment per subject

The v2 architecture proposes:
- **Multiple streams** per environment (one per app)
- App-scoped subjects (unchanged)
- **Independent acknowledgment** per subscriber

## Migration Path

1. **Phase 1**: Enable stream-per-app configuration (backwards compatible)
2. **Phase 2**: Implement independent acknowledgment per subscriber
3. **Phase 3**: Update existing services to use new configuration
4. **Phase 4**: Clean up legacy consumers

## Next Steps

1. Review the architecture documents
2. Validate the design with stakeholders
3. Create implementation tickets
4. Prototype the multi-stream topology manager
5. Implement independent acknowledgment
6. Create migration tooling
7. Update documentation

## Questions or Feedback?

For questions about this architecture or feedback on the design:
- Open an issue in the repository
- Discuss in team meetings
- Review the detailed documents in this directory

---

**Document Version**: 1.0
**Last Updated**: 2025-11-18
**Status**: Architecture Proposal
