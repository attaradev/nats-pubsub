/**
 * Outbox Pattern for Reliable Message Publishing
 *
 * The Outbox pattern ensures messages are reliably published by:
 * 1. Storing the message in a database before publishing
 * 2. Publishing to NATS
 * 3. Marking as sent in the database
 *
 * This prevents message loss if the application crashes between publishing and commit.
 *
 * @module outbox
 */

// Types
export * from './types';

// Core implementation
export { OutboxPublisher, successResult, failureResult } from './outbox-publisher';

// Repository implementations
export { MemoryOutboxRepository } from './memory-outbox-repository';

// SQL schemas for various databases
export * from './sql-schemas';
