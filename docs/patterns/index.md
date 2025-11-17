# Reliability Patterns

NatsPubsub provides battle-tested reliability patterns to ensure message delivery, prevent data loss, and handle failures gracefully in distributed systems.

## Available Patterns

### Transactional Patterns

- **[Inbox/Outbox Combined](./inbox-outbox.md)** - Full end-to-end reliability with guaranteed delivery and exactly-once processing

### Error Handling

- **[Dead Letter Queue (DLQ)](./dlq.md)** - Automatic handling of failed messages after max retries
- **[Error Handling Strategies](./error-handling.md)** - Retry patterns, circuit breakers, and error classification

### Data Integrity

- **[Schema Validation](./schema-validation.md)** - Validate message structure with Zod schemas
- **[Event Sourcing](./event-sourcing.md)** - Build event-sourced systems with complete audit trails

## Quick Pattern Selection Guide

### By Reliability Requirements

**High Reliability** (Financial, Healthcare, E-commerce)

- ✓ Inbox/Outbox - No message loss, no duplicates
- ✓ DLQ - Failed message management
- ✓ Schema Validation - Data integrity

**Medium Reliability** (Social Media, Analytics)

- ✓ DLQ - Failed message management
- ✓ Error Handling - Retry strategies

**Low Reliability** (Logging, Non-critical notifications)

- ✓ Basic Error Handling
- ✓ DLQ (optional)

### By Use Case

**Financial Transactions**: Inbox/Outbox + Schema Validation
**User Notifications**: DLQ + Error Handling
**Analytics Events**: DLQ + Schema Validation
**Audit Logs**: Event Sourcing + Inbox/Outbox

## Learn More

- [Architecture Overview](../advanced/architecture.md)
- [Performance Tuning](../guides/performance.md)
- [Testing Strategies](../guides/testing.md)

---

[← Back to Documentation](../index.md)
