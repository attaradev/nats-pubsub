# NatsPubsub Examples

Welcome to the NatsPubsub examples directory! This collection showcases real-world usage patterns, best practices, and complete working applications.

## Overview

| Example                          | Description                                  | Technologies                      | Complexity            |
| -------------------------------- | -------------------------------------------- | --------------------------------- | --------------------- |
| [Microservices](./microservices) | Multi-service architecture with saga pattern | Node.js, Ruby, PostgreSQL, Docker | Advanced              |
| [JavaScript](./javascript)       | JavaScript/TypeScript patterns and examples  | Node.js, TypeScript               | Beginner-Intermediate |
| [Ruby](./ruby)                   | Ruby-specific patterns and Rails integration | Ruby, Rails, Sinatra              | Beginner-Intermediate |
| [Full-Stack](./full-stack)       | Complete web application (Coming Soon)       | React, Express, WebSockets        | Advanced              |

## Quick Start

### Microservices Example (Recommended)

The most comprehensive example demonstrating production-ready patterns:

```bash
cd microservices
docker-compose up -d

# Wait for services to be healthy
docker-compose ps

# Create a test order
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "items": [
      {
        "productId": "prod-001",
        "productName": "Laptop",
        "quantity": 1,
        "price": 999.99
      }
    ]
  }'
```

See [Microservices README](./microservices/README.md) for detailed instructions.

## Examples by Language

### JavaScript/TypeScript

- [Basic Publisher/Subscriber](./javascript/README.md#basic-usage)
- [Topic-Based Patterns](./javascript/README.md#topic-based-subscription)
- [Type-Safe Messages](./javascript/README.md#type-safe-messages)
- [Error Handling](./javascript/README.md#error-handling)
- [Batch Publishing](./javascript/README.md#batch-publishing)
- [Schema Validation](./javascript/README.md#schema-validation)
- [Outbox Pattern](./javascript/README.md#outbox-pattern)
- [Inbox Pattern](./javascript/README.md#inbox-pattern)
- [Circuit Breaker](./javascript/README.md#circuit-breaker)
- [Testing](./javascript/README.md#testing)

### Ruby

- [Basic Publisher/Subscriber](./ruby/README.md#basic-usage)
- [Topic-Based Patterns](./ruby/README.md#topic-based-subscription)
- [Error Handling](./ruby/README.md#error-handling)
- [Batch Publishing](./ruby/README.md#batch-publishing)
- [ActiveRecord Integration](./ruby/README.md#activerecord-integration)
- [Rails Integration](./ruby/README.md#rails-integration)
- [Testing](./ruby/README.md#testing)
- [Generators](./ruby/README.md#generators)
- [Web UI](./ruby/README.md#web-ui)

## Examples by Pattern

### Event-Driven Architecture

The [Microservices Example](./microservices) demonstrates:

- Event sourcing
- Saga pattern
- Choreography-based workflows
- Event-driven communication between services

### Reliability Patterns

Examples showcase:

- **At-least-once delivery** with JetStream
- **Automatic retries** with exponential backoff
- **Dead Letter Queue** for failed messages
- **Idempotency** via inbox pattern
- **Transactional outbox** for reliable publishing
- **Circuit breakers** for external dependencies

### Scalability Patterns

Learn how to:

- Scale horizontally with multiple consumers
- Implement competing consumers
- Use batch operations
- Optimize message throughput
- Handle backpressure

## Use Case Examples

### 1. E-commerce Order Processing

The [Microservices Example](./microservices) shows a complete order fulfillment workflow:

```
Order → Inventory Check → Payment → Confirmation → Email
```

Services involved:

- Order Service: Orchestrates the workflow
- Inventory Service: Manages stock
- Email Service: Sends notifications

### 2. Real-Time Notifications

Subscribe to events and push notifications:

```typescript
@topicSubscriber("user.activity")
class ActivityNotifier {
  async handle(message: any, context: MessageContext) {
    await websocket.broadcast({
      type: "notification",
      data: message,
    });
  }
}
```

### 3. Data Pipeline

Process and transform data through multiple stages:

```typescript
// Stage 1: Ingest
await NatsPubsub.publish("data.raw", rawData);

// Stage 2: Transform
@topicSubscriber("data.raw")
class DataTransformer {
  async handle(message: any, context: MessageContext) {
    const transformed = transform(message);
    await NatsPubsub.publish("data.transformed", transformed);
  }
}

// Stage 3: Store
@topicSubscriber("data.transformed")
class DataStorer {
  async handle(message: any, context: MessageContext) {
    await database.save(message);
  }
}
```

### 4. Background Jobs

Offload heavy processing to workers:

```typescript
// API endpoint
app.post("/process", async (req, res) => {
  await NatsPubsub.publish("job.heavy-processing", {
    jobId: uuid(),
    data: req.body,
  });
  res.json({ status: "queued" });
});

// Worker
@topicSubscriber("job.heavy-processing")
class HeavyProcessingWorker {
  async handle(message: any, context: MessageContext) {
    // Time-consuming processing
    const result = await processData(message.data);
    await NatsPubsub.publish("job.completed", {
      jobId: message.jobId,
      result,
    });
  }
}
```

### 5. Audit Logging

Capture all system events for compliance:

```typescript
// Wildcard subscriber for all events
@topicSubscriberWildcard("*")
class AuditLogger {
  async handle(message: any, context: MessageContext) {
    await auditLog.create({
      topic: context.topic,
      eventId: context.eventId,
      data: message,
      timestamp: context.occurredAt,
      traceId: context.traceId,
    });
  }
}
```

## Architecture Patterns

### Microservices Architecture

**File:** [microservices/README.md](./microservices/README.md)

Features:

- Service isolation
- Independent deployment
- Polyglot persistence
- Event-driven communication
- Saga pattern for distributed transactions

### Monolith with Event Bus

Suitable for:

- Gradual migration to microservices
- Internal event-driven architecture
- Background job processing

### Serverless with NATS

Use NatsPubsub in serverless functions:

- AWS Lambda
- Google Cloud Functions
- Azure Functions

## Testing Examples

### Unit Testing

```typescript
import { TestHarness } from 'nats-pubsub/testing';

describe('OrderService', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness();
    await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it('publishes order.created event', async () => {
    await orderService.create({ userId: '123', items: [...] });

    const messages = await harness.waitForMessages('order.created', 1);
    expect(messages[0].userId).toBe('123');
  });
});
```

### Integration Testing

```ruby
RSpec.describe 'Order Fulfillment Flow' do
  include NatsPubsub::Testing::Helpers

  before do
    setup_nats_pubsub_testing
  end

  it 'completes order workflow' do
    # Create order
    order = create_order(user_id: '123', items: [...])

    # Wait for events
    expect(NatsPubsub).to have_published('order.created')
    expect(NatsPubsub).to have_published('inventory.reserved')
    expect(NatsPubsub).to have_published('order.confirmed')

    # Verify final state
    expect(order.reload.status).to eq('CONFIRMED')
  end
end
```

## Development Workflow

### Local Development

1. **Start NATS:**

```bash
docker run -d --name nats -p 4222:4222 -p 8222:8222 nats:latest -js -m 8222
```

2. **Start PostgreSQL (if needed):**

```bash
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  postgres:16-alpine
```

3. **Run your service:**

```bash
npm run dev  # or bundle exec ruby app.rb
```

### Docker Compose

For multi-service development:

```bash
cd microservices
docker-compose up -d
```

### Production Deployment

See [Microservices README - Production Considerations](./microservices/README.md#production-considerations)

## Common Patterns

### 1. Topic Naming Convention

```
{domain}.{resource}.{action}
```

Examples:

- `user.account.created`
- `order.payment.processed`
- `inventory.stock.updated`

### 2. Error Handling Strategy

```typescript
async onError(errorContext: ErrorContext): Promise<ErrorAction> {
  const { error, attemptNumber, maxAttempts } = errorContext;

  // Transient errors → Retry
  if (error.message.includes('connection')) {
    return ErrorAction.RETRY;
  }

  // Validation errors → DLQ
  if (error.message.includes('validation')) {
    return ErrorAction.DLQ;
  }

  // Exhausted retries → DLQ
  if (attemptNumber >= maxAttempts) {
    return ErrorAction.DLQ;
  }

  return ErrorAction.RETRY;
}
```

### 3. Message Envelope

Always include metadata:

```typescript
{
  eventId: 'uuid',
  eventType: 'order.created',
  occurredAt: '2024-01-01T00:00:00Z',
  traceId: 'trace-uuid',
  correlationId: 'corr-uuid',
  producer: 'order-service',
  payload: {
    // Your data
  }
}
```

### 4. Graceful Shutdown

```typescript
process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");
  await NatsPubsub.stop();
  await database.disconnect();
  process.exit(0);
});
```

## Monitoring and Observability

### Health Checks

```typescript
// Express
app.get('/health', async (req, res) => {
  const health = await NatsPubsub.healthCheck();
  res.status(health.healthy ? 200 : 503).json(health);
});

// Sinatra/Rack
get '/health' do
  status, headers, body = NatsPubsub.health_check_middleware.call(env)
  [status, headers, body]
end
```

### Distributed Tracing

```typescript
// Start trace
const traceId = uuidv4();

// Publish with trace ID
await NatsPubsub.publish("order.created", orderData, {
  trace_id: traceId,
});

// Propagate trace ID
@topicSubscriber("order.created")
class OrderSubscriber {
  async handle(message: any, context: MessageContext) {
    // context.traceId contains the original trace ID
    await externalService.call({ traceId: context.traceId });
  }
}
```

### Metrics

Track key metrics:

- Message publish rate
- Message processing rate
- Error rate
- DLQ message count
- Processing latency
- Consumer lag

## Best Practices

1. **Design Events Carefully**: Events are your API
2. **Version Your Messages**: Plan for schema evolution
3. **Use Idempotency**: Enable inbox pattern for critical flows
4. **Handle Failures Gracefully**: Implement retry strategies
5. **Monitor Everything**: Track metrics and logs
6. **Test Thoroughly**: Unit and integration tests
7. **Document Events**: Maintain an event catalog
8. **Use Tracing**: Track requests across services
9. **Enable DLQ**: Always use dead letter queues
10. **Plan for Scale**: Design for horizontal scaling

## Troubleshooting

### Connection Issues

```bash
# Check NATS is running
curl http://localhost:8222/healthz

# Check JetStream is enabled
curl http://localhost:8222/jsz
```

### Message Not Received

1. Verify subscriber is registered
2. Check topic pattern matches
3. Verify JetStream stream exists
4. Check consumer is created
5. Review subscriber logs for errors

### Performance Issues

1. Increase concurrency
2. Use batch operations
3. Optimize message size
4. Scale horizontally
5. Check network latency

## Additional Resources

- [Main Documentation](../README.md)
- [JavaScript Package](../packages/javascript/README.md)
- [Ruby Package](../packages/ruby/README.md)
- [NATS Documentation](https://docs.nats.io/)
- [JetStream Guide](https://docs.nats.io/nats-concepts/jetstream)

## Contributing

Found a bug or want to add an example? See [CONTRIBUTING.md](../CONTRIBUTING.md)

## License

MIT - See [LICENSE](../LICENSE)

## Support

- GitHub Issues: https://github.com/attaradev/nats-pubsub/issues
- Discussions: https://github.com/attaradev/nats-pubsub/discussions
- Twitter: @attaradev

---

Happy coding with NatsPubsub!
